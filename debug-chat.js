// 채팅 API 디버깅 스크립트
require('dotenv').config();
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
});

// RAG 검색 함수 (server.js에서 복사)
async function searchDocuments(query, limit = 5, sourceType = null) {
    try {
        console.log(`\n🔍 [검색 시작] 쿼리: "${query}"`);
        
        // 검색어 확장 (교수 이름 검색 개선)
        let expandedQuery = query;
        if (query.includes('교수') || query.includes('선생님')) {
            expandedQuery = `${query} 강의 과목 담당 수업 시간표`;
        }
        if (query.includes('모든 교수') || query.includes('교수님들')) {
            expandedQuery = `${query} 교수 담당 강의 시간표 과목 목록`;
        }
        
        console.log(`📝 [확장된 쿼리] "${expandedQuery}"`);

        // 쿼리를 임베딩으로 변환
        console.log('🤖 [OpenAI] 임베딩 생성 중...');
        const embeddingResponse = await openai.embeddings.create({
            model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            input: expandedQuery,
            encoding_format: "float",
        });
        console.log(`✅ [OpenAI] 임베딩 성공 (차원: ${embeddingResponse.data[0].embedding.length})`);

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Supabase에서 유사 문서 검색
        console.log('🗄️ [Supabase] 문서 검색 중...');
        const { data, error } = await supabase
            .rpc('search_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.25,
                match_count: limit,
                filter_source_type: sourceType
            });

        if (error) {
            console.error('❌ [Supabase] 검색 오류:', error);
            throw error;
        }

        console.log(`✅ [Supabase] 검색 성공 (${data?.length || 0}개 문서 발견)`);
        if (data && data.length > 0) {
            data.forEach((doc, index) => {
                console.log(`  ${index + 1}. 유사도: ${doc.similarity?.toFixed(3)}, 소스: ${doc.source_file}, 내용: ${doc.content.substring(0, 50)}...`);
            });
        }

        return data || [];
    } catch (error) {
        console.error('💥 [검색 오류]', error.message);
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
        console.log('\n🧠 [Claude] API 호출 시작...');
        console.log(`📝 [Claude] 시스템 프롬프트 길이: ${systemPrompt.length}자`);
        console.log(`💬 [Claude] 사용자 메시지: "${userMessage}"`);
        
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

        console.log(`✅ [Claude] 응답 수신 완료`);
        console.log(`📊 [Claude] 응답 타입: ${typeof message.content}`);
        console.log(`📊 [Claude] 응답 배열 길이: ${message.content ? message.content.length : 0}`);
        
        const responseText = message.content[0].text;
        console.log(`📝 [Claude] 최종 응답: "${responseText ? responseText.substring(0, 100) + '...' : 'null'}"`);
        
        return responseText;
    } catch (error) {
        console.error('💥 [Claude] API 오류:', error.message);
        console.error('📋 [Claude] 오류 상세:', error);
        throw error;
    }
}

// 메인 테스트 함수
async function testChat(message) {
    try {
        console.log(`\n🚀 채팅 테스트 시작: "${message}"`);
        
        // 1. 관련 문서 검색
        const documents = await searchDocuments(message, 8);
        console.log(`📚 관련 문서 ${documents.length}개 발견`);

        // 2. 컨텍스트 생성
        const context = createContext(documents);
        console.log(`📖 컨텍스트 길이: ${context.length}자`);

        // 3. Claude로 응답 생성
        const response = await generateResponse(message, context);
        console.log(`🎯 최종 응답: ${response}`);

        // 4. 결과 반환
        return {
            response: response,
            context: documents.map(doc => ({
                source: doc.source_file,
                similarity: doc.similarity
            }))
        };

    } catch (error) {
        console.error('💥 전체 테스트 오류:', error.message);
        console.error('📋 오류 스택:', error.stack);
        throw error;
    }
}

// 테스트 실행
if (require.main === module) {
    const testMessage = process.argv[2] || '안녕하세요';
    testChat(testMessage)
        .then(result => {
            console.log('\n✅ 테스트 성공!');
            console.log('📤 결과:', JSON.stringify(result, null, 2));
        })
        .catch(error => {
            console.log('\n❌ 테스트 실패!');
            console.error('🚨 오류:', error.message);
        });
}

module.exports = { testChat, searchDocuments, createContext, generateResponse };