// 특정 도메인 재크롤링 및 재임베딩 스크립트
require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

class SelectiveRecrawler {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        
        this.logFile = path.join(__dirname, '../logs/selective-recrawl.log');
        this.crawlDataDir = path.join(__dirname, '../crawlingTest/enhanced_output');
        
        // 로그 디렉토리 확인
        fs.ensureDirSync(path.dirname(this.logFile));
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }

    // 특정 도메인의 품질 분석
    async analyzeDomainQuality(domain) {
        this.log(`🔍 도메인 품질 분석: ${domain}`);
        
        // PostgreSQL JSON 쿼리 대신 모든 웹사이트 데이터를 가져와서 필터링
        const { data: allData, error } = await this.supabase
            .from('documents')
            .select('id, content, metadata, created_at')
            .eq('source_type', 'website');
        
        if (error) {
            this.log(`❌ 도메인 분석 오류: ${error.message}`);
            return null;
        }
        
        // 클라이언트 사이드에서 도메인 필터링
        const data = allData.filter(doc => 
            doc.metadata && doc.metadata.domain === domain
        );
        
        if (!data || data.length === 0) {
            this.log(`⚠️ 도메인 "${domain}"에 데이터가 없습니다.`);
            return null;
        }
        
        const analysis = {
            domain,
            totalDocs: data.length,
            emptyDocs: 0,
            shortDocs: 0,
            totalLength: 0,
            minLength: Infinity,
            maxLength: 0,
            issues: []
        };
        
        data.forEach(doc => {
            const contentLength = doc.content ? doc.content.length : 0;
            analysis.totalLength += contentLength;
            analysis.minLength = Math.min(analysis.minLength, contentLength);
            analysis.maxLength = Math.max(analysis.maxLength, contentLength);
            
            if (contentLength === 0) {
                analysis.emptyDocs++;
                analysis.issues.push({
                    id: doc.id,
                    type: 'empty',
                    content: 'Empty document'
                });
            } else if (contentLength < 100) {
                analysis.shortDocs++;
                analysis.issues.push({
                    id: doc.id,
                    type: 'short',
                    length: contentLength,
                    content: doc.content.substring(0, 50) + '...'
                });
            }
        });
        
        analysis.avgLength = Math.round(analysis.totalLength / analysis.totalDocs);
        analysis.emptyPercentage = Math.round((analysis.emptyDocs / analysis.totalDocs) * 100);
        analysis.shortPercentage = Math.round((analysis.shortDocs / analysis.totalDocs) * 100);
        
        // 품질 평가
        analysis.quality = analysis.avgLength > 500 ? 'excellent' : 
                          analysis.avgLength > 200 ? 'good' : 
                          analysis.avgLength > 100 ? 'fair' : 'poor';
        
        analysis.needsReprocessing = 
            analysis.quality === 'poor' || 
            analysis.emptyPercentage > 20 || 
            analysis.shortPercentage > 30;
        
        this.log(`📊 도메인 "${domain}" 분석 결과:`);
        this.log(`  - 총 문서: ${analysis.totalDocs}개`);
        this.log(`  - 평균 길이: ${analysis.avgLength}자 (${analysis.quality})`);
        this.log(`  - 문제 문서: 빈 문서 ${analysis.emptyDocs}개(${analysis.emptyPercentage}%), 짧은 문서 ${analysis.shortDocs}개(${analysis.shortPercentage}%)`);
        this.log(`  - 재처리 필요: ${analysis.needsReprocessing ? 'YES' : 'NO'}`);
        
        return analysis;
    }

    // 크롤링 데이터에서 특정 도메인의 페이지 찾기
    async findDomainPages(domain) {
        this.log(`📚 도메인 "${domain}" 크롤링 데이터 검색 중...`);
        
        const files = await fs.readdir(this.crawlDataDir);
        const pageFiles = files.filter(file => file.startsWith('page_') && file.endsWith('.txt'));
        
        const domainPages = [];
        
        for (const file of pageFiles) {
            const filePath = path.join(this.crawlDataDir, file);
            
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const lines = content.split('\n');
                
                let pageDomain = '';
                let url = '';
                
                for (const line of lines) {
                    if (line.startsWith('[DOMAIN] ')) {
                        pageDomain = line.substring(9).trim();
                    } else if (line.startsWith('[URL] ')) {
                        url = line.substring(6).trim();
                    }
                    
                    if (pageDomain && url) break;
                }
                
                // 도메인이 없으면 URL에서 추출
                if (!pageDomain && url) {
                    try {
                        const urlObj = new URL(url);
                        pageDomain = urlObj.hostname;
                    } catch (e) {
                        // URL 파싱 실패 시 무시
                    }
                }
                
                if (pageDomain === domain) {
                    domainPages.push({
                        file: file,
                        path: filePath,
                        domain: pageDomain,
                        url: url
                    });
                }
            } catch (error) {
                // 파일 읽기 오류 시 무시
            }
        }
        
        this.log(`✅ 도메인 "${domain}": ${domainPages.length}개 크롤링 페이지 발견`);
        return domainPages;
    }

    // 특정 도메인 데이터 삭제
    async deleteDomainData(domain) {
        this.log(`🗑️ 도메인 "${domain}" 기존 데이터 삭제 중...`);
        
        try {
            // 모든 웹사이트 데이터 조회 후 클라이언트 사이드 필터링
            const { data: allData, error: selectError } = await this.supabase
                .from('documents')
                .select('id, metadata')
                .eq('source_type', 'website');
            
            if (selectError) {
                throw selectError;
            }
            
            // 해당 도메인의 문서 ID 추출
            const idsToDelete = allData
                .filter(doc => doc.metadata && doc.metadata.domain === domain)
                .map(doc => doc.id);
            
            if (idsToDelete.length > 0) {
                const { error: deleteError } = await this.supabase
                    .from('documents')
                    .delete()
                    .in('id', idsToDelete);
                
                if (deleteError) {
                    throw deleteError;
                }
                
                this.log(`✅ 도메인 "${domain}" 기존 데이터 ${idsToDelete.length}개 삭제 완료`);
                return idsToDelete.length;
            } else {
                this.log(`ℹ️ 도메인 "${domain}"에 삭제할 기존 데이터가 없습니다.`);
                return 0;
            }
        } catch (error) {
            this.log(`❌ 도메인 "${domain}" 데이터 삭제 실패: ${error.message}`);
            throw error;
        }
    }

    // 특정 도메인 재임베딩 실행
    async reembedDomain(domain) {
        this.log(`🚀 도메인 "${domain}" 재임베딩 시작`);
        
        try {
            // 1. 품질 분석
            const analysis = await this.analyzeDomainQuality(domain);
            if (!analysis) {
                this.log(`❌ 도메인 "${domain}" 분석 실패`);
                return false;
            }
            
            // 2. 재처리가 필요한지 확인
            if (!analysis.needsReprocessing) {
                this.log(`✅ 도메인 "${domain}"은 재처리가 필요하지 않습니다. (품질: ${analysis.quality})`);
                return true;
            }
            
            // 3. 크롤링 데이터 확인
            const pages = await this.findDomainPages(domain);
            if (pages.length === 0) {
                this.log(`❌ 도메인 "${domain}"의 크롤링 데이터를 찾을 수 없습니다.`);
                return false;
            }
            
            // 4. 기존 데이터 삭제
            await this.deleteDomainData(domain);
            
            // 5. 도메인별 임베딩 스크립트 실행
            this.log(`🔄 도메인 "${domain}" 임베딩 스크립트 실행 중...`);
            
            const { spawn } = require('child_process');
            const embeddingProcess = spawn('node', [
                path.join(__dirname, 'domain-embedding.js'),
                domain
            ], {
                cwd: path.dirname(__filename),
                stdio: 'pipe'
            });
            
            return new Promise((resolve, reject) => {
                let output = '';
                
                embeddingProcess.stdout.on('data', (data) => {
                    const message = data.toString();
                    output += message;
                    this.log(`[임베딩] ${message.trim()}`);
                });
                
                embeddingProcess.stderr.on('data', (data) => {
                    this.log(`[임베딩 오류] ${data.toString().trim()}`);
                });
                
                embeddingProcess.on('close', (code) => {
                    if (code === 0) {
                        this.log(`✅ 도메인 "${domain}" 재임베딩 완료`);
                        resolve(true);
                    } else {
                        this.log(`❌ 도메인 "${domain}" 재임베딩 실패 (종료 코드: ${code})`);
                        reject(new Error(`임베딩 프로세스 실패: ${code}`));
                    }
                });
            });
            
        } catch (error) {
            this.log(`💥 도메인 "${domain}" 재임베딩 중 오류: ${error.message}`);
            return false;
        }
    }

    // 전체 품질 분석 및 재처리 권장사항 제공
    async analyzeAllDomains() {
        this.log('📊 전체 도메인 품질 분석 시작');
        
        // 모든 웹사이트 데이터 조회 (메타데이터 포함)
        const { data: websiteData, error } = await this.supabase
            .from('documents')
            .select('metadata')
            .eq('source_type', 'website');
        
        if (error) {
            this.log(`❌ 도메인 조회 오류: ${error.message}`);
            return;
        }
        
        // 도메인 추출
        const domainSet = new Set();
        websiteData.forEach(doc => {
            if (doc.metadata && doc.metadata.domain) {
                domainSet.add(doc.metadata.domain);
            }
        });
        
        const uniqueDomains = Array.from(domainSet).sort();
        this.log(`📋 발견된 도메인: ${uniqueDomains.length}개`);
        
        const analysisResults = [];
        const needReprocessing = [];
        
        for (const domain of uniqueDomains) {
            const analysis = await this.analyzeDomainQuality(domain);
            if (analysis) {
                analysisResults.push(analysis);
                if (analysis.needsReprocessing) {
                    needReprocessing.push(domain);
                }
            }
        }
        
        // 결과 정리
        this.log('\n📊 === 전체 도메인 품질 분석 결과 ===');
        analysisResults
            .sort((a, b) => b.totalDocs - a.totalDocs)
            .forEach((analysis, i) => {
                const qualityIcon = {
                    'excellent': '🟢',
                    'good': '🟡', 
                    'fair': '🟠',
                    'poor': '🔴'
                }[analysis.quality];
                
                this.log(`${i+1}. ${qualityIcon} ${analysis.domain} (${analysis.totalDocs}개, 평균 ${analysis.avgLength}자)`);
            });
        
        if (needReprocessing.length > 0) {
            this.log('\n🚨 재처리 권장 도메인:');
            needReprocessing.forEach(domain => {
                this.log(`  🔴 ${domain}`);
            });
        } else {
            this.log('\n✅ 모든 도메인이 양호한 품질을 유지하고 있습니다.');
        }
        
        return { analysisResults, needReprocessing };
    }

    // 메인 실행 함수
    async run(targetDomains = null, analyzeOnly = false) {
        try {
            this.log('🚀 선택적 재크롤링 시스템 시작');
            
            if (analyzeOnly) {
                // 분석만 실행
                await this.analyzeAllDomains();
                return;
            }
            
            if (targetDomains && targetDomains.length > 0) {
                // 특정 도메인들 재처리
                this.log(`🎯 지정된 도메인 재처리: ${targetDomains.join(', ')}`);
                
                for (const domain of targetDomains) {
                    await this.reembedDomain(domain);
                }
            } else {
                // 전체 분석 후 필요한 도메인만 재처리
                const { needReprocessing } = await this.analyzeAllDomains();
                
                if (needReprocessing.length > 0) {
                    this.log(`🔄 ${needReprocessing.length}개 도메인 자동 재처리 시작`);
                    
                    for (const domain of needReprocessing) {
                        await this.reembedDomain(domain);
                    }
                } else {
                    this.log('✅ 재처리가 필요한 도메인이 없습니다.');
                }
            }
            
            this.log('🎉 선택적 재크롤링 작업 완료');
            
        } catch (error) {
            this.log(`💥 선택적 재크롤링 실패: ${error.message}`);
            process.exit(1);
        }
    }
}

// 스크립트 직접 실행
if (require.main === module) {
    const args = process.argv.slice(2);
    const recrawler = new SelectiveRecrawler();
    
    if (args.includes('--analyze')) {
        // 분석만 실행
        recrawler.run(null, true).catch(console.error);
    } else if (args.length > 0 && !args.includes('--analyze')) {
        // 특정 도메인들 처리
        const domains = args.filter(arg => !arg.startsWith('--'));
        console.log(`특정 도메인 재처리: ${domains.join(', ')}`);
        recrawler.run(domains).catch(console.error);
    } else {
        // 자동 분석 및 재처리
        recrawler.run().catch(console.error);
    }
}

module.exports = SelectiveRecrawler;