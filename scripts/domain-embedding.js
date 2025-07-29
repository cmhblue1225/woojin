// 도메인별 크롤링 데이터 임베딩 스크립트
require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

class DomainEmbedder {
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
            batchSize: parseInt(process.env.BATCH_SIZE) || 5 // 도메인별 처리를 위해 작게 설정
        };

        // 크롤링 데이터 경로
        this.crawlDataDir = path.join(__dirname, '../crawlingTest/enhanced_output');
        this.logFile = path.join(__dirname, '../logs/domain-embedding.log');
        this.statusFile = path.join(__dirname, '../logs/domain-embedding-status.json');
        
        // 로그 디렉토리 확인
        fs.ensureDirSync(path.dirname(this.logFile));
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }

    // 상태 업데이트
    async updateStatus(status, totalDomains, processedDomains, currentDomain = '', processed = 0, total = 0, message = '') {
        const statusData = {
            status,
            currentDomain,
            totalDomains,
            processedDomains,
            domainProgress: total > 0 ? Math.round((processed / total) * 100) : 0,
            overallProgress: totalDomains > 0 ? Math.round((processedDomains / totalDomains) * 100) : 0,
            processed,
            total,
            message,
            timestamp: new Date().toISOString()
        };

        await fs.writeFile(this.statusFile, JSON.stringify(statusData, null, 2));
    }

    // 도메인별 매핑 정보
    getDomainInfo(domain) {
        const domainMap = {
            'www.daejin.ac.kr': { name: '대진대학교 메인', priority: 1, category: 'main' },
            'ebook.daejin.ac.kr': { name: '전자도서관', priority: 2, category: 'library' },
            'djfilm.daejin.ac.kr': { name: '영화영상학과', priority: 3, category: 'department' },
            'cpe.daejin.ac.kr': { name: '컴퓨터공학과', priority: 3, category: 'department' },
            'dormitory.daejin.ac.kr': { name: '기숙사', priority: 4, category: 'facility' },
            'rotc.daejin.ac.kr': { name: '학군단', priority: 5, category: 'organization' },
            'law.daejin.ac.kr': { name: '법과대학', priority: 3, category: 'department' },
            'eng.daejin.ac.kr': { name: '공과대학', priority: 3, category: 'department' },
            'business.daejin.ac.kr': { name: '경영학과', priority: 3, category: 'department' },
            'china.daejin.ac.kr': { name: '중국학전공', priority: 3, category: 'department' },
            'intlbusiness.daejin.ac.kr': { name: '국제경영학과', priority: 3, category: 'department' },
            'koreanstudies.daejin.ac.kr': { name: '한국학과', priority: 3, category: 'department' },
            'pai.daejin.ac.kr': { name: '행정정보학과', priority: 3, category: 'department' },
            'aidata.daejin.ac.kr': { name: 'AI빅데이터전공', priority: 3, category: 'department' },
            'lis.daejin.ac.kr': { name: '문헌정보학과', priority: 3, category: 'department' },
            'default': { name: '기타', priority: 10, category: 'others' }
        };

        return domainMap[domain] || domainMap['default'];
    }

    // 이미지/바이너리 파일 감지
    isBinaryFile(content, filename) {
        if (!content) return false;
        
        // PNG, JPEG, GIF, PDF 시그니처 체크
        if (content.includes('�PNG') || content.includes('\x89PNG') || 
            content.includes('\xFF\xD8\xFF') || content.includes('JFIF') ||
            content.startsWith('GIF87a') || content.startsWith('GIF89a') ||
            content.startsWith('%PDF')) {
            this.log(`🖼️ 바이너리 파일 감지: ${filename}`);
            return true;
        }
        
        // 바이너리 문자 비율 체크
        const binaryChars = content.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g);
        const binaryRatio = binaryChars ? binaryChars.length / content.length : 0;
        
        if (binaryRatio > 0.2) {
            this.log(`🔢 바이너리 파일 감지 (${Math.round(binaryRatio*100)}%): ${filename}`);
            return true;
        }
        
        return false;
    }

    // 텍스트 정제
    sanitizeText(text) {
        if (!text) return '';
        
        try {
            // Unicode 오류 방지
            text = text.replace(/\\\\u[0-9a-fA-F]{4}/g, '');
            text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            text = text.replace(/\s+/g, ' ');
            text = text.replace(/&[a-zA-Z0-9#]+;/g, ' ');
            text = text.replace(/[\\\"]/g, '');
            text = text.replace(/[\r\n]/g, ' ');
            text = text.replace(/[\uFFFD]/g, '');
            
            return text.trim();
        } catch (error) {
            this.log(`⚠️ 텍스트 정제 실패: ${error.message}`);
            return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
        }
    }

    // 페이지 파일 파싱
    async parsePageFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            
            let url = '', domain = '', depth = 0, length = 0, timestamp = '';
            let metadataEnd = false;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.startsWith('[URL] ')) {
                    url = line.substring(6).trim();
                } else if (line.startsWith('[DOMAIN] ')) {
                    domain = line.substring(9).trim();
                } else if (line.startsWith('[DEPTH] ')) {
                    depth = parseInt(line.substring(8).trim()) || 0;
                } else if (line.startsWith('[LENGTH] ')) {
                    length = parseInt(line.substring(9).trim()) || 0;
                } else if (line.startsWith('[TIMESTAMP] ')) {
                    timestamp = line.substring(12).trim();
                } else if (line.trim() === '' && !metadataEnd) {
                    metadataEnd = true;
                    
                    // 실제 텍스트 내용 계산
                    const textContent = lines.slice(i + 1).join('\n');
                    const cleanText = this.sanitizeText(textContent);
                    
                    // 도메인이 비어있으면 URL에서 추출
                    if (!domain && url) {
                        try {
                            const urlObj = new URL(url);
                            domain = urlObj.hostname;
                        } catch (e) {
                            domain = 'unknown';
                        }
                    }
                    
                    return {
                        file: path.basename(filePath),
                        url,
                        domain: domain || 'unknown',
                        depth,
                        declaredLength: length,
                        text: cleanText,
                        textLength: cleanText.length,
                        timestamp,
                        domainInfo: this.getDomainInfo(domain)
                    };
                }
            }
            
            return null; // 메타데이터만 있고 텍스트가 없는 경우
        } catch (error) {
            this.log(`❌ 파일 파싱 실패 ${filePath}: ${error.message}`);
            return null;
        }
    }

    // 텍스트를 청크로 분할
    splitTextIntoChunks(text, maxLength = 1000, overlap = 200) {
        const chunks = [];
        let start = 0;

        while (start < text.length) {
            let end = start + maxLength;
            
            if (end < text.length) {
                const lastSpace = text.lastIndexOf(' ', end);
                const lastNewline = text.lastIndexOf('\n', end);
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

    // 도메인의 모든 페이지 읽기
    async readDomainPages(domain) {
        this.log(`📚 도메인 "${domain}" 페이지 읽기 시작`);
        
        const files = await fs.readdir(this.crawlDataDir);
        const pageFiles = files.filter(file => file.startsWith('page_') && file.endsWith('.txt'));
        
        const domainPages = [];
        
        for (const file of pageFiles.sort()) {
            const filePath = path.join(this.crawlDataDir, file);
            const pageData = await this.parsePageFile(filePath);
            
            if (pageData && (pageData.domain === domain || (domain === 'unknown' && !pageData.domain))) {
                // 바이너리 파일 체크
                if (!this.isBinaryFile(pageData.text, file) && pageData.textLength > 100) {
                    domainPages.push(pageData);
                }
            }
        }
        
        this.log(`✅ 도메인 "${domain}": ${domainPages.length}개 페이지 발견`);
        return domainPages;
    }

    // 도메인 데이터 처리 및 청킹
    async processDomainData(pages, domain) {
        this.log(`🔄 도메인 "${domain}" 데이터 처리 시작`);
        
        const documents = [];
        
        for (const page of pages) {
            try {
                const chunks = this.splitTextIntoChunks(
                    page.text, 
                    this.config.chunkSize, 
                    this.config.chunkOverlap
                );
                
                for (let i = 0; i < chunks.length; i++) {
                    documents.push({
                        content: chunks[i],
                        source_type: 'website',
                        source_file: page.file,
                        metadata: {
                            url: page.url,
                            domain: page.domain,
                            domain_name: page.domainInfo.name,
                            domain_category: page.domainInfo.category,
                            chunk_index: i,
                            total_chunks: chunks.length,
                            crawled_at: page.timestamp,
                            text_length: chunks[i].length,
                            depth: page.depth
                        }
                    });
                }
                
            } catch (error) {
                this.log(`❌ 페이지 처리 실패 ${page.url}: ${error.message}`);
            }
        }
        
        this.log(`✅ 도메인 "${domain}": ${documents.length}개 청크 생성`);
        return documents;
    }

    // 도메인별 임베딩 실행
    async embedDomain(domain, documents) {
        this.log(`🚀 도메인 "${domain}" 임베딩 시작 (${documents.length}개 문서)`);
        
        let processed = 0;
        
        for (let i = 0; i < documents.length; i += this.config.batchSize) {
            const batch = documents.slice(i, i + this.config.batchSize);
            
            for (const doc of batch) {
                try {
                    const embedding = await this.createEmbedding(doc.content);
                    
                    const { error } = await this.supabase
                        .from('documents')
                        .insert({
                            content: doc.content,
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
                        this.log(`⏳ 도메인 "${domain}" 진행률: ${processed}/${documents.length} (${Math.round(processed/documents.length*100)}%)`);
                    }

                    // API 율제한 방지
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    this.log(`❌ 문서 임베딩 실패 (${doc.source_file}): ${error.message}`);
                    continue;
                }
            }

            // 배치 간 딜레이
            if (i + this.config.batchSize < documents.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        this.log(`✅ 도메인 "${domain}" 임베딩 완료: ${processed}개 문서 처리`);
        return processed;
    }

    // 기존 웹사이트 데이터 삭제 (선택적)
    async clearExistingWebsiteData(domain = null) {
        this.log(`🗑️ 기존 웹사이트 데이터 삭제${domain ? ` (도메인: ${domain})` : ''}`);
        
        try {
            if (domain) {
                // 특정 도메인의 기존 데이터 조회 후 삭제
                const { data: existingData, error: selectError } = await this.supabase
                    .from('documents')
                    .select('id, metadata')
                    .eq('source_type', 'website');
                
                if (selectError) {
                    throw selectError;
                }
                
                if (existingData && existingData.length > 0) {
                    const domainIds = existingData
                        .filter(doc => doc.metadata && doc.metadata.domain === domain)
                        .map(doc => doc.id);
                    
                    if (domainIds.length > 0) {
                        const { error: deleteError } = await this.supabase
                            .from('documents')
                            .delete()
                            .in('id', domainIds);
                        
                        if (deleteError) {
                            throw deleteError;
                        }
                        
                        this.log(`🗑️ 도메인 "${domain}"의 기존 데이터 ${domainIds.length}개 삭제`);
                    } else {
                        this.log(`ℹ️ 도메인 "${domain}"의 기존 데이터 없음`);
                    }
                }
            } else {
                // 모든 웹사이트 데이터 삭제
                const { error } = await this.supabase
                    .from('documents')
                    .delete()
                    .eq('source_type', 'website');
                
                if (error) {
                    throw error;
                }
            }
            
            this.log('✅ 기존 웹사이트 데이터 삭제 완료');
        } catch (error) {
            this.log(`⚠️ 기존 데이터 삭제 실패: ${error.message} (계속 진행)`);
            // 삭제 실패해도 새 데이터 추가는 계속 진행
        }
    }

    // 도메인 목록 생성
    async getDomainList() {
        this.log('🔍 도메인 목록 생성 중...');
        
        const files = await fs.readdir(this.crawlDataDir);
        const pageFiles = files.filter(file => file.startsWith('page_') && file.endsWith('.txt'));
        
        const domainSet = new Set();
        
        for (const file of pageFiles.slice(0, 100)) { // 샘플링으로 빠르게 확인
            const filePath = path.join(this.crawlDataDir, file);
            const pageData = await this.parsePageFile(filePath);
            
            if (pageData && pageData.domain) {
                domainSet.add(pageData.domain);
            }
        }
        
        // 우선순위에 따라 정렬
        const domains = Array.from(domainSet)
            .filter(domain => domain !== 'unknown')
            .map(domain => ({ domain, info: this.getDomainInfo(domain) }))
            .sort((a, b) => a.info.priority - b.info.priority)
            .map(item => item.domain);
        
        this.log(`📋 발견된 도메인: ${domains.length}개`);
        domains.forEach(domain => {
            const info = this.getDomainInfo(domain);
            this.log(`  - ${domain} (${info.name}, 우선순위: ${info.priority})`);
        });
        
        return domains;
    }

    // 메인 실행 함수
    async run(targetDomains = null) {
        try {
            this.log('🚀 도메인별 임베딩 작업 시작');
            
            // 도메인 목록 생성
            const allDomains = await this.getDomainList();
            const domainsToProcess = targetDomains || allDomains;
            
            await this.updateStatus('running', domainsToProcess.length, 0, '', 0, 0, '도메인별 임베딩 시작...');
            
            let totalProcessed = 0;
            
            for (let i = 0; i < domainsToProcess.length; i++) {
                const domain = domainsToProcess[i];
                const domainInfo = this.getDomainInfo(domain);
                
                this.log(`\n📁 [${i + 1}/${domainsToProcess.length}] 도메인 처리: ${domain} (${domainInfo.name})`);
                
                try {
                    await this.updateStatus('running', domainsToProcess.length, i, domain, 0, 0, `도메인 "${domain}" 처리 중...`);
                    
                    // 1. 도메인 페이지 읽기
                    const pages = await this.readDomainPages(domain);
                    
                    if (pages.length === 0) {
                        this.log(`⚠️ 도메인 "${domain}": 처리할 페이지가 없음`);
                        continue;
                    }
                    
                    // 2. 문서 처리 및 청킹
                    const documents = await this.processDomainData(pages, domain);
                    
                    if (documents.length === 0) {
                        this.log(`⚠️ 도메인 "${domain}": 생성된 문서가 없음`);
                        continue;
                    }
                    
                    // 3. 기존 해당 도메인 데이터 삭제
                    await this.clearExistingWebsiteData(domain);
                    
                    // 4. 임베딩 실행
                    const processed = await this.embedDomain(domain, documents);
                    totalProcessed += processed;
                    
                    this.log(`✅ 도메인 "${domain}" 완료: ${processed}개 문서 임베딩`);
                    
                } catch (error) {
                    this.log(`💥 도메인 "${domain}" 처리 실패: ${error.message}`);
                    continue;
                }
                
                await this.updateStatus('running', domainsToProcess.length, i + 1, '', 0, 0, `${i + 1}/${domainsToProcess.length} 도메인 완료`);
            }
            
            // 완료
            await this.updateStatus('completed', domainsToProcess.length, domainsToProcess.length, '', 0, 0, '모든 도메인 임베딩 완료!');
            this.log(`\n🎉 도메인별 임베딩 작업 완료!`);
            this.log(`📈 최종 통계:`);
            this.log(`  - 처리된 도메인: ${domainsToProcess.length}개`);
            this.log(`  - 총 임베딩 문서: ${totalProcessed}개`);
            
        } catch (error) {
            this.log(`💥 임베딩 작업 실패: ${error.message}`);
            await this.updateStatus('failed', 0, 0, '', 0, 0, error.message);
            process.exit(1);
        }
    }
}

// 스크립트 직접 실행
if (require.main === module) {
    const embedder = new DomainEmbedder();
    
    // 명령행 인수로 특정 도메인 지정 가능
    const targetDomains = process.argv.slice(2);
    if (targetDomains.length > 0) {
        console.log(`특정 도메인만 처리: ${targetDomains.join(', ')}`);
        embedder.run(targetDomains).catch(console.error);
    } else {
        embedder.run().catch(console.error);
    }
}

module.exports = DomainEmbedder;