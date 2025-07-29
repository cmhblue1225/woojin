// 빠른 샘플 데이터 추가 스크립트 (소량, 고품질)
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
    BATCH_SIZE: 10,
    MIN_CONTENT_LENGTH: 200,
    MAX_FILES: 50, // 매우 소량만 처리
};

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
        '도서관', '기숙사', '장학', '취업', '국제', '교류'
    ];
    
    const hasMeaningfulContent = meaningfulKeywords.some(keyword => 
        cleaned.includes(keyword)
    );
    
    if (!hasMeaningfulContent || cleaned.length < CONFIG.MIN_CONTENT_LENGTH) {
        return null;
    }
    
    return cleaned;
}

// 단일 파일 처리
async function processFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        if (!content.trim()) return null;
        
        const { metadata, content: actualContent } = parseMetadata(content);
        const processedContent = processContent(actualContent);
        
        if (!processedContent) return null;
        
        const fileName = path.basename(filePath);
        
        return {
            content: processedContent,
            source_file: fileName,
            source_type: 'website',
            metadata: metadata,
            url: metadata.url || null,
            domain: metadata.domain || null
        };
        
    } catch (error) {
        return null;
    }
}

// 임베딩 생성 및 저장
async function processAndSaveDocuments(documents) {
    console.log(`🔄 ${documents.length}개 문서 임베딩 생성 중...`);
    
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
            
            console.log(`✅ 배치 ${Math.floor(i / CONFIG.BATCH_SIZE) + 1} 완료 (${batch.length}개)`);
            
            // API 대기
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ 배치 처리 실패:`, error.message);
            throw error;
        }
    }
}

// 메인 실행 함수
async function main() {
    console.log('🚀 고품질 샘플 데이터 추가 시작...\n');
    
    try {
        // 기존 문서 수 확인
        const { count: existingCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });
        
        console.log(`📊 기존 문서 수: ${existingCount}개`);
        
        // enhanced_output에서 고품질 파일 선별
        const dirPath = '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_output';
        const files = await fs.readdir(dirPath);
        const txtFiles = files
            .filter(file => file.startsWith('page_') && file.endsWith('.txt'))
            .sort()
            .slice(0, CONFIG.MAX_FILES); // 최대 50개만
        
        console.log(`📁 처리 대상: ${txtFiles.length}개 파일`);
        
        const validDocuments = [];
        
        for (const file of txtFiles) {
            const filePath = path.join(dirPath, file);
            const document = await processFile(filePath);
            
            if (document) {
                validDocuments.push(document);
            }
        }
        
        console.log(`✅ 품질 필터링 완료: ${validDocuments.length}개 고품질 문서`);
        
        if (validDocuments.length === 0) {
            console.log('⚠️  추가할 고품질 문서가 없습니다.');
            return;
        }
        
        // 통계 출력
        const avgLength = Math.round(
            validDocuments.reduce((acc, doc) => acc + doc.content.length, 0) / validDocuments.length
        );
        console.log(`📏 평균 문서 길이: ${avgLength}자`);
        
        // 도메인별 분포
        const domainStats = validDocuments.reduce((acc, doc) => {
            const domain = doc.domain || 'unknown';
            acc[domain] = (acc[domain] || 0) + 1;
            return acc;
        }, {});
        console.log(`🌐 도메인별 분포:`, domainStats);
        
        // 임베딩 생성 및 저장
        await processAndSaveDocuments(validDocuments);
        
        // 최종 확인
        const { count: finalCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });
        
        console.log(`\n🎉 추가 완료!`);
        console.log(`📊 최종 문서 수: ${finalCount}개 (${finalCount - existingCount}개 추가)`);
        
        // 샘플 확인
        const { data: samples } = await supabase
            .from('documents')
            .select('content, source_file, source_type')
            .eq('source_type', 'website')
            .limit(3);
        
        if (samples && samples.length > 0) {
            console.log('\n🔍 추가된 웹사이트 데이터 샘플:');
            samples.forEach((doc, index) => {
                console.log(`\n샘플 ${index + 1}:`);
                console.log(`  파일: ${doc.source_file}`);
                console.log(`  길이: ${doc.content.length}자`);
                console.log(`  내용: ${doc.content.substring(0, 200)}...`);
            });
        }
        
    } catch (error) {
        console.error('\n❌ 처리 실패:', error.message);
        throw error;
    }
}

// 실행
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✅ 완료!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 오류:', error.message);
            process.exit(1);
        });
}

module.exports = { main };