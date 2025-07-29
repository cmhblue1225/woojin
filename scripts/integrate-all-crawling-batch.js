// 대규모 크롤링 데이터 배치 통합 스크립트 (26,025개 파일)
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
    MIN_CONTENT_LENGTH: 100,
    MAX_FILES_PER_DIR: 1000, // 디렉토리당 최대 처리 파일 수
    DELAY_BETWEEN_BATCHES: 2000, // 2초 대기
};

// 크롤링 데이터 디렉토리 (우선순위 순)
const CRAWLING_DIRS = [
    {
        name: 'enhanced_strategic_output',
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_strategic_output',
        prefix: 'enhanced_strategic_page_',
        sourceType: 'website',
        priority: 1
    },
    {
        name: 'strategic_output', 
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/strategic_output',
        prefix: 'strategic_page_',
        sourceType: 'website',
        priority: 2
    },
    {
        name: 'enhanced_output',
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_output',
        prefix: 'page_',
        sourceType: 'website',
        priority: 3
    },
    {
        name: 'unlimited_crawling_output',
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/unlimited_crawling_output', 
        prefix: 'unlimited_page_',
        sourceType: 'website',
        priority: 4
    }
];

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

// 컨텐츠 정제 및 품질 필터링
function processContent(content) {
    // 기본 정제
    const cleanPatterns = [
        /^\/WEB-INF\/jsp\/.*$/gm,
        /^[a-zA-Z0-9_]+_JW_MS_K2WT\d+_[MN]$/gm,
        /메뉴|네비게이션|바로가기|이전|다음|TOP|닫기/g,
        /^\s*\n+/gm,
        /\n{3,}/g
    ];
    
    let cleaned = content;
    cleanPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
    });
    
    cleaned = cleaned.trim();
    
    // 품질 검사: 의미있는 내용인지 확인
    const meaningfulKeywords = [
        '대학교', '학과', '전공', '교수', '학생', '교육', '연구', '프로그램',
        '입학', '졸업', '수강', '강의', '시간표', '공지', '일정', '센터',
        '도서관', '기숙사', '장학', '취업', '국제', '교류', '안내', '소개',
        '모집', '신청', '등록', '대학원', '학부', '과정', '학회', '행사'
    ];
    
    const hasMeaningfulContent = meaningfulKeywords.some(keyword => 
        cleaned.includes(keyword)
    );
    
    if (!hasMeaningfulContent || cleaned.length < CONFIG.MIN_CONTENT_LENGTH) {
        return null;
    }
    
    return cleaned;
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
async function processFile(filePath, sourceType) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        if (!content.trim()) return [];
        
        const { metadata, content: actualContent } = parseMetadata(content);
        const processedContent = processContent(actualContent);
        
        if (!processedContent) return [];
        
        const chunks = splitIntoChunks(processedContent);
        const fileName = path.basename(filePath);
        
        return chunks.map((chunk, index) => ({
            content: chunk,
            source_file: chunks.length > 1 ? `${fileName}_chunk_${index + 1}` : fileName,
            source_type: sourceType,
            metadata: metadata,
            url: metadata.url || null,
            domain: metadata.domain || null
        }));
        
    } catch (error) {
        return [];
    }
}

// 임베딩 생성 및 저장
async function processAndSaveDocuments(documents, batchInfo) {
    console.log(`🔄 배치 ${batchInfo} - ${documents.length}개 문서 임베딩 생성 중...`);
    
    for (let i = 0; i < documents.length; i += CONFIG.BATCH_SIZE) {
        const batch = documents.slice(i, i + CONFIG.BATCH_SIZE);
        
        try {
            // 임베딩 생성
            const embeddings = await openai.embeddings.create({
                model: CONFIG.EMBEDDING_MODEL,
                input: batch.map(doc => doc.content),
                encoding_format: "float",
            });
            
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
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ 배치 처리 실패:`, error.message);
            throw error;
        }
    }
}

// 디렉토리별 처리
async function processDirectory(dirConfig) {
    const { name, path: dirPath, prefix, sourceType } = dirConfig;
    
    try {
        console.log(`\n📁 처리 시작: ${name}`);
        
        const files = await fs.readdir(dirPath);
        const txtFiles = files
            .filter(file => file.startsWith(prefix) && file.endsWith('.txt'))
            .sort()
            .slice(0, CONFIG.MAX_FILES_PER_DIR); // 제한 적용
        
        console.log(`📄 처리 대상: ${txtFiles.length}개 파일`);
        
        if (txtFiles.length === 0) {
            return { processed: 0, documents: 0 };
        }
        
        let totalDocuments = 0;
        let processedFiles = 0;
        
        // 100개씩 배치 처리
        for (let i = 0; i < txtFiles.length; i += 100) {
            const fileBatch = txtFiles.slice(i, i + 100);
            const batchDocuments = [];
            
            console.log(`\n📦 파일 배치 ${Math.floor(i / 100) + 1}/${Math.ceil(txtFiles.length / 100)} 처리 중...`);
            
            for (const file of fileBatch) {
                const filePath = path.join(dirPath, file);
                const documents = await processFile(filePath, sourceType);
                batchDocuments.push(...documents);
                processedFiles++;
                
                if (processedFiles % 50 === 0) {
                    console.log(`📊 진행률: ${processedFiles}/${txtFiles.length} 파일 처리됨`);
                }
            }
            
            if (batchDocuments.length > 0) {
                const batchInfo = `${name}-${Math.floor(i / 100) + 1}`;
                await processAndSaveDocuments(batchDocuments, batchInfo);
                totalDocuments += batchDocuments.length;
                
                // 배치 간 대기
                await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES));
            }
        }
        
        console.log(`✅ ${name} 완료: ${processedFiles}개 파일 → ${totalDocuments}개 문서`);
        return { processed: processedFiles, documents: totalDocuments };
        
    } catch (error) {
        console.error(`❌ ${name} 처리 실패:`, error.message);
        return { processed: 0, documents: 0, error: error.message };
    }
}

// 진행상황 저장
async function saveProgress(progress) {
    const progressFile = '/Users/minhyuk/Desktop/우진봇/integration-progress.json';
    await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));
}

// 메인 실행 함수
async function main() {
    console.log('🚀 대규모 크롤링 데이터 통합 시작...\n');
    console.log(`📋 처리 계획: ${CRAWLING_DIRS.length}개 디렉토리`);
    
    const startTime = Date.now();
    const results = [];
    
    try {
        // 초기 상태 확인
        const { count: initialCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });
        
        console.log(`📊 통합 전 문서 수: ${initialCount}개\n`);
        
        // 각 디렉토리 순차 처리
        for (const dirConfig of CRAWLING_DIRS) {
            const result = await processDirectory(dirConfig);
            result.directory = dirConfig.name;
            results.push(result);
            
            // 중간 진행상황 저장
            await saveProgress({
                timestamp: new Date().toISOString(),
                completed_directories: results,
                total_directories: CRAWLING_DIRS.length
            });
            
            console.log(`\n⏱️  현재까지 소요 시간: ${Math.round((Date.now() - startTime) / 1000 / 60)}분`);
        }
        
        // 최종 확인
        const { count: finalCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });
        
        const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
        const totalDocuments = results.reduce((sum, r) => sum + r.documents, 0);
        
        console.log('\n🎉 대규모 통합 완료!');
        console.log(`📊 최종 결과:`);
        console.log(`  - 처리된 파일: ${totalProcessed}개`);
        console.log(`  - 생성된 문서: ${totalDocuments}개`);
        console.log(`  - 통합 전 DB: ${initialCount}개`);
        console.log(`  - 통합 후 DB: ${finalCount}개`);
        console.log(`  - 실제 추가: ${finalCount - initialCount}개`);
        console.log(`  - 총 소요시간: ${Math.round((Date.now() - startTime) / 1000 / 60)}분`);
        
        // 디렉토리별 상세 결과
        console.log('\n📁 디렉토리별 결과:');
        results.forEach(result => {
            if (result.error) {
                console.log(`  ❌ ${result.directory}: 오류 - ${result.error}`);
            } else {
                console.log(`  ✅ ${result.directory}: ${result.processed}개 파일 → ${result.documents}개 문서`);
            }
        });
        
        return {
            success: true,
            totalFiles: totalProcessed,
            totalDocuments: totalDocuments,
            finalCount: finalCount,
            addedDocuments: finalCount - initialCount,
            processingTime: Math.round((Date.now() - startTime) / 1000 / 60),
            results: results
        };
        
    } catch (error) {
        console.error('\n❌ 통합 프로세스 실패:', error.message);
        await saveProgress({
            timestamp: new Date().toISOString(),
            error: error.message,
            completed_directories: results,
            total_directories: CRAWLING_DIRS.length
        });
        throw error;
    }
}

// 실행
if (require.main === module) {
    main()
        .then((result) => {
            console.log('\n✅ 대규모 통합 성공적으로 완료!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 프로그램 오류:', error.message);
            process.exit(1);
        });
}

module.exports = { main };