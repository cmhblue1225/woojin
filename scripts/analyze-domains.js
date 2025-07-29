// 도메인별 크롤링 데이터 분석 스크립트
const fs = require('fs-extra');
const path = require('path');

class DomainAnalyzer {
    constructor() {
        this.crawlDataDir = path.join(__dirname, '../crawlingTest/enhanced_output');
        this.logFile = path.join(__dirname, '../logs/domain-analysis.log');
        
        // 로그 디렉토리 확인
        fs.ensureDirSync(path.dirname(this.logFile));
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }

    // 페이지 파일에서 도메인 정보 추출
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
                    const textLength = textContent.trim().length;
                    
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
                        actualLength: textLength,
                        timestamp,
                        category: this.categorizeUrl(url, domain)
                    };
                }
            }
            
            // 메타데이터만 있고 텍스트가 없는 경우
            return {
                file: path.basename(filePath),
                url,
                domain: domain || 'unknown',
                depth,
                declaredLength: length,
                actualLength: 0,
                timestamp,
                category: this.categorizeUrl(url, domain)
            };
        } catch (error) {
            this.log(`❌ 파일 파싱 실패 ${filePath}: ${error.message}`);
            return null;
        }
    }

    // URL 기반 카테고리 분류
    categorizeUrl(url, domain) {
        const urlLower = url.toLowerCase();
        
        // 학과별 도메인 분류
        const departmentMap = {
            'ce.daejin.ac.kr': '토목환경공학과',
            'aidata.daejin.ac.kr': 'AI데이터사이언스학과',
            'security.daejin.ac.kr': '정보보안학과',
            'arte.daejin.ac.kr': '아르테크네대학',
            'eng.daejin.ac.kr': '공과대학',
            'law.daejin.ac.kr': '법과대학',
            'sm.daejin.ac.kr': '스마트미디어학과',
            'library.daejin.ac.kr': '도서관'
        };
        
        if (departmentMap[domain]) {
            return {
                type: 'department',
                name: departmentMap[domain],
                domain: domain
            };
        }
        
        // URL 패턴별 분류
        if (urlLower.includes('notice') || urlLower.includes('공지')) {
            return { type: 'notice', name: '공지사항', domain: domain };
        }
        if (urlLower.includes('news') || urlLower.includes('뉴스')) {
            return { type: 'news', name: '뉴스', domain: domain };
        }
        if (urlLower.includes('admission') || urlLower.includes('입학')) {
            return { type: 'admission', name: '입학정보', domain: domain };
        }
        if (urlLower.includes('academic') || urlLower.includes('학사')) {
            return { type: 'academic', name: '학사정보', domain: domain };
        }
        if (urlLower.includes('scholarship') || urlLower.includes('장학')) {
            return { type: 'scholarship', name: '장학정보', domain: domain };
        }
        
        return { type: 'general', name: '일반', domain: domain };
    }

    // 도메인별 통계 생성
    generateDomainStats(pages) {
        const domainStats = {};
        const categoryStats = {};
        const depthStats = {};
        
        let totalPages = 0;
        let totalTextLength = 0;
        let validPages = 0;
        
        for (const page of pages) {
            if (!page) continue;
            
            totalPages++;
            if (page.actualLength > 100) {
                validPages++;
                totalTextLength += page.actualLength;
            }
            
            // 도메인별 통계
            if (!domainStats[page.domain]) {
                domainStats[page.domain] = {
                    count: 0,
                    totalLength: 0,
                    avgLength: 0,
                    maxDepth: 0,
                    minDepth: 999,
                    categories: new Set()
                };
            }
            
            const domainStat = domainStats[page.domain];
            domainStat.count++;
            domainStat.totalLength += page.actualLength;
            domainStat.maxDepth = Math.max(domainStat.maxDepth, page.depth);
            domainStat.minDepth = Math.min(domainStat.minDepth, page.depth);
            domainStat.categories.add(page.category.name);
            
            // 카테고리별 통계
            const categoryKey = `${page.category.type}_${page.domain}`;
            if (!categoryStats[categoryKey]) {
                categoryStats[categoryKey] = {
                    domain: page.domain,
                    type: page.category.type,
                    name: page.category.name,
                    count: 0,
                    totalLength: 0
                };
            }
            categoryStats[categoryKey].count++;
            categoryStats[categoryKey].totalLength += page.actualLength;
            
            // 깊이별 통계
            if (!depthStats[page.depth]) {
                depthStats[page.depth] = { count: 0, domains: new Set() };
            }
            depthStats[page.depth].count++;
            depthStats[page.depth].domains.add(page.domain);
        }
        
        // 평균 계산
        Object.values(domainStats).forEach(stat => {
            stat.avgLength = Math.round(stat.totalLength / stat.count);
            stat.categories = Array.from(stat.categories);
        });
        
        Object.values(categoryStats).forEach(stat => {
            stat.avgLength = Math.round(stat.totalLength / stat.count);
        });
        
        Object.values(depthStats).forEach(stat => {
            stat.domains = Array.from(stat.domains);
        });
        
        return {
            summary: {
                totalPages,
                validPages,
                totalTextLength,
                avgTextLength: Math.round(totalTextLength / validPages),
                domainCount: Object.keys(domainStats).length
            },
            domains: domainStats,
            categories: categoryStats,
            depths: depthStats
        };
    }

    // 임베딩 비용 계산
    calculateEmbeddingCost(stats) {
        const tokensPerChar = 1.5; // 한국어 평균
        const costPer1kTokens = 0.00002; // text-embedding-3-small 가격
        
        const totalTokens = stats.summary.totalTextLength * tokensPerChar;
        const totalCost = (totalTokens / 1000) * costPer1kTokens;
        
        const domainCosts = {};
        Object.entries(stats.domains).forEach(([domain, stat]) => {
            const domainTokens = stat.totalLength * tokensPerChar;
            domainCosts[domain] = {
                tokens: Math.round(domainTokens),
                cost: Math.round((domainTokens / 1000) * costPer1kTokens * 100) / 100
            };
        });
        
        return {
            totalTokens: Math.round(totalTokens),
            totalCost: Math.round(totalCost * 100) / 100,
            domainCosts
        };
    }

    // 분석 실행
    async analyze() {
        try {
            this.log('🔍 도메인별 크롤링 데이터 분석 시작');
            
            // 모든 페이지 파일 읽기
            const files = await fs.readdir(this.crawlDataDir);
            const pageFiles = files.filter(file => file.startsWith('page_') && file.endsWith('.txt'));
            
            this.log(`📄 분석할 파일 수: ${pageFiles.length}개`);
            
            const pages = [];
            let processed = 0;
            
            for (const file of pageFiles.sort()) {
                const filePath = path.join(this.crawlDataDir, file);
                const pageData = await this.parsePageFile(filePath);
                
                if (pageData) {
                    pages.push(pageData);
                }
                
                processed++;
                if (processed % 500 === 0) {
                    this.log(`📊 진행률: ${processed}/${pageFiles.length} (${Math.round(processed/pageFiles.length*100)}%)`);
                }
            }
            
            // 통계 생성
            const stats = this.generateDomainStats(pages);
            const costAnalysis = this.calculateEmbeddingCost(stats);
            
            // 결과 출력
            this.log('\n📊 === 도메인별 분석 결과 ===');
            this.log(`\n🔢 전체 요약:`);
            this.log(`  • 총 페이지: ${stats.summary.totalPages}개`);
            this.log(`  • 유효 페이지: ${stats.summary.validPages}개`);
            this.log(`  • 총 텍스트 길이: ${stats.summary.totalTextLength.toLocaleString()}자`);
            this.log(`  • 평균 텍스트 길이: ${stats.summary.avgTextLength}자`);
            this.log(`  • 도메인 수: ${stats.summary.domainCount}개`);
            
            this.log(`\n🏢 도메인별 상세 통계:`);
            const sortedDomains = Object.entries(stats.domains)
                .sort(([,a], [,b]) => b.count - a.count);
            
            for (const [domain, stat] of sortedDomains) {
                this.log(`  📁 ${domain}:`);
                this.log(`    • 페이지 수: ${stat.count}개`);
                this.log(`    • 총 텍스트: ${stat.totalLength.toLocaleString()}자`);
                this.log(`    • 평균 길이: ${stat.avgLength}자`);
                this.log(`    • 크롤링 깊이: ${stat.minDepth}-${stat.maxDepth}`);
                this.log(`    • 카테고리: ${stat.categories.join(', ')}`);
            }
            
            this.log(`\n💰 임베딩 비용 분석:`);
            this.log(`  • 총 토큰 수: ${costAnalysis.totalTokens.toLocaleString()}개`);
            this.log(`  • 예상 총 비용: $${costAnalysis.totalCost}`);
            this.log(`\n💰 도메인별 비용:`);
            
            const sortedCosts = Object.entries(costAnalysis.domainCosts)
                .sort(([,a], [,b]) => b.cost - a.cost);
            
            for (const [domain, cost] of sortedCosts) {
                this.log(`    ${domain}: $${cost.cost} (${cost.tokens.toLocaleString()} 토큰)`);
            }
            
            // JSON 파일로 저장
            const resultPath = path.join(__dirname, '../logs/domain-analysis-result.json');
            await fs.writeFile(resultPath, JSON.stringify({
                timestamp: new Date().toISOString(),
                stats,
                costAnalysis,
                pages: pages.slice(0, 10) // 샘플 데이터만 저장
            }, null, 2));
            
            this.log(`\n💾 분석 결과 저장: ${resultPath}`);
            this.log('✅ 도메인별 분석 완료!');
            
            return { stats, costAnalysis };
            
        } catch (error) {
            this.log(`💥 분석 실패: ${error.message}`);
            throw error;
        }
    }
}

// 스크립트 직접 실행
if (require.main === module) {
    const analyzer = new DomainAnalyzer();
    analyzer.analyze().catch(console.error);
}

module.exports = DomainAnalyzer;