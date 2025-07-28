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

// server.js의 새로운 검색 시스템을 복사하여 테스트용으로 사용
const synonymDict = {
    '교수': ['교수님', '선생님', '강사', '교수진'],
    '수강신청': ['강의신청', '과목신청', '등록'],
    '시간표': ['강의시간', '수업시간', '강의일정', '수업일정'],
    '학과': ['전공', '학부', '과', '계열'],
    '캠퍼스': ['교정', '학교', '대학'],
    '기숙사': ['생활관', '도미토리', '숙소'],
    '도서관': ['중앙도서관', '라이브러리', '열람실']
};

function expandQuery(query) {
    let expandedQuery = query;
    
    if (query.includes('교수') || query.includes('선생님')) {
        expandedQuery = `${query} 강의 과목 담당 수업 시간표`;
    }
    if (query.includes('모든 교수') || query.includes('교수님들')) {
        expandedQuery = `${query} 교수 담당 강의 시간표 과목 목록`;
    }
    
    for (const [key, synonyms] of Object.entries(synonymDict)) {
        if (query.includes(key)) {
            expandedQuery += ' ' + synonyms.join(' ');
        }
    }
    
    if (query.includes('학과') || query.includes('전공')) {
        expandedQuery += ' 학부 과 전공 교육과정 교수진';
    }
    
    if (query.includes('수강신청') || query.includes('강의신청')) {
        expandedQuery += ' 등록 신청기간 일정 방법';
    }
    
    return expandedQuery.trim();
}

function classifyQuestion(query) {
    if (query.includes('교수') || query.includes('선생님') || query.includes('강사') || 
        query.includes('시간표') || query.includes('강의') || query.includes('수업')) {
        return { type: 'professor_course', priority: 'timetable' };
    }
    
    if (query.includes('학과') || query.includes('전공') || query.includes('학부') || 
        query.includes('입학') || query.includes('모집')) {
        return { type: 'department_admission', priority: 'website' };
    }
    
    if (query.includes('수강신청') || query.includes('강의신청') || query.includes('등록') ||
        query.includes('학사일정') || query.includes('일정')) {
        return { type: 'registration_schedule', priority: 'announcement' };
    }
    
    if (query.includes('도서관') || query.includes('기숙사') || query.includes('생활관') ||
        query.includes('캠퍼스') || query.includes('위치') || query.includes('건물')) {
        return { type: 'facility_campus', priority: 'website' };
    }
    
    return { type: 'general', priority: null };
}

async function hybridSearchWithThreshold(query, limit, sourceType, threshold) {
    const expandedQuery = expandQuery(query);
    
    console.log(`🤖 [OpenAI] 임베딩 생성 중... (임계값: ${threshold})`);
    const embeddingResponse = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: expandedQuery,
        encoding_format: "float",
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    console.log('🗄️ [Supabase] 하이브리드 검색 중...');
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

    if (error) {
        console.log('⚠️ [Supabase] 하이브리드 검색 실패, 폴백 검색 시도...');
        // 폴백: 기존 벡터 검색
        const fallbackResult = await supabase
            .rpc('search_documents', {
                query_embedding: queryEmbedding,
                match_threshold: threshold,
                match_count: limit,
                filter_source_type: sourceType
            });
        
        if (fallbackResult.error) throw fallbackResult.error;
        return fallbackResult.data || [];
    }
    
    return data || [];
}

async function adaptiveSearchDocuments(query, limit = 8, sourceType = null) {
    try {
        console.log(`🎯 [적응형 검색 시작] "${query}"`);
        
        // 1단계: 높은 임계값으로 정확한 매칭
        let results = await hybridSearchWithThreshold(query, limit, sourceType, 0.4);
        if (results.length >= 3) {
            console.log(`✅ [적응형 검색] 1단계 성공 - ${results.length}개 문서 (임계값: 0.4)`);
            return results;
        }
        
        // 2단계: 중간 임계값으로 확장
        results = await hybridSearchWithThreshold(query, limit, sourceType, 0.25);
        if (results.length >= 2) {
            console.log(`✅ [적응형 검색] 2단계 성공 - ${results.length}개 문서 (임계값: 0.25)`);
            return results;
        }
        
        // 3단계: 낮은 임계값으로 최대 확장
        results = await hybridSearchWithThreshold(query, limit, sourceType, 0.15);
        console.log(`✅ [적응형 검색] 3단계 완료 - ${results.length}개 문서 (임계값: 0.15)`);
        
        return results;
    } catch (error) {
        console.error('💥 [적응형 검색 실패]', error.message);
        throw error;
    }
}

async function smartRoutingSearch(query, limit = 8) {
    try {
        const classification = classifyQuestion(query);
        console.log(`🧠 [스마트 라우팅] 질문 분류: ${classification.type}, 우선순위: ${classification.priority}`);
        
        let results = [];
        
        if (classification.priority) {
            // 1단계: 우선순위 소스에서 검색
            results = await adaptiveSearchDocuments(query, Math.ceil(limit * 0.7), classification.priority);
            console.log(`📊 [스마트 라우팅] 우선순위(${classification.priority}) 검색: ${results.length}개 문서`);
            
            // 2단계: 결과가 부족하면 전체 소스에서 추가 검색
            if (results.length < 3) {
                const additionalResults = await adaptiveSearchDocuments(query, limit - results.length, null);
                console.log(`📊 [스마트 라우팅] 전체 검색 보완: ${additionalResults.length}개 문서`);
                
                // 중복 제거하며 결합
                const existingIds = new Set(results.map(doc => doc.id));
                const newResults = additionalResults.filter(doc => !existingIds.has(doc.id));
                results = [...results, ...newResults];
            }
        } else {
            results = await adaptiveSearchDocuments(query, limit, null);
        }
        
        console.log(`🎯 [스마트 라우팅] 최종 결과: ${results.length}개 문서`);
        return results;
        
    } catch (error) {
        console.error('💥 [스마트 라우팅 실패]', error.message);
        return await adaptiveSearchDocuments(query, limit, null);
    }
}

// 웹 검색 보강 시스템
async function webSearchFallback(query) {
    try {
        console.log(`🌐 [웹 검색 보강] "${query}" 실행...`);
        
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
                console.log(`✅ [웹 검색 보강] "${key}" 키워드 매칭됨`);
                return [{
                    id: 'web_fallback',
                    content: `대진대학교 ${key}: ${info}`,
                    source_file: 'web_search_fallback',
                    source_type: 'web_fallback',
                    similarity: 0.8
                }];
            }
        }
        
        console.log(`❌ [웹 검색 보강] 매칭되는 키워드 없음`);
        return [];
    } catch (error) {
        console.error('💥 [웹 검색 보강 실패]', error.message);
        return [];
    }
}

// 메인 검색 함수
async function searchDocuments(query, limit = 8, sourceType = null) {
    console.log(`\n🚀 [향상된 검색 시작] 쿼리: "${query}"`);
    
    const expandedQuery = expandQuery(query);
    console.log(`📝 [쿼리 확장] "${query}" → "${expandedQuery}"`);
    
    try {
        let results = [];
        
        if (sourceType) {
            results = await adaptiveSearchDocuments(query, limit, sourceType);
        } else {
            results = await smartRoutingSearch(query, limit);
        }
        
        // 결과가 부족한 경우 웹 검색 보강 적용
        if (results.length < 3) {
            console.log(`⚠️ [검색 보강] 결과 부족 (${results.length}개), 웹 검색 보강 시도...`);
            const webResults = await webSearchFallback(query);
            
            if (webResults.length > 0) {
                console.log(`✅ [검색 보강] 웹 검색에서 ${webResults.length}개 추가 결과 획득`);
                results = [...results, ...webResults];
            }
        }
        
        return results;
        
    } catch (error) {
        console.error('💥 [검색 실패]', error.message);
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