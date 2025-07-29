// 샘플 크롤링 데이터만 빠르게 통합하여 테스트하는 스크립트
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
    CHUNK_SIZE: parseInt(process.env.CHUNK_SIZE) || 800,
    CHUNK_OVERLAP: parseInt(process.env.CHUNK_OVERLAP) || 100,
    BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 20,
    MIN_CONTENT_LENGTH: 100,
    MAX_SAMPLE_FILES: 500, // 샘플 파일 수 제한
};

// 샘플 크롤링 데이터 디렉토리 (빠른 테스트를 위해)
const SAMPLE_DIRS = [
    {
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_strategic_output',
        prefix: 'enhanced_strategic_page_',
        sourceType: 'website',
        maxFiles: 300
    },
    {
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/strategic_output',
        prefix: 'strategic_page_',
        sourceType: 'website',
        maxFiles: 118
    }
];

// 메타데이터 파싱 함수
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

// 컨텐츠 정제 함수
function cleanContent(content) {
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
    
    return cleaned.trim();
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
        const cleanedContent = cleanContent(actualContent);
        
        if (cleanedContent.length < CONFIG.MIN_CONTENT_LENGTH) {
            return [];
        }
        
        const chunks = splitIntoChunks(cleanedContent);
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

// 임베딩 생성
async function createEmbeddings(documents) {
    const results = [];
    
    for (let i = 0; i < documents.length; i += CONFIG.BATCH_SIZE) {
        const batch = documents.slice(i, i + CONFIG.BATCH_SIZE);
        console.log(`🔄 임베딩 생성 중... (${i + 1}-${Math.min(i + CONFIG.BATCH_SIZE, documents.length)}/${documents.length})`);
        
        try {
            const embeddings = await openai.embeddings.create({
                model: CONFIG.EMBEDDING_MODEL,
                input: batch.map(doc => doc.content),
                encoding_format: "float",
            });
            
            const batchResults = batch.map((doc, index) => ({
                ...doc,
                embedding: embeddings.data[index].embedding
            }));
            
            results.push(...batchResults);
            
            if (i + CONFIG.BATCH_SIZE < documents.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
        } catch (error) {
            console.error(`❌ 임베딩 생성 실패:`, error.message);
            throw error;
        }
    }
    
    return results;
}

// 데이터베이스에 저장
async function saveToDatabase(documents) {
    console.log(`💾 데이터베이스에 ${documents.length}개 문서 저장 중...`);
    
    for (let i = 0; i < documents.length; i += CONFIG.BATCH_SIZE) {
        const batch = documents.slice(i, i + CONFIG.BATCH_SIZE);
        
        try {
            const { error } = await supabase
                .from('documents')
                .insert(batch.map(doc => ({
                    content: doc.content,
                    source_file: doc.source_file,
                    source_type: doc.source_type,
                    embedding: doc.embedding,
                    metadata: {
                        url: doc.url,
                        domain: doc.domain,
                        ...doc.metadata
                    }
                })));
            
            if (error) throw error;
            
            console.log(`✅ 배치 ${Math.floor(i / CONFIG.BATCH_SIZE) + 1} 저장 완료 (${batch.length}개 문서)`);
            
        } catch (error) {
            console.error(`❌ 데이터베이스 저장 실패:`, error.message);
            throw error;
        }
    }
}

// 샘플 디렉토리 처리
async function processSampleDirectory(dirConfig) {
    const { path: dirPath, prefix, sourceType, maxFiles } = dirConfig;
    
    try {
        const files = await fs.readdir(dirPath);
        const txtFiles = files
            .filter(file => file.startsWith(prefix) && file.endsWith('.txt'))
            .sort()
            .slice(0, maxFiles); // 샘플 제한
        
        console.log(`\n📁 샘플 처리 중: ${dirPath}`);
        console.log(`📄 처리할 파일: ${txtFiles.length}개 (최대 ${maxFiles}개)`);
        
        if (txtFiles.length === 0) {
            return [];
        }
        
        const allDocuments = [];
        
        for (const file of txtFiles) {
            const filePath = path.join(dirPath, file);
            const documents = await processFile(filePath, sourceType);
            allDocuments.push(...documents);
        }
        
        console.log(`✅ ${dirPath} 처리 완료: ${allDocuments.length}개 문서 생성`);
        return allDocuments;
        
    } catch (error) {
        console.error(`❌ 디렉토리 처리 실패: ${dirPath}`, error.message);
        return [];
    }
}

// 기존 데이터에 추가
async function addToExistingData(documents) {
    console.log('➕ 기존 데이터에 새 문서 추가...');
    
    // 기존 문서 수 확인
    const { count: existingCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
    
    console.log(`📊 기존 문서 수: ${existingCount}개`);
    console.log(`📊 추가할 문서 수: ${documents.length}개`);
    
    // 임베딩 생성 및 저장
    const documentsWithEmbeddings = await createEmbeddings(documents);
    await saveToDatabase(documentsWithEmbeddings);
    
    // 최종 확인
    const { count: finalCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
    
    console.log(`✅ 최종 문서 수: ${finalCount}개 (${finalCount - existingCount}개 추가됨)`);
}

// 메인 실행 함수
async function main() {
    console.log('🚀 샘플 크롤링 데이터 통합 시작...\n');
    
    try {
        // 모든 샘플 디렉토리 처리
        console.log('📁 샘플 크롤링 데이터 처리 시작...');
        const allDocuments = [];
        
        for (const dirConfig of SAMPLE_DIRS) {
            const documents = await processSampleDirectory(dirConfig);
            allDocuments.push(...documents);
        }
        
        console.log(`\n📊 샘플 데이터 통계:`);
        console.log(`  - 총 처리된 문서: ${allDocuments.length}개`);
        console.log(`  - 평균 문서 길이: ${Math.round(allDocuments.reduce((acc, doc) => acc + doc.content.length, 0) / allDocuments.length)}자`);
        
        // 소스 타입별 통계
        const sourceStats = allDocuments.reduce((acc, doc) => {
            acc[doc.source_type] = (acc[doc.source_type] || 0) + 1;
            return acc;
        }, {});
        console.log(`  - 소스 타입별 분포:`, sourceStats);
        
        if (allDocuments.length === 0) {
            console.log('⚠️  처리할 문서가 없습니다.');
            return;
        }
        
        // 기존 데이터에 추가
        await addToExistingData(allDocuments);
        
        console.log('\n🎉 샘플 크롤링 데이터 통합 완료!');
        
        // 품질 확인을 위한 샘플 검증
        console.log('\n🔍 추가된 데이터 품질 검증...');
        const { data: sampleDocs } = await supabase
            .from('documents')
            .select('source_type, content, source_file')
            .eq('source_type', 'website')
            .limit(3);
        
        sampleDocs.forEach((doc, index) => {
            console.log(`\n웹사이트 샘플 ${index + 1}:`);
            console.log(`  파일: ${doc.source_file}`);
            console.log(`  길이: ${doc.content.length}자`);
            console.log(`  미리보기: ${doc.content.substring(0, 150)}...`);
        });
        
    } catch (error) {
        console.error('\n❌ 샘플 통합 프로세스 실패:', error.message);
        throw error;
    }
}

// 실행
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✅ 샘플 통합 완료!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 프로그램 오류:', error.message);
            process.exit(1);
        });
}

module.exports = { main };