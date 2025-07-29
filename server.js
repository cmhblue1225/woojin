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

// 동의어 및 확장 키워드 사전 (다국어 지원)
const synonymDict = {
    '교수': ['교수님', '선생님', '강사', '교수진', '教授', '老师'],
    '수강신청': ['강의신청', '과목신청', '등록', '课程申请', '选课'],
    '시간표': ['강의시간', '수업시간', '강의일정', '수업일정', '课程表', '时间表'],
    '학과': ['전공', '학부', '과', '계열', '学科', '专业', '系'],
    '캠퍼스': ['교정', '학교', '대학', '校园', '校区'],
    '기숙사': ['생활관', '도미토리', '숙소', '宿舍', '生活館', '住宿'],
    '도서관': ['중앙도서관', '라이브러리', '열람실', '图书馆', '圖書館'],
    '위치': ['장소', '곳', '어디', '주소', '位置', '地址'],
    '시간': ['운영시간', '이용시간', '개방시간', '时间', '開放時間'],
    '신청': ['접수', '등록', '지원', '申请', '申請'],
    '안내': ['정보', '소개', '가이드', '指南', '介绍']
};

// 쿼리 확장 함수
function expandQuery(query) {
    let expandedQuery = query;
    
    // 기존 교수 관련 확장
    if (query.includes('교수') || query.includes('선생님')) {
        expandedQuery = `${query} 강의 과목 담당 수업 시간표`;
    }
    if (query.includes('모든 교수') || query.includes('교수님들')) {
        expandedQuery = `${query} 교수 담당 강의 시간표 과목 목록`;
    }
    
    // 동의어 확장
    for (const [key, synonyms] of Object.entries(synonymDict)) {
        if (query.includes(key)) {
            expandedQuery += ' ' + synonyms.join(' ');
        }
    }
    
    // 학과 관련 확장
    if (query.includes('학과') || query.includes('전공')) {
        expandedQuery += ' 학부 과 전공 교육과정 교수진';
    }
    
    // 수강신청 관련 확장
    if (query.includes('수강신청') || query.includes('강의신청')) {
        expandedQuery += ' 등록 신청기간 일정 방법';
    }
    
    return expandedQuery.trim();
}

// 하이브리드 검색 함수 (벡터 + 키워드)
async function hybridSearchDocuments(query, limit = 8, sourceType = null) {
    try {
        const expandedQuery = expandQuery(query);
        console.log(`[하이브리드 검색] 원본: "${query}" → 확장: "${expandedQuery}"`);

        // 쿼리를 임베딩으로 변환
        const embeddingResponse = await openai.embeddings.create({
            model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            input: expandedQuery,
            encoding_format: "float",
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // 하이브리드 검색 실행
        const { data, error } = await supabase
            .rpc('hybrid_search_documents', {
                query_embedding: queryEmbedding,
                search_keywords: expandedQuery,
                vector_threshold: 0.2,
                match_count: limit,
                filter_source_type: sourceType,
                vector_weight: 0.6,
                keyword_weight: 0.4
            });

        if (error) {
            console.error('하이브리드 검색 오류:', error);
            throw error;
        }

        // 검색 결과 로깅
        console.log(`[하이브리드 검색 결과] "${query}" - ${data?.length || 0}개 문서 발견`);
        if (data && data.length > 0) {
            data.forEach((doc, index) => {
                console.log(`  ${index + 1}. 통합점수: ${doc.combined_score?.toFixed(3)} (벡터: ${doc.similarity?.toFixed(3)}, 키워드: ${doc.keyword_rank?.toFixed(3)}) 소스: ${doc.source_file}`);
            });
        }

        return data || [];
    } catch (error) {
        console.error('하이브리드 검색 실패:', error);
        // 하이브리드 검색 실패시 기존 벡터 검색으로 폴백
        return await fallbackVectorSearch(query, limit, sourceType);
    }
}

// 다단계 적응형 검색 함수
async function adaptiveSearchDocuments(query, limit = 8, sourceType = null) {
    try {
        console.log(`[적응형 검색 시작] "${query}"`);
        
        // 1단계: 중간 임계값으로 정확한 매칭 시도 (낮춤)
        let results = await hybridSearchWithThreshold(query, limit, sourceType, 0.3);
        if (results.length >= 3) {
            console.log(`[적응형 검색] 1단계 성공 - ${results.length}개 문서 (임계값: 0.3)`);
            return results;
        }
        
        // 2단계: 낮은 임계값으로 확장
        results = await hybridSearchWithThreshold(query, limit, sourceType, 0.2);
        if (results.length >= 2) {
            console.log(`[적응형 검색] 2단계 성공 - ${results.length}개 문서 (임계값: 0.2)`);
            return results;
        }
        
        // 3단계: 매우 낮은 임계값으로 최대 확장
        results = await hybridSearchWithThreshold(query, limit, sourceType, 0.1);
        console.log(`[적응형 검색] 3단계 완료 - ${results.length}개 문서 (임계값: 0.1)`);
        
        return results;
    } catch (error) {
        console.error('적응형 검색 실패:', error);
        throw error;
    }
}

// 임계값 조정 하이브리드 검색
async function hybridSearchWithThreshold(query, limit, sourceType, threshold) {
    const expandedQuery = expandQuery(query);
    
    const embeddingResponse = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: expandedQuery,
        encoding_format: "float",
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    const { data, error } = await supabase
        .rpc('hybrid_search_documents', {
            query_embedding: queryEmbedding,
            search_keywords: expandedQuery,
            vector_threshold: threshold,
            match_count: limit,
            filter_source_type: sourceType,
            vector_weight: 0.7,
            keyword_weight: 0.3
        });

    if (error) throw error;
    return data || [];
}

// 폴백 벡터 검색 (하이브리드 검색 실패시)
async function fallbackVectorSearch(query, limit, sourceType) {
    try {
        const expandedQuery = expandQuery(query);
        
        const embeddingResponse = await openai.embeddings.create({
            model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            input: expandedQuery,
            encoding_format: "float",
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        const { data, error } = await supabase
            .rpc('search_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.15,
                match_count: limit,
                filter_source_type: sourceType
            });

        if (error) throw error;
        
        console.log(`[폴백 검색] "${query}" - ${data?.length || 0}개 문서 발견`);
        return data || [];
    } catch (error) {
        console.error('폴백 검색 실패:', error);
        return [];
    }
}

// 질문 타입 분류 함수
function classifyQuestion(query) {
    const lowerQuery = query.toLowerCase();
    
    // 교수/강의 관련
    if (query.includes('교수') || query.includes('선생님') || query.includes('강사') || 
        query.includes('시간표') || query.includes('강의') || query.includes('수업')) {
        return { type: 'professor_course', priority: 'timetable' };
    }
    
    // 학과/입학 관련
    if (query.includes('학과') || query.includes('전공') || query.includes('학부') || 
        query.includes('입학') || query.includes('모집')) {
        return { type: 'department_admission', priority: 'website' };
    }
    
    // 수강신청/학사일정 관련
    if (query.includes('수강신청') || query.includes('강의신청') || query.includes('등록') ||
        query.includes('학사일정') || query.includes('일정')) {
        return { type: 'registration_schedule', priority: 'announcement' };
    }
    
    // 시설/캠퍼스 관련
    if (query.includes('도서관') || query.includes('기숙사') || query.includes('생활관') ||
        query.includes('캠퍼스') || query.includes('위치') || query.includes('건물')) {
        return { type: 'facility_campus', priority: 'website' };
    }
    
    // 일반 정보
    return { type: 'general', priority: null };
}

// 스마트 라우팅 검색 함수
async function smartRoutingSearch(query, limit = 8) {
    try {
        const classification = classifyQuestion(query);
        console.log(`[스마트 라우팅] 질문 분류: ${classification.type}, 우선순위: ${classification.priority}`);
        
        let results = [];
        
        // 우선순위 소스가 있는 경우
        if (classification.priority) {
            // 1단계: 우선순위 소스에서 검색
            results = await adaptiveSearchDocuments(query, Math.ceil(limit * 0.7), classification.priority);
            console.log(`[스마트 라우팅] 우선순위(${classification.priority}) 검색: ${results.length}개 문서`);
            
            // 2단계: 결과가 부족하면 전체 소스에서 추가 검색
            if (results.length < 3) {
                const additionalResults = await adaptiveSearchDocuments(query, limit - results.length, null);
                console.log(`[스마트 라우팅] 전체 검색 보완: ${additionalResults.length}개 문서`);
                
                // 중복 제거하며 결합
                const existingIds = new Set(results.map(doc => doc.id));
                const newResults = additionalResults.filter(doc => !existingIds.has(doc.id));
                results = [...results, ...newResults];
            }
        } else {
            // 일반 질문의 경우 전체 검색
            results = await adaptiveSearchDocuments(query, limit, null);
        }
        
        console.log(`[스마트 라우팅] 최종 결과: ${results.length}개 문서`);
        return results;
        
    } catch (error) {
        console.error('스마트 라우팅 검색 실패:', error);
        // 폴백: 일반 적응형 검색
        return await adaptiveSearchDocuments(query, limit, null);
    }
}

// 웹 검색 보강 시스템 (간단한 버전)
async function webSearchFallback(query) {
    try {
        console.log(`[웹 검색 보강] "${query}" 실행...`);
        
        // 대진대학교 관련 기본 정보 제공
        const fallbackResponses = {
            '위치': '경기도 포천시 호국로 1007',
            '전화': '031-539-1114',
            '설립': '1987년',
            '홈페이지': 'www.daejin.ac.kr',
            '컴퓨터공학과': '공과대학 소속, 소프트웨어 개발 및 컴퓨터 시스템 전문가 양성',
            '기숙사': '생활관 운영, 캠퍼스 내 위치',
            '도서관': '중앙도서관 운영, 학습 공간 및 자료 제공'
        };
        
        for (const [key, info] of Object.entries(fallbackResponses)) {
            if (query.includes(key)) {
                return [{
                    id: 'web_fallback',
                    content: `대진대학교 ${key}: ${info}`,
                    source_file: 'web_search_fallback',
                    source_type: 'web_fallback',
                    similarity: 0.8
                }];
            }
        }
        
        return [];
    } catch (error) {
        console.error('웹 검색 보강 실패:', error);
        return [];
    }
}

// 향상된 메인 검색 함수 (웹 검색 보강 포함)
async function searchDocuments(query, limit = 8, sourceType = null) {
    try {
        let results = [];
        
        if (sourceType) {
            // 명시적으로 소스 타입이 지정된 경우
            results = await adaptiveSearchDocuments(query, limit, sourceType);
        } else {
            // 스마트 라우팅 적용
            results = await smartRoutingSearch(query, limit);
        }
        
        // 결과가 부족한 경우 웹 검색 보강 적용
        if (results.length < 3) {
            console.log(`[검색 보강] 결과 부족 (${results.length}개), 웹 검색 보강 시도...`);
            const webResults = await webSearchFallback(query);
            
            if (webResults.length > 0) {
                console.log(`[검색 보강] 웹 검색에서 ${webResults.length}개 추가 결과 획득`);
                results = [...results, ...webResults];
            }
        }
        
        return results;
        
    } catch (error) {
        console.error('검색 실패:', error);
        // 최종 폴백: 웹 검색 보강만 시도
        return await webSearchFallback(query);
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

// Claude API를 사용한 응답 생성 (오류 시 기본 응답 제공)
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
        console.log(`[Claude] API 요청 - 모델: ${process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'}`);
        console.log(`[Claude] 시스템 프롬프트 길이: ${systemPrompt.length}자`);
        console.log(`[Claude] 사용자 메시지: "${userMessage}"`);
        
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

        console.log(`[Claude] 응답 받음 - 타입: ${typeof message.content}`);
        console.log(`[Claude] 응답 배열 길이: ${message.content ? message.content.length : 0}`);
        console.log(`[Claude] 첫 번째 컨텐츠: ${message.content[0] ? typeof message.content[0] : 'undefined'}`);
        
        const responseText = message.content[0].text;
        console.log(`[Claude] 최종 응답 텍스트: "${responseText ? responseText.substring(0, 50) + '...' : 'null'}"`);
        
        return responseText;
    } catch (error) {
        console.error('Claude API 오류:', error.message);
        
        // Claude API 오류 시 기본 응답 생성
        if (error.status === 529 || error.message.includes('Overloaded')) {
            console.log('[Claude] API 과부하 - 기본 응답 제공');
            return generateFallbackResponse(userMessage, context);
        }
        
        throw error;
    }
}

// Claude API 오류 시 사용할 기본 응답 생성
function generateFallbackResponse(userMessage, context) {
    console.log('[Fallback] 기본 응답 생성 중...');
    
    // 기본 인사말
    if (userMessage.includes('안녕') || userMessage.includes('하이') || userMessage.includes('hello')) {
        return '안녕하세요! 🎓 대진대학교 AI 챗봇 우진이입니다.\n\n현재 Claude API가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주시면 더 자세한 답변을 드릴 수 있습니다!\n\n그래도 기본적인 정보는 검색된 자료를 바탕으로 도움을 드릴게요. 😊';
    }
    
    // 컨텍스트 기반 간단한 응답
    if (context && context !== '관련 정보를 찾을 수 없습니다.') {
        return `질문하신 "${userMessage}"에 대한 정보를 찾았습니다!\n\n${context.substring(0, 500)}...\n\n💡 더 자세한 정보가 필요하시면 잠시 후 다시 질문해주세요. 현재 AI 서비스가 일시적으로 과부하 상태입니다.`;
    }
    
    // 기본 응답
    return `"${userMessage}"에 대한 질문을 받았습니다.\n\n죄송하지만 현재 AI 서비스가 일시적으로 과부하 상태입니다. 🔧\n\n다음과 같은 방법을 시도해보세요:\n• 잠시 후 다시 질문해주세요\n• 더 구체적인 질문으로 다시 시도해보세요\n• 수강신청, 시간표, 교수님 정보 등에 대해 질문해주세요\n\n감사합니다! 😊`;
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
        const documents = await searchDocuments(message, 8);
        console.log(`관련 문서 ${documents.length}개 발견`);

        // 컨텍스트 생성
        const context = createContext(documents);
        console.log(`[컨텍스트 길이] ${context.length}자`);

        // Claude로 응답 생성
        console.log(`[Claude API 호출 시작] 메시지: "${message}"`);
        const response = await generateResponse(message, context);
        console.log(`[Claude API 응답 완료] 응답 길이: ${response ? response.length : 0}자`);
        console.log(`[Claude API 응답 내용] ${response ? response.substring(0, 100) + '...' : 'null 응답'}`);

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
            response: response,
            context: documents.map(doc => ({
                source: doc.source_file,
                similarity: doc.similarity
            }))
        });

    } catch (error) {
        console.error('챗봇 API 오류:', error);
        console.error('오류 스택:', error.stack);
        console.error('오류 타입:', error.constructor.name);
        console.error('오류 메시지:', error.message);
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