// unlimited_crawling_output 대량 데이터 안전 통합 스크립트
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

// API 클라이언트 초기화
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const CONFIG = {
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    CHUNK_SIZE: 800,
    CHUNK_OVERLAP: 100,
    BATCH_SIZE: 15, // 안전한 배치 크기
    MIN_CONTENT_LENGTH: 150, // 더 엄격한 최소 길이
    DELAY_BETWEEN_BATCHES: 2000, // 2초 대기 (고속 처리)
    SAMPLE_CHECK_SIZE: 500, // 품질 사전 체크용 샘플 크기
};

// 더 엄격한 품질 필터링
function strictQualityFilter(content) {
    // 기본 정제
    const cleanPatterns = [
        /^\/WEB-INF\/jsp\/.*$/gm,
        /^[a-zA-Z0-9_]+_JW_MS_K2WT\d+_[MN]$/gm,
        /메뉴|네비게이션|바로가기|이전|다음|TOP|닫기|더보기|목록|검색/g,
        /^\s*\n+/gm,
        /\n{3,}/g,
        /Login|Language|KOR|ENG|CHN|Popup/g, // 자주 나오는 UI 요소
        /상단팝업|팝업건수|오늘하루|슬라이드/g,
        /Copyright|All Rights Reserved/gi
    ];
    
    let cleaned = content;
    cleanPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
    });
    cleaned = cleaned.trim();
    
    // 더 엄격한 키워드 검사 (최소 2개 이상 포함)
    const meaningfulKeywords = [
        '대학교', '학과', '전공', '교수', '학생', '교육', '연구', '프로그램',
        '입학', '졸업', '수강', '강의', '시간표', '공지', '일정', '센터',
        '도서관', '기숙사', '장학', '취업', '국제', '교류', '안내', '소개',
        '모집', '신청', '등록', '대학원', '학부', '과정', '학회', '행사',
        '학술', '세미나', '특강', '워크샵', '컨퍼런스', '발표', '논문',
        '캠퍼스', '건물', '시설', '실습', '인턴십', '진로', '상담'
    ];
    
    const keywordCount = meaningfulKeywords.filter(keyword => 
        cleaned.includes(keyword)
    ).length;
    
    // 조건: 최소 길이 + 키워드 2개 이상 + 실질적 내용
    if (cleaned.length < CONFIG.MIN_CONTENT_LENGTH || keywordCount < 2) {
        return null;
    }
    
    // 너무 반복적인 내용 필터링
    const lines = cleaned.split('\n').filter(line => line.trim().length > 0);
    const uniqueLines = new Set(lines);
    const repetitionRatio = uniqueLines.size / lines.length;
    
    if (repetitionRatio < 0.5) { // 50% 이상이 중복 라인이면 제외
        return null;
    }
    
    return cleaned;
}

// 메타데이터 파싱
function parseMetadata(content) {
    const lines = content.split('\n');
    const metadata = {};
    let contentStart = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('[') && line.endsWith(']')) {
            const match = line.match(/\[(\w+)\]\s*(.+)/);
            if (match) {
                metadata[match[1].toLowerCase()] = match[2];
            }
            contentStart = i + 1;
        } else if (line === '') {
            contentStart = i + 1;
            break;
        }
    }
    
    const actualContent = lines.slice(contentStart).join('\n').trim();
    return { metadata, content: actualContent };
}

// 컨텐츠를 청크로 분할
function splitIntoChunks(content, chunkSize = CONFIG.CHUNK_SIZE, overlap = CONFIG.CHUNK_OVERLAP) {
    if (content.length <= chunkSize) {
        return [content];
    }
    
    const chunks = [];
    let start = 0;
    
    while (start < content.length) {
        let end = start + chunkSize;
        
        if (end < content.length) {
            const nextSpace = content.indexOf(' ', end);
            const nextNewline = content.indexOf('\n', end);
            
            if (nextSpace !== -1 && (nextNewline === -1 || nextSpace < nextNewline)) {
                end = nextSpace;
            } else if (nextNewline !== -1) {
                end = nextNewline;
            }
        }
        
        chunks.push(content.substring(start, end).trim());
        start = end - overlap;
        
        if (start >= content.length) break;
    }
    
    return chunks.filter(chunk => chunk.length >= CONFIG.MIN_CONTENT_LENGTH);
}

// 단일 파일 처리
async function processFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        if (!content.trim()) return [];
        
        const { metadata, content: actualContent } = parseMetadata(content);
        const processedContent = strictQualityFilter(actualContent);
        
        if (!processedContent) return [];
        
        const chunks = splitIntoChunks(processedContent);
        const fileName = path.basename(filePath);
        
        return chunks.map((chunk, index) => ({
            content: chunk,
            source_file: chunks.length > 1 ? `${fileName}_chunk_${index + 1}` : fileName,
            source_type: 'website',
            metadata: metadata,
            url: metadata.url || null,
            domain: metadata.domain || null
        }));
        
    } catch (error) {
        return [];
    }
}

// 사전 품질 체크 (샘플링)
async function preQualityCheck() {
    console.log('🔍 사전 품질 체크 중...');
    
    const dirPath = '/Users/minhyuk/Desktop/우진봇/crawlingTest/unlimited_crawling_output';
    const files = await fs.readdir(dirPath);
    const txtFiles = files
        .filter(file => file.startsWith('unlimited_page_') && file.endsWith('.txt'))
        .sort();
    
    const sampleSize = Math.min(CONFIG.SAMPLE_CHECK_SIZE, txtFiles.length);
    const sampleFiles = [];
    
    // 균등하게 샘플링
    for (let i = 0; i < sampleSize; i++) {
        const index = Math.floor((i / sampleSize) * txtFiles.length);
        sampleFiles.push(txtFiles[index]);
    }
    
    let qualityStats = {
        total: 0,
        passed: 0,
        tooShort: 0,
        noKeywords: 0,
        repetitive: 0
    };
    
    for (const file of sampleFiles) {
        const filePath = path.join(dirPath, file);
        const documents = await processFile(filePath);
        
        qualityStats.total++;
        if (documents.length > 0) {
            qualityStats.passed++;
        } else {
            // 실패 이유 분석
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const { content: actualContent } = parseMetadata(content);
                
                if (actualContent.length < CONFIG.MIN_CONTENT_LENGTH) {
                    qualityStats.tooShort++;
                } else {
                    qualityStats.noKeywords++;
                }
            } catch (error) {
                qualityStats.noKeywords++;
            }
        }
    }
    
    const passRate = (qualityStats.passed / qualityStats.total * 100).toFixed(1);
    
    console.log(`📊 사전 품질 체크 결과 (샘플 ${qualityStats.total}개):`);
    console.log(`✅ 통과: ${qualityStats.passed}개 (${passRate}%)`);
    console.log(`❌ 너무 짧음: ${qualityStats.tooShort}개`);
    console.log(`❌ 키워드 부족: ${qualityStats.noKeywords}개`);
    
    const estimatedGoodFiles = Math.round(txtFiles.length * qualityStats.passed / qualityStats.total);
    const estimatedDocuments = Math.round(estimatedGoodFiles * 1.5); // 청크 분할 고려
    
    console.log(`\n📈 예상 결과:`);
    console.log(`- 예상 통과 파일: ${estimatedGoodFiles}개`);
    console.log(`- 예상 생성 문서: ${estimatedDocuments}개`);
    
    return { passRate: parseFloat(passRate), estimatedDocuments, totalFiles: txtFiles.length };
}

// 임베딩 생성 및 저장
async function processAndSaveDocuments(documents, batchInfo) {
    console.log(`🔄 배치 ${batchInfo} - ${documents.length}개 문서 임베딩 생성 중...`);
    
    for (let i = 0; i < documents.length; i += CONFIG.BATCH_SIZE) {
        const batch = documents.slice(i, i + CONFIG.BATCH_SIZE);
        
        let embeddings;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                // 임베딩 생성 (타임아웃 설정)
                embeddings = await Promise.race([
                    openai.embeddings.create({
                        model: CONFIG.EMBEDDING_MODEL,
                        input: batch.map(doc => doc.content),
                        encoding_format: "float",
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Request timeout')), 60000)
                    )
                ]);
                break; // 성공시 루프 탈출
            } catch (error) {
                retryCount++;
                console.log(`⚠️ API 오류 (시도 ${retryCount}/${maxRetries}): ${error.message}`);
                
                if (retryCount >= maxRetries) {
                    throw error; // 최대 재시도 횟수 도달시 오류 던지기
                }
                
                // 지수 백오프: 1초, 2초, 4초 대기 (고속 처리)
                const waitTime = Math.pow(2, retryCount) * 500;
                console.log(`⏳ ${waitTime/1000}초 후 재시도...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        try {
            // 데이터베이스 저장
            const docsWithEmbeddings = batch.map((doc, index) => ({
                content: doc.content,
                source_file: doc.source_file,
                source_type: doc.source_type,
                embedding: embeddings.data[index].embedding,
                metadata: {
                    url: doc.url,
                    domain: doc.domain,
                    ...doc.metadata
                }
            }));
            
            const { error } = await supabase
                .from('documents')
                .insert(docsWithEmbeddings);
            
            if (error) throw error;
            
            console.log(`✅ 소배치 ${Math.floor(i / CONFIG.BATCH_SIZE) + 1} 완료 (${batch.length}개)`);
            
            // API 대기
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error(`❌ 배치 처리 실패:`, error.message);
            throw error;
        }
    }
}

// 진행상황 저장
async function saveProgress(progress) {
    const progressFile = '/Users/minhyuk/Desktop/우진봇/unlimited-integration-progress.json';
    await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));
}

// 메인 실행 함수
async function main() {
    console.log('🚀 unlimited_crawling_output 대량 데이터 안전 통합 시작...\n');
    
    const startTime = Date.now();
    
    try {
        // 1. 사전 품질 체크
        const qualityCheck = await preQualityCheck();
        
        if (qualityCheck.passRate < 5) {
            console.log(`⚠️ 품질 통과율이 너무 낮습니다 (${qualityCheck.passRate}%). 진행을 중단합니다.`);
            return;
        }
        
        console.log(`\n🎯 품질 체크 통과! 예상 ${qualityCheck.estimatedDocuments}개 문서 생성 예정\n`);
        
        // 2. 초기 상태 확인
        const { count: initialCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });
        
        console.log(`📊 통합 전 문서 수: ${initialCount}개`);
        
        // 3. 파일 목록 가져오기
        const dirPath = '/Users/minhyuk/Desktop/우진봇/crawlingTest/unlimited_crawling_output';
        const files = await fs.readdir(dirPath);
        const txtFiles = files
            .filter(file => file.startsWith('unlimited_page_') && file.endsWith('.txt'))
            .sort();
        
        console.log(`📁 처리 대상: ${txtFiles.length}개 파일\n`);
        
        // 4. 중단된 지점 확인
        let startBatch = 0;
        let totalProcessed = 0;
        let totalDocuments = 0;
        
        try {
            const progressData = await fs.readFile('/Users/minhyuk/Desktop/우진봇/unlimited-integration-progress.json', 'utf-8');
            const progress = JSON.parse(progressData);
            startBatch = progress.current_batch || 0;
            totalProcessed = progress.processed_files || 0;
            totalDocuments = progress.generated_documents || 0;
            
            if (startBatch > 0) {
                console.log(`🔄 중단된 지점부터 재시작: 배치 ${startBatch + 1}부터 시작`);
                console.log(`📊 기존 진행률: ${totalProcessed}/${txtFiles.length} 파일, ${totalDocuments}개 문서`);
            }
        } catch (error) {
            console.log('📝 새로운 통합 작업 시작');
        }
        
        // 5. 500개씩 배치 처리 (중단된 지점부터)
        const batchSize = 500;
        const startIndex = startBatch * batchSize;
        for (let i = startIndex; i < txtFiles.length; i += batchSize) {
            const fileBatch = txtFiles.slice(i, i + batchSize);
            const batchDocuments = [];
            
            console.log(`\n📦 파일 배치 ${Math.floor(i / batchSize) + 1}/${Math.ceil(txtFiles.length / batchSize)} 처리 중...`);
            console.log(`📄 파일 범위: ${fileBatch[0]} ~ ${fileBatch[fileBatch.length - 1]}`);
            
            // 배치 내 파일들 처리
            for (const file of fileBatch) {
                const filePath = path.join(dirPath, file);
                const documents = await processFile(filePath);
                batchDocuments.push(...documents);
                totalProcessed++;
                
                if (totalProcessed % 100 === 0) {
                    console.log(`📊 진행률: ${totalProcessed}/${txtFiles.length} 파일 처리됨 (${(totalProcessed/txtFiles.length*100).toFixed(1)}%)`);
                }
            }
            
            // 임베딩 생성 및 저장
            if (batchDocuments.length > 0) {
                const batchInfo = `unlimited-${Math.floor(i / batchSize) + 1}`;
                await processAndSaveDocuments(batchDocuments, batchInfo);
                totalDocuments += batchDocuments.length;
                
                console.log(`✅ 배치 완료: ${batchDocuments.length}개 문서 추가 (누적: ${totalDocuments}개)`);
                
                // 진행상황 저장
                await saveProgress({
                    timestamp: new Date().toISOString(),
                    processed_files: totalProcessed,
                    total_files: txtFiles.length,
                    generated_documents: totalDocuments,
                    current_batch: Math.floor(i / batchSize) + 1,
                    total_batches: Math.ceil(txtFiles.length / batchSize)
                });
                
                // 배치 간 대기
                await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES));
            }
        }
        
        // 5. 최종 확인
        const { count: finalCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });
        
        const processingTime = Math.round((Date.now() - startTime) / 1000 / 60);
        
        console.log('\n🎉 unlimited_crawling_output 통합 완료!');
        console.log(`📊 최종 결과:`);
        console.log(`  - 처리된 파일: ${totalProcessed}개`);
        console.log(`  - 생성된 문서: ${totalDocuments}개`);
        console.log(`  - 통합 전 DB: ${initialCount}개`);
        console.log(`  - 통합 후 DB: ${finalCount}개`);
        console.log(`  - 실제 추가: ${finalCount - initialCount}개`);
        console.log(`  - 품질 통과율: ${(totalDocuments > 0 ? totalProcessed/txtFiles.length*100 : 0).toFixed(1)}%`);
        console.log(`  - 총 소요시간: ${processingTime}분`);
        
        return {
            success: true,
            processedFiles: totalProcessed,
            generatedDocuments: totalDocuments,
            finalCount: finalCount,
            addedDocuments: finalCount - initialCount,
            processingTime: processingTime
        };
        
    } catch (error) {
        console.error('\n❌ 통합 프로세스 실패:', error.message);
        throw error;
    }
}

// 실행
if (require.main === module) {
    main()
        .then((result) => {
            console.log('\n✅ unlimited_crawling_output 통합 성공!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 프로그램 오류:', error.message);
            process.exit(1);
        });
}

module.exports = { main };