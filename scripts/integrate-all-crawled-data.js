// 모든 크롤링 데이터를 데이터베이스에 통합하는 스크립트
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
    MIN_CONTENT_LENGTH: 50, // 최소 컨텐츠 길이
    MAX_CONTENT_LENGTH: 2000, // 최대 컨텐츠 길이
};

// 크롤링 데이터 디렉토리 경로
const CRAWLING_DIRS = [
    {
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/unlimited_crawling_output',
        prefix: 'unlimited_page_',
        sourceType: 'website'
    },
    {
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_output',
        prefix: 'page_',
        sourceType: 'website'
    },
    {
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_strategic_output',
        prefix: 'page_',
        sourceType: 'website'
    },
    {
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/strategic_output',
        prefix: 'page_',
        sourceType: 'website'
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
    // 불필요한 네비게이션 텍스트 제거
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
        
        // 단어 경계에서 자르기
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
            console.log(`⚠️  스킵: ${path.basename(filePath)} (컨텐츠 너무 짧음: ${cleanedContent.length}자)`);
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
        console.error(`❌ 파일 처리 실패: ${filePath}`, error.message);
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
            
            // API 레이트 리밋 방지를 위한 대기
            if (i + CONFIG.BATCH_SIZE < documents.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
        } catch (error) {
            console.error(`❌ 임베딩 생성 실패 (배치 ${i + 1}-${Math.min(i + CONFIG.BATCH_SIZE, documents.length)}):`, error.message);
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
            console.error(`❌ 데이터베이스 저장 실패 (배치 ${i + 1}-${Math.min(i + CONFIG.BATCH_SIZE, documents.length)}):`, error.message);
            throw error;
        }
    }
}

// 디렉토리 처리
async function processDirectory(dirConfig) {
    const { path: dirPath, prefix, sourceType } = dirConfig;
    
    try {
        const files = await fs.readdir(dirPath);
        const txtFiles = files
            .filter(file => file.startsWith(prefix) && file.endsWith('.txt'))
            .sort();
        
        console.log(`\n📁 처리 중: ${dirPath}`);
        console.log(`📄 발견된 파일: ${txtFiles.length}개`);
        
        if (txtFiles.length === 0) {
            console.log(`⚠️  처리할 파일 없음: ${dirPath}`);
            return [];
        }
        
        const allDocuments = [];
        let processedCount = 0;
        
        for (const file of txtFiles) {
            const filePath = path.join(dirPath, file);
            const documents = await processFile(filePath, sourceType);
            allDocuments.push(...documents);
            
            processedCount++;
            if (processedCount % 100 === 0) {
                console.log(`📊 진행 상황: ${processedCount}/${txtFiles.length} 파일 처리 완료`);
            }
        }
        
        console.log(`✅ ${dirPath} 처리 완료: ${allDocuments.length}개 문서 생성`);
        return allDocuments;
        
    } catch (error) {
        console.error(`❌ 디렉토리 처리 실패: ${dirPath}`, error.message);
        return [];
    }
}

// 백업 생성
async function createBackup() {
    console.log('🔄 기존 데이터 백업 중...');
    
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = `/Users/minhyuk/Desktop/우진봇/backups/backup_${timestamp}`;
        
        await fs.mkdir(backupDir, { recursive: true });
        
        // 기존 데이터 조회
        const { data: existingData, error } = await supabase
            .from('documents')
            .select('*');
        
        if (error) throw error;
        
        // 백업 파일 생성
        await fs.writeFile(
            path.join(backupDir, 'documents_backup.json'),
            JSON.stringify(existingData, null, 2)
        );
        
        console.log(`✅ 백업 완료: ${backupDir}`);
        console.log(`📊 백업된 문서 수: ${existingData.length}개`);
        
        return backupDir;
        
    } catch (error) {
        console.error('❌ 백업 실패:', error.message);
        throw error;
    }
}

// 기존 데이터 삭제
async function clearExistingData() {
    console.log('🗑️  기존 데이터 삭제 중...');
    
    try {
        const { error } = await supabase
            .from('documents')
            .delete()
            .neq('id', 0); // 모든 레코드 삭제
        
        if (error) throw error;
        console.log('✅ 기존 데이터 삭제 완료');
        
    } catch (error) {
        console.error('❌ 데이터 삭제 실패:', error.message);
        throw error;
    }
}

// 메인 실행 함수
async function main() {
    console.log('🚀 크롤링 데이터 통합 시작...\n');
    console.log('📋 처리 대상:');
    CRAWLING_DIRS.forEach((dir, index) => {
        console.log(`  ${index + 1}. ${dir.path} (${dir.sourceType})`);
    });
    
    try {
        // 1. 백업 생성
        const backupDir = await createBackup();
        
        // 2. 기존 데이터 삭제
        await clearExistingData();
        
        // 3. 모든 디렉토리 처리
        console.log('\n📁 크롤링 데이터 처리 시작...');
        const allDocuments = [];
        
        for (const dirConfig of CRAWLING_DIRS) {
            const documents = await processDirectory(dirConfig);
            allDocuments.push(...documents);
        }
        
        console.log(`\n📊 전체 통계:`);
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
        
        // 4. 임베딩 생성
        console.log('\n🤖 임베딩 생성 시작...');
        const documentsWithEmbeddings = await createEmbeddings(allDocuments);
        
        // 5. 데이터베이스에 저장
        console.log('\n💾 데이터베이스 저장 시작...');
        await saveToDatabase(documentsWithEmbeddings);
        
        // 6. 최종 통계
        const { count: finalCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });
        
        console.log('\n🎉 크롤링 데이터 통합 완료!');
        console.log(`📊 최종 결과:`);
        console.log(`  - 데이터베이스 총 문서 수: ${finalCount}개`);
        console.log(`  - 백업 위치: ${backupDir}`);
        console.log(`  - 처리 시간: ${new Date().toLocaleString()}`);
        
        // 7. 품질 확인을 위한 샘플 검증
        console.log('\n🔍 데이터 품질 검증...');
        const { data: sampleDocs } = await supabase
            .from('documents')
            .select('source_type, content, source_file')
            .limit(5);
        
        sampleDocs.forEach((doc, index) => {
            console.log(`\n샘플 ${index + 1}:`);
            console.log(`  타입: ${doc.source_type}`);
            console.log(`  파일: ${doc.source_file}`);
            console.log(`  길이: ${doc.content.length}자`);
            console.log(`  미리보기: ${doc.content.substring(0, 100)}...`);
        });
        
    } catch (error) {
        console.error('\n❌ 통합 프로세스 실패:', error.message);
        console.error('📋 오류 스택:', error.stack);
        throw error;
    }
}

// 실행
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✅ 프로그램 정상 종료');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 프로그램 오류 종료:', error.message);
            process.exit(1);
        });
}

module.exports = { main };