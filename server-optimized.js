// 대진대학교 RAG 챗봇 최적화 서버 v2.0
// 포트 3003으로 테스트 실행 - 기존 작업에 영향 없음

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = 3003;  // 안전한 테스트 포트

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

// 🚀 성능 최적화 설정
const CACHE_TTL = 5 * 60 * 1000; // 5분 캐시
const searchCache = new Map();
const responseCache = new Map();

// API 클라이언트 초기화 (연결 풀 최적화)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
        db: { schema: 'public' },
        auth: { persistSession: false },
        global: {
            headers: {
                'Connection': 'keep-alive'
            }
        }
    }
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 15000,
    maxRetries: 2
});

const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
    timeout: 20000,
    maxRetries: 2
});

// 🔍 향상된 동의어 및 확장 키워드 사전 
const synonymDict = {
    '교수': ['교수님', '선생님', '강사', '교수진', '담당교수', '지도교수', '교원'],
    '수강신청': ['강의신청', '과목신청', '등록', '수강등록', '학점등록', '강의등록'],
    '시간표': ['강의시간', '수업시간', '강의일정', '수업일정', '강의표', '수업표'],
    '학과': ['전공', '학부', '과', '계열', '전공과정', '학전', '전공학과'],
    '캠퍼스': ['교정', '학교', '대학', '학교', '대학교', '교내'],
    '기숙사': ['생활관', '도미토리', '숙소', '학생숙소', '기숙생활'],
    '도서관': ['중앙도서관', '라이브러리', '열람실', '자료실', '학습실'],
    '위치': ['장소', '곳', '어디', '주소', '자리', '건물'],
    '시간': ['운영시간', '이용시간', '개방시간', '접수시간', '신청시간'],
    '신청': ['접수', '등록', '지원', '신청서', '원서'],
    '안내': ['정보', '소개', '가이드', '설명', '방법', '절차']
};

// 🧠 스마트 쿼리 확장 (성능 최적화)
function expandQueryOptimized(query) {
    let expandedQuery = query;
    const queryLower = query.toLowerCase();
    
    // 캐시 확인
    const cacheKey = `expand_${query}`;
    if (searchCache.has(cacheKey)) {
        const cached = searchCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
        searchCache.delete(cacheKey);
    }
    
    // 교수 관련 특별 처리 (최적화됨)
    if (queryLower.includes('교수')) {
        expandedQuery = `${query} 강의 과목 담당 수업 시간표 교수님`;
        if (query.includes('모든') || query.includes('전체')) {
            expandedQuery += ' 교원 교수진 담당강의 전공과목';
        }
    }
    
    // 동의어 확장 (성능 최적화)
    const synonymsToAdd = [];
    for (const [key, synonyms] of Object.entries(synonymDict)) {
        if (queryLower.includes(key.toLowerCase())) {
            synonymsToAdd.push(...synonyms.slice(0, 3)); // 상위 3개만 선택
        }
    }
    
    if (synonymsToAdd.length > 0) {
        expandedQuery += ' ' + synonymsToAdd.join(' ');
    }
    
    // 학과/전공 관련
    if (queryLower.includes('학과') || queryLower.includes('전공')) {
        expandedQuery += ' 학부 교육과정 교수진 전공과목';
    }
    
    // 수강신청 관련
    if (queryLower.includes('수강신청') || queryLower.includes('강의신청')) {
        expandedQuery += ' 등록 신청기간 일정 방법 절차';
    }
    
    const result = expandedQuery.trim();
    
    // 캐시 저장
    searchCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
    });
    
    return result;
}

// 🚀 최적화된 하이브리드 검색 (임계값 낮춰짐)
async function optimizedHybridSearch(query, limit = 8, sourceType = null) {
    try {
        const cacheKey = `search_${query}_${limit}_${sourceType || 'all'}`;
        
        // 캐시 확인
        if (searchCache.has(cacheKey)) {
            const cached = searchCache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                console.log(`[캐시 HIT] "${query}" - ${cached.data.length}개 문서`);
                return cached.data;
            }
            searchCache.delete(cacheKey);
        }
        
        const expandedQuery = expandQueryOptimized(query);
        console.log(`[최적화 검색] 원본: "${query}" → 확장: "${expandedQuery}"`);

        // 임베딩 생성 (병렬 처리를 위해 Promise로 감쌈)
        const embeddingPromise = openai.embeddings.create({
            model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            input: expandedQuery,
            encoding_format: "float",
        });

        const embeddingResponse = await embeddingPromise;
        const queryEmbedding = embeddingResponse.data[0].embedding;

        // 최적화된 검색 (더 낮은 임계값)
        const { data, error } = await supabase
            .rpc('hybrid_search_documents', {
                query_embedding: queryEmbedding,
                search_keywords: expandedQuery,
                vector_threshold: 0.1,  // 0.2 → 0.1로 낮춤
                match_count: limit,
                filter_source_type: sourceType,
                vector_weight: 0.7,     // 벡터 가중치 증가
                keyword_weight: 0.3     // 키워드 가중치 감소
            });

        if (error) {
            console.error('최적화 검색 오류:', error);
            throw error;
        }

        const results = data || [];
        
        // 캐시 저장
        searchCache.set(cacheKey, {
            data: results,
            timestamp: Date.now()
        });

        console.log(`[최적화 검색] "${query}" - ${results.length}개 문서 발견`);
        if (results.length > 0) {
            results.slice(0, 3).forEach((doc, index) => {
                console.log(`  ${index + 1}. 점수: ${doc.combined_score?.toFixed(3)} 소스: ${doc.source_file?.substring(0, 30)}...`);
            });
        }

        return results;
        
    } catch (error) {
        console.error('최적화 검색 실패:', error);
        return await fallbackSearch(query, limit, sourceType);
    }
}

// 🔄 개선된 적응형 검색
async function adaptiveSearchOptimized(query, limit = 8, sourceType = null) {
    try {
        console.log(`[적응형 검색] "${query}" 시작`);
        
        // 1단계: 매우 낮은 임계값으로 시작
        let results = await searchWithThreshold(query, limit, sourceType, 0.05);
        if (results.length >= 3) {
            console.log(`[적응형] 1단계 성공 - ${results.length}개 (임계값: 0.05)`);
            return results;
        }
        
        // 2단계: 좀 더 관대하게
        results = await searchWithThreshold(query, limit, sourceType, 0.08);
        if (results.length >= 2) {
            console.log(`[적응형] 2단계 성공 - ${results.length}개 (임계값: 0.08)`);
            return results;
        }
        
        // 3단계: 최대한 관대하게
        results = await searchWithThreshold(query, limit, sourceType, 0.12);
        console.log(`[적응형] 3단계 완료 - ${results.length}개 (임계값: 0.12)`);
        
        return results;
        
    } catch (error) {
        console.error('적응형 검색 실패:', error);
        return await fallbackSearch(query, limit, sourceType);
    }
}

// 임계값 조정 검색 함수
async function searchWithThreshold(query, limit, sourceType, threshold) {
    const expandedQuery = expandQueryOptimized(query);
    
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
            vector_weight: 0.8,  // 벡터 검색 강화
            keyword_weight: 0.2
        });

    if (error) throw error;
    return data || [];
}

// 폴백 검색
async function fallbackSearch(query, limit, sourceType) {
    try {
        const expandedQuery = expandQueryOptimized(query);
        
        const embeddingResponse = await openai.embeddings.create({
            model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            input: expandedQuery,
            encoding_format: "float",
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        const { data, error } = await supabase
            .rpc('search_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.05,  // 매우 낮은 임계값
                match_count: limit,
                filter_source_type: sourceType
            });

        if (error) throw error;
        
        console.log(`[폴백 검색] "${query}" - ${data?.length || 0}개 문서`);
        return data || [];
        
    } catch (error) {
        console.error('폴백 검색 실패:', error);
        return [];
    }
}

// 향상된 질문 분류
function classifyQuestionOptimized(query) {
    const lowerQuery = query.toLowerCase();
    
    // 교수/강의 관련 (더 정확한 분류)
    if (lowerQuery.match(/교수|선생님|강사|시간표|강의|수업|담당|지도교수/)) {
        return { 
            type: 'professor_course', 
            priority: 'timetable',
            confidence: 0.9 
        };
    }
    
    // 학과/입학 관련
    if (lowerQuery.match(/학과|전공|학부|입학|모집|전형|지원|입시/)) {
        return { 
            type: 'department_admission', 
            priority: 'website',
            confidence: 0.8 
        };
    }
    
    // 수강신청/학사일정 관련
    if (lowerQuery.match(/수강신청|강의신청|등록|학사일정|일정|신청기간/)) {
        return { 
            type: 'registration_schedule', 
            priority: 'announcement',
            confidence: 0.9 
        };
    }
    
    // 시설/캠퍼스 관련
    if (lowerQuery.match(/도서관|기숙사|생활관|캠퍼스|위치|건물|시설/)) {
        return { 
            type: 'facility_campus', 
            priority: 'website',
            confidence: 0.7 
        };
    }
    
    // 일반 정보
    return { 
        type: 'general', 
        priority: null,
        confidence: 0.5 
    };
}

// 🧠 스마트 라우팅 검색 (개선됨)
async function smartRoutingSearchOptimized(query, limit = 8) {
    try {
        const classification = classifyQuestionOptimized(query);
        console.log(`[스마트 라우팅] 타입: ${classification.type}, 우선순위: ${classification.priority}, 신뢰도: ${classification.confidence}`);
        
        let results = [];
        
        if (classification.priority && classification.confidence > 0.7) {
            // 고신뢰도: 우선순위 소스 집중 검색
            results = await adaptiveSearchOptimized(query, Math.ceil(limit * 0.8), classification.priority);
            console.log(`[스마트 라우팅] 우선순위(${classification.priority}): ${results.length}개`);
            
            if (results.length < 2) {
                const additionalResults = await adaptiveSearchOptimized(query, limit - results.length, null);
                console.log(`[스마트 라우팅] 전체 보완: ${additionalResults.length}개`);
                
                const existingIds = new Set(results.map(doc => doc.id));
                const newResults = additionalResults.filter(doc => !existingIds.has(doc.id));
                results = [...results, ...newResults];
            }
        } else {
            // 저신뢰도: 전체 검색
            results = await adaptiveSearchOptimized(query, limit, null);
        }
        
        console.log(`[스마트 라우팅] 최종: ${results.length}개 문서`);
        return results;
        
    } catch (error) {
        console.error('스마트 라우팅 실패:', error);
        return await adaptiveSearchOptimized(query, limit, null);
    }
}

// 💾 컴팩트 컨텍스트 생성 (메모리 최적화)
function createCompactContext(documents) {
    if (!documents || documents.length === 0) {
        return '관련 정보를 찾을 수 없습니다.';
    }

    let context = '';
    const maxContextLength = 3000; // 컨텍스트 길이 제한
    let currentLength = 0;
    
    documents.forEach((doc, index) => {
        if (currentLength >= maxContextLength) return;
        
        const docContent = `[문서 ${index + 1}] ${doc.content}\n\n`;
        
        if (currentLength + docContent.length <= maxContextLength) {
            context += docContent;
            currentLength += docContent.length;
        } else {
            // 남은 공간에 맞게 문서 내용 잘라내기
            const remainingSpace = maxContextLength - currentLength;
            if (remainingSpace > 100) {
                const truncatedContent = doc.content.substring(0, remainingSpace - 50) + '...';
                context += `[문서 ${index + 1}] ${truncatedContent}\n\n`;
            }
            return;
        }
    });

    return context;
}

// ⚡ 최적화된 Claude 응답 생성
async function generateOptimizedResponse(userMessage, context) {
    const cacheKey = `response_${userMessage}_${context.substring(0, 50)}`;
    
    // 응답 캐시 확인
    if (responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[응답 캐시 HIT] "${userMessage}"`);
            return cached.data;
        }
        responseCache.delete(cacheKey);
    }

    const systemPrompt = `당신은 대진대학교의 친근한 AI 챗봇 '우진이'입니다. 다음 지침을 따라주세요:

1. 제공된 정보를 바탕으로 정확하고 유용한 답변을 제공하세요
2. 한국어로 친근하고 자연스럽게 답변하세요  
3. 구체적이고 실용적인 정보를 우선적으로 제공하세요
4. 정보가 부족하면 솔직하게 말하고 추가 질문을 유도하세요
5. 답변은 간결하되 필요한 정보는 빠뜨리지 마세요

관련 정보:
${context}`;

    try {
        console.log(`[Claude 최적화] 요청 시작 - 컨텍스트: ${context.length}자`);
        
        const startTime = Date.now();
        
        const message = await anthropic.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 1500,  // 토큰 수 최적화
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userMessage
                }
            ]
        });

        const responseTime = Date.now() - startTime;
        const responseText = message.content[0].text;
        
        console.log(`[Claude 최적화] 완료 - ${responseTime}ms, ${responseText.length}자`);
        
        // 응답 캐시 저장
        responseCache.set(cacheKey, {
            data: responseText,
            timestamp: Date.now()
        });
        
        return responseText;
        
    } catch (error) {
        console.error('Claude 최적화 오류:', error);
        
        if (error.status === 529 || error.message.includes('Overloaded')) {
            return generateFallbackResponseOptimized(userMessage, context);
        }
        
        throw error;
    }
}

// 개선된 폴백 응답
function generateFallbackResponseOptimized(userMessage, context) {
    console.log('[최적화 Fallback] 응답 생성');
    
    if (userMessage.includes('안녕') || userMessage.includes('하이')) {
        return '안녕하세요! 🎓 대진대학교 챗봇 우진이입니다.\n\n현재 AI 서비스가 일시 과부하 상태입니다. 곧 정상화될 예정이니 잠시만 기다려주세요! 😊';
    }
    
    if (context && context !== '관련 정보를 찾을 수 없습니다.') {
        const summary = context.substring(0, 300).replace(/\[문서 \d+\]/g, '').trim();
        return `"${userMessage}"에 대한 정보를 찾았습니다!\n\n${summary}...\n\n💡 더 정확한 답변을 위해 잠시 후 다시 질문해주세요.`;
    }
    
    return `"${userMessage}"에 대해 질문해주셨네요.\n\n현재 AI 서비스 일시 과부하로 상세 답변이 어렵습니다.\n\n• 좀 더 구체적인 질문으로 다시 시도해보세요\n• 교수님, 수강신청, 시간표 등 키워드를 포함해보세요\n\n감사합니다! 🙂`;
}

// 🧹 캐시 정리 함수
function cleanupCache() {
    const now = Date.now();
    
    // 검색 캐시 정리
    for (const [key, value] of searchCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            searchCache.delete(key);
        }
    }
    
    // 응답 캐시 정리
    for (const [key, value] of responseCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            responseCache.delete(key);
        }
    }
    
    console.log(`[캐시 정리] 검색 캐시: ${searchCache.size}개, 응답 캐시: ${responseCache.size}개`);
}

// 10분마다 캐시 정리
setInterval(cleanupCache, 10 * 60 * 1000);

// 📊 성능 모니터링 미들웨어
app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
});

// API 라우트

// 건강 체크 (최적화 정보 포함)
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        version: '2.0.0-optimized',
        port: PORT,
        cache: {
            searchCache: searchCache.size,
            responseCache: responseCache.size
        },
        timestamp: new Date().toISOString()
    });
});

// 최적화된 검색 API
app.post('/api/search', async (req, res) => {
    try {
        const { query, limit = 5, sourceType = null } = req.body;

        if (!query) {
            return res.status(400).json({ error: '검색어가 필요합니다.' });
        }

        const documents = await smartRoutingSearchOptimized(query, limit);
        
        const responseTime = Date.now() - req.startTime;
        
        res.json({
            query,
            documents,
            total: documents.length,
            performance: {
                responseTime: `${responseTime}ms`,
                cached: searchCache.has(`search_${query}_${limit}_${sourceType || 'all'}`)
            }
        });

    } catch (error) {
        console.error('최적화 검색 API 오류:', error);
        res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
    }
});

// 최적화된 챗봇 API
app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;

        if (!message) {
            return res.status(400).json({ error: '메시지가 필요합니다.' });
        }

        console.log(`[최적화 챗봇] 질문: ${message}`);

        // 병렬 처리를 위한 검색 시작
        const searchPromise = smartRoutingSearchOptimized(message, 6);
        
        const documents = await searchPromise;
        console.log(`[최적화 챗봇] 검색 완료: ${documents.length}개 문서`);

        // 컴팩트 컨텍스트 생성
        const context = createCompactContext(documents);
        console.log(`[최적화 챗봇] 컨텍스트: ${context.length}자`);

        // 최적화된 응답 생성
        const response = await generateOptimizedResponse(message, context);
        
        const responseTime = Date.now() - req.startTime;
        console.log(`[최적화 챗봇] 완료: ${responseTime}ms`);

        res.json({
            response: response,
            context: documents.map(doc => ({
                source: doc.source_file?.substring(0, 30) + '...',
                similarity: doc.similarity,
                score: doc.combined_score
            })),
            performance: {
                responseTime: `${responseTime}ms`,
                documentsFound: documents.length,
                contextLength: context.length
            }
        });

    } catch (error) {
        console.error('최적화 챗봇 API 오류:', error);
        res.status(500).json({ 
            error: '챗봇 서비스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            performance: {
                responseTime: `${Date.now() - req.startTime}ms`,
                errorType: error.constructor.name
            }
        });
    }
});

// 성능 통계 API
app.get('/api/performance', (req, res) => {
    res.json({
        cache: {
            search: {
                size: searchCache.size,
                hitRate: 'N/A' // 실제 구현에서는 히트율 계산
            },
            response: {
                size: responseCache.size,
                hitRate: 'N/A'
            }
        },
        memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// 캐시 수동 정리 API
app.post('/api/cache/clear', (req, res) => {
    searchCache.clear();
    responseCache.clear();
    
    res.json({
        message: '캐시가 정리되었습니다.',
        timestamp: new Date().toISOString()
    });
});

// 프론트엔드 라우팅
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 최적화된 대진대학교 챗봇이 포트 ${PORT}에서 실행 중입니다!`);
    console.log(`📱 테스트 접속: http://localhost:${PORT}`);
    console.log(`⚡ 성능 개선사항:`);
    console.log(`   - 검색 임계값 최적화 (0.05~0.12)`);
    console.log(`   - 응답/검색 결과 캐싱 (5분)`);
    console.log(`   - 컴팩트 컨텍스트 생성`);
    console.log(`   - 메모리 사용량 최적화`);
    console.log(`   - 성능 모니터링 내장`);
});

// 종료 시 정리
process.on('SIGTERM', () => {
    console.log('최적화 서버를 종료합니다...');
    searchCache.clear();
    responseCache.clear();
    process.exit(0);
});

module.exports = app;