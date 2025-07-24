// 대진대학교 RAG 챗봇 백엔드 서버
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

// API 클라이언트 초기화
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
});

// RAG 검색 함수
async function searchDocuments(query, limit = 5, sourceType = null) {
    try {
        // 쿼리를 임베딩으로 변환
        const embeddingResponse = await openai.embeddings.create({
            model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            input: query,
            encoding_format: "float",
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Supabase에서 유사 문서 검색
        const { data, error } = await supabase
            .rpc('search_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.3,
                match_count: limit,
                filter_source_type: sourceType
            });

        if (error) {
            console.error('검색 오류:', error);
            throw error;
        }

        return data || [];
    } catch (error) {
        console.error('문서 검색 실패:', error);
        throw error;
    }
}

// 컨텍스트 생성 함수
function createContext(documents) {
    if (!documents || documents.length === 0) {
        return '관련 정보를 찾을 수 없습니다.';
    }

    let context = '다음은 관련 정보입니다:\n\n';
    
    documents.forEach((doc, index) => {
        context += `[문서 ${index + 1}] (출처: ${doc.source_file})\n`;
        context += `${doc.content}\n\n`;
    });

    return context;
}

// Claude API를 사용한 응답 생성
async function generateResponse(userMessage, context) {
    const systemPrompt = `당신은 대진대학교의 도움이 되는 AI 챗봇입니다. 학생들의 질문에 친근하고 정확하게 답변해주세요.

다음 지침을 따라주세요:
1. 제공된 컨텍스트 정보를 기반으로 답변하세요
2. 한국어로 답변하고, 대학생에게 친근한 톤을 사용하세요
3. 구체적이고 실용적인 정보를 제공하세요
4. 컨텍스트에 정보가 없으면 솔직히 "관련 데이터를 찾을 수 없다"고 말하세요
5. 수강신청, 시간표, 학사일정 등의 질문에 상세히 답변하세요
6. 필요하면 예시를 들어 설명하세요

컨텍스트 정보:
${context}`;

    try {
        const message = await anthropic.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: parseInt(process.env.MAX_TOKENS) || 2000,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userMessage
                }
            ]
        });

        return message.content[0].text;
    } catch (error) {
        console.error('Claude API 오류:', error);
        throw error;
    }
}

// API 라우트

// 건강 체크
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// 문서 검색 API
app.post('/api/search', async (req, res) => {
    try {
        const { query, limit = 5, sourceType = null } = req.body;

        if (!query) {
            return res.status(400).json({ error: '검색어가 필요합니다.' });
        }

        const documents = await searchDocuments(query, limit, sourceType);
        
        res.json({
            query,
            documents,
            total: documents.length
        });

    } catch (error) {
        console.error('검색 API 오류:', error);
        res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
    }
});

// 챗봇 대화 API
app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;

        if (!message) {
            return res.status(400).json({ error: '메시지가 필요합니다.' });
        }

        console.log(`[${new Date().toISOString()}] 사용자 질문: ${message}`);

        // 관련 문서 검색
        const documents = await searchDocuments(message, 5);
        console.log(`관련 문서 ${documents.length}개 발견`);

        // 컨텍스트 생성
        const context = createContext(documents);

        // Claude로 응답 생성
        const response = await generateResponse(message, context);

        // 채팅 히스토리 저장 (선택적)
        if (sessionId) {
            try {
                await supabase
                    .from('chat_history')
                    .insert({
                        session_id: sessionId,
                        user_message: message,
                        bot_response: response,
                        context_documents: documents.map(doc => ({
                            id: doc.id,
                            source_file: doc.source_file,
                            similarity: doc.similarity
                        }))
                    });
            } catch (historyError) {
                console.error('히스토리 저장 오류:', historyError);
                // 히스토리 저장 실패해도 응답은 반환
            }
        }

        res.json({
            message: response,
            context: documents.map(doc => ({
                source: doc.source_file,
                similarity: doc.similarity
            }))
        });

    } catch (error) {
        console.error('챗봇 API 오류:', error);
        res.status(500).json({ 
            error: '챗봇 서비스에 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
        });
    }
});

// 스트리밍 챗봇 API (선택적)
app.post('/api/chat/stream', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: '메시지가 필요합니다.' });
        }

        // SSE 헤더 설정
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // 관련 문서 검색
        const documents = await searchDocuments(message, 5);
        const context = createContext(documents);

        // 컨텍스트 전송
        res.write(`data: ${JSON.stringify({ type: 'context', documents: documents.length })}\n\n`);

        // Claude 스트리밍 응답
        const stream = await anthropic.messages.stream({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: parseInt(process.env.MAX_TOKENS) || 2000,
            system: `당신은 대진대학교의 도움이 되는 AI 챗봇입니다. 다음 컨텍스트를 기반으로 한국어로 친근하게 답변하세요:\n\n${context}`,
            messages: [{ role: 'user', content: message }]
        });

        stream.on('text', (text) => {
            res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
        });

        stream.on('end', () => {
            res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
            res.end();
        });

        stream.on('error', (error) => {
            console.error('스트리밍 오류:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', message: '오류가 발생했습니다.' })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('스트리밍 챗봇 API 오류:', error);
        res.status(500).json({ error: '스트리밍 서비스 오류' });
    }
});

// 통계 API
app.get('/api/stats', async (req, res) => {
    try {
        // 문서 통계
        const { data: docStats, error: docError } = await supabase
            .from('documents')
            .select('source_type')
            .then(result => ({
                data: result.data?.reduce((acc, doc) => {
                    acc[doc.source_type] = (acc[doc.source_type] || 0) + 1;
                    return acc;
                }, {}),
                error: result.error
            }));

        if (docError) throw docError;

        // 총 문서 수
        const { count: totalDocs } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });

        res.json({
            totalDocuments: totalDocs || 0,
            documentsByType: docStats || {},
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('통계 API 오류:', error);
        res.status(500).json({ error: '통계 조회 오류' });
    }
});

// 프론트엔드 라우팅 (React)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 대진대학교 챗봇 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📱 로컬 접속: http://localhost:${PORT}`);
});

// 종료 시 정리
process.on('SIGTERM', () => {
    console.log('서버를 종료합니다...');
    process.exit(0);
});

module.exports = app;