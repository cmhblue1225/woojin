// 크롤링 데이터 처리 및 RAG 통합 스크립트
require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

class CrawledDataProcessor {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        this.config = {
            embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            chunkSize: parseInt(process.env.CHUNK_SIZE) || 1000,
            chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 200,
            batchSize: parseInt(process.env.BATCH_SIZE) || 10
        };

        // 크롤링 데이터 경로
        this.crawlDataDir = path.join(__dirname, '../crawlingTest/enhanced_output');
        this.logFile = path.join(__dirname, '../logs/crawled-data-processing.log');
        
        // 로그 디렉토리 확인
        fs.ensureDirSync(path.dirname(this.logFile));
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        fs.appendFileSync(this.logFile, logMessage + '\\n');
    }

    // 이미지/바이너리 파일 감지 함수
    isBinaryFile(content, filename) {
        if (!content) return false;
        
        // PNG 시그니처 체크 (가장 일반적인 패턴)
        if (content.includes('�PNG') || content.includes('\x89PNG') || content.includes('\\x89PNG')) {
            this.log(`🖼️ PNG 파일 감지: ${filename}`);
            return true;
        }
        
        // JPEG 시그니처 체크
        if (content.includes('\xFF\xD8\xFF') || content.includes('JFIF') || content.includes('\\xFF\\xD8\\xFF')) {
            this.log(`🖼️ JPEG 파일 감지: ${filename}`);
            return true;
        }
        
        // GIF 시그니처 체크
        if (content.startsWith('GIF87a') || content.startsWith('GIF89a')) {
            this.log(`🖼️ GIF 파일 감지: ${filename}`);
            return true;
        }
        
        // PDF 시그니처 체크
        if (content.startsWith('%PDF')) {
            this.log(`📄 PDF 파일 감지: ${filename}`);
            return true;
        }
        
        // 바이너리 문자 비율 체크 (20% 이상이면 바이너리로 판단)
        const binaryChars = content.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g);
        const binaryRatio = binaryChars ? binaryChars.length / content.length : 0;
        
        if (binaryRatio > 0.2) {
            this.log(`🔢 바이너리 파일 감지 (${Math.round(binaryRatio*100)}% 바이너리): ${filename}`);
            return true;
        }
        
        return false;
    }

    // 텍스트 정제 함수 (Unicode 오류 방지)
    sanitizeText(text) {
        if (!text) return '';
        
        try {
            // 1. 잘못된 Unicode 문자 제거
            text = text.replace(/\\\\u[0-9a-fA-F]{4}/g, '');
            
            // 2. 제어 문자 제거 (탭, 줄바꿈 제외)
            text = text.replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g, '');
            
            // 3. 연속된 공백 정리
            text = text.replace(/\\s+/g, ' ');
            
            // 4. 특수 HTML 엔티티 정리
            text = text.replace(/&[a-zA-Z0-9#]+;/g, ' ');
            
            // 5. JSON 특수 문자 이스케이프
            text = text.replace(/[\\"]/g, '');
            text = text.replace(/[\\r\\n]/g, ' ');
            
            // 6. 유효하지 않은 UTF-8 시퀀스 제거
            text = text.replace(/[\\uFFFD]/g, '');
            
            return text.trim();
        } catch (error) {
            this.log(`⚠️ 텍스트 정제 실패: ${error.message}`);
            // 에러 발생 시 기본 정제만 수행
            return text
                .replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g, '')
                .replace(/\\s+/g, ' ')
                .trim();
        }
    }

    // 크롤링된 파일들 읽기
    async readCrawledFiles() {
        this.log('📚 크롤링 데이터 읽기 시작');
        
        const files = await fs.readdir(this.crawlDataDir);
        const pageFiles = files.filter(file => file.startsWith('page_') && file.endsWith('.txt'));
        
        this.log(`📄 발견된 페이지 파일: ${pageFiles.length}개`);
        
        const documents = [];
        
        for (const file of pageFiles.sort()) {
            try {
                const filePath = path.join(this.crawlDataDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                
                const doc = this.parsePageFile(content, file);
                if (doc) {
                    documents.push(doc);
                }
            } catch (error) {
                this.log(`❌ 파일 읽기 실패 ${file}: ${error.message}`);
            }
        }
        
        this.log(`✅ 처리된 문서: ${documents.length}개`);
        return documents;
    }

    // 페이지 파일 파싱
    parsePageFile(content, filename) {
        // 바이너리 파일 체크
        if (this.isBinaryFile(content, filename)) {
            this.log(`⚠️ 바이너리 파일 스킵: ${filename}`);
            return null;
        }
        
        const lines = content.split('\\n');
        let url = '', depth = 0, domain = '', timestamp = '', length = 0;
        let textStartIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('[URL] ')) {
                url = line.substring(6);
            } else if (line.startsWith('[DEPTH] ')) {
                depth = parseInt(line.substring(8)) || 0;
            } else if (line.startsWith('[DOMAIN] ')) {
                domain = line.substring(9);
            } else if (line.startsWith('[TIMESTAMP] ')) {
                timestamp = line.substring(12);
            } else if (line.startsWith('[LENGTH] ')) {
                length = parseInt(line.substring(9)) || 0;
            } else if (line === '' && textStartIndex === -1) {
                textStartIndex = i + 1;
                break;
            }
        }
        
        if (textStartIndex === -1 || !url) {
            return null;
        }
        
        const rawText = lines.slice(textStartIndex).join('\\n').trim();
        
        // 텍스트 정제 (Unicode 오류 방지)
        const text = this.sanitizeText(rawText);
        
        // 최소 길이 검사
        if (text.length < 100) {
            return null;
        }
        
        // URL에서 카테고리 추출
        const category = this.extractCategory(url, domain);
        
        return {
            url,
            text,
            domain,
            depth,
            category,
            timestamp,
            length,
            filename,
            metadata: {
                source_file: filename,
                domain,
                depth,
                category,
                crawled_at: timestamp,
                text_length: text.length
            }
        };
    }

    // URL에서 카테고리 추출
    extractCategory(url, domain) {
        const urlLower = url.toLowerCase();
        
        // 도메인별 분류
        if (domain.includes('library')) return 'library';
        if (domain.includes('eng')) return 'engineering';
        if (domain.includes('law')) return 'law';
        if (domain.includes('sm')) return 'media';
        if (domain.includes('swcg')) return 'welfare';
        if (domain.includes('ce')) return 'civil_engineering';
        
        // URL 패턴별 분류
        if (urlLower.includes('notice') || urlLower.includes('공지')) return 'notice';
        if (urlLower.includes('news') || urlLower.includes('뉴스')) return 'news';
        if (urlLower.includes('board') || urlLower.includes('bbs')) return 'board';
        if (urlLower.includes('info') || urlLower.includes('정보')) return 'information';
        if (urlLower.includes('admission') || urlLower.includes('입학')) return 'admission';
        if (urlLower.includes('academic') || urlLower.includes('학사')) return 'academic';
        if (urlLower.includes('scholarship') || urlLower.includes('장학')) return 'scholarship';
        
        return 'general';
    }

    // 텍스트를 청크로 분할
    splitTextIntoChunks(text, maxLength = 1000, overlap = 200) {
        const chunks = [];
        let start = 0;

        while (start < text.length) {
            let end = start + maxLength;
            
            if (end < text.length) {
                const lastSpace = text.lastIndexOf(' ', end);
                const lastNewline = text.lastIndexOf('\\n', end);
                const breakPoint = Math.max(lastSpace, lastNewline);
                
                if (breakPoint > start + maxLength * 0.8) {
                    end = breakPoint;
                }
            }

            const chunk = text.slice(start, end).trim();
            if (chunk.length > 50) {  // 너무 짧은 청크 제외
                chunks.push(chunk);
            }

            start = Math.max(start + 1, end - overlap);
        }

        return chunks;
    }

    // 임베딩 생성
    async createEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: this.config.embeddingModel,
                input: text,
                encoding_format: "float",
            });

            return response.data[0].embedding;
        } catch (error) {
            this.log(`❌ 임베딩 생성 실패: ${error.message}`);
            throw error;
        }
    }

    // 문서 처리 및 청킹
    async processDocuments(documents) {
        this.log('🔄 문서 처리 및 청킹 시작');
        
        const processedDocs = [];
        
        for (const doc of documents) {
            try {
                const chunks = this.splitTextIntoChunks(
                    doc.text, 
                    this.config.chunkSize, 
                    this.config.chunkOverlap
                );
                
                for (let i = 0; i < chunks.length; i++) {
                    processedDocs.push({
                        content: chunks[i],
                        source_type: 'website',
                        source_file: doc.filename,
                        metadata: {
                            ...doc.metadata,
                            url: doc.url,
                            chunk_index: i,
                            total_chunks: chunks.length,
                            category: doc.category
                        }
                    });
                }
                
                this.log(`📝 처리 완료: ${doc.url} (${chunks.length}개 청크)`);
                
            } catch (error) {
                this.log(`❌ 문서 처리 실패 ${doc.url}: ${error.message}`);
            }
        }
        
        this.log(`✅ 총 ${processedDocs.length}개 청크 생성`);
        return processedDocs;
    }

    // 기존 웹사이트 데이터 삭제
    async clearExistingWebsiteData() {
        this.log('🗑️ 기존 웹사이트 데이터 삭제');
        
        const { error } = await this.supabase
            .from('documents')
            .delete()
            .eq('source_type', 'website');
        
        if (error) {
            throw new Error(`기존 데이터 삭제 실패: ${error.message}`);
        }
        
        this.log('✅ 기존 웹사이트 데이터 삭제 완료');
    }

    // 배치 처리
    async processBatch(documents) {
        const batchSize = this.config.batchSize;
        let processed = 0;

        for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);
            
            this.log(`📦 배치 처리 중: ${i + 1}-${Math.min(i + batchSize, documents.length)}/${documents.length}`);

            for (const doc of batch) {
                try {
                    // 텍스트 사전 검증
                    const cleanContent = this.sanitizeText(doc.content);
                    if (!cleanContent || cleanContent.length < 10) {
                        this.log(`⚠️ 빈 콘텐츠 스킵: ${doc.source_file}`);
                        continue;
                    }
                    
                    const embedding = await this.createEmbedding(cleanContent);
                    
                    const { error } = await this.supabase
                        .from('documents')
                        .insert({
                            content: cleanContent,
                            embedding: embedding,
                            source_type: doc.source_type,
                            source_file: doc.source_file,
                            metadata: doc.metadata
                        });

                    if (error) {
                        throw error;
                    }

                    processed++;
                    
                    if (processed % 10 === 0) {
                        this.log(`⏳ 진행률: ${processed}/${documents.length} (${Math.round(processed/documents.length*100)}%)`);
                    }

                    // API 율제한 방지
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    this.log(`❌ 문서 처리 실패 (${doc.source_file}): ${error.message}`);
                    // 개별 문서 실패는 전체 작업을 중단하지 않고 계속 진행
                    continue;
                }
            }

            // 배치 간 딜레이
            if (i + batchSize < documents.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return processed;
    }

    // 통계 생성
    generateStats(documents) {
        const stats = {
            totalDocuments: documents.length,
            categories: {},
            domains: {},
            depths: {},
            avgLength: 0
        };
        
        let totalLength = 0;
        
        for (const doc of documents) {
            // 카테고리별 통계
            const category = doc.metadata.category || 'unknown';
            stats.categories[category] = (stats.categories[category] || 0) + 1;
            
            // 도메인별 통계
            const domain = doc.metadata.domain || 'unknown';
            stats.domains[domain] = (stats.domains[domain] || 0) + 1;
            
            // 깊이별 통계
            const depth = doc.metadata.depth || 0;
            stats.depths[depth] = (stats.depths[depth] || 0) + 1;
            
            totalLength += doc.content.length;
        }
        
        stats.avgLength = Math.round(totalLength / documents.length);
        
        return stats;
    }

    // 메인 처리 함수
    async run() {
        try {
            this.log('🚀 크롤링 데이터 처리 시작');
            
            // 1. 크롤링 데이터 읽기
            const rawDocuments = await this.readCrawledFiles();
            
            if (rawDocuments.length === 0) {
                this.log('❌ 처리할 크롤링 데이터가 없습니다');
                return;
            }
            
            // 2. 문서 처리 및 청킹
            const processedDocs = await this.processDocuments(rawDocuments);
            
            // 3. 통계 생성
            const stats = this.generateStats(processedDocs);
            this.log(`📊 처리 통계: ${JSON.stringify(stats, null, 2)}`);
            
            // 4. 기존 웹사이트 데이터 삭제
            await this.clearExistingWebsiteData();
            
            // 5. 임베딩 및 데이터베이스 저장
            const processed = await this.processBatch(processedDocs);
            
            // 6. 완료 리포트
            this.log('🎉 크롤링 데이터 처리 완료!');
            this.log(`📈 최종 통계:`);
            this.log(`  - 처리된 문서: ${processed}개`);
            this.log(`  - 카테고리: ${Object.keys(stats.categories).length}개`);
            this.log(`  - 도메인: ${Object.keys(stats.domains).length}개`);
            this.log(`  - 평균 청크 길이: ${stats.avgLength}자`);
            
        } catch (error) {
            this.log(`💥 처리 실패: ${error.message}`);
            process.exit(1);
        }
    }
}

// 스크립트 직접 실행
if (require.main === module) {
    const processor = new CrawledDataProcessor();
    processor.run().catch(console.error);
}

module.exports = CrawledDataProcessor;