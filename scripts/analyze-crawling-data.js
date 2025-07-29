#!/usr/bin/env node

/**
 * 크롤링 데이터 분석 및 중복 검사 스크립트
 * - 3개 크롤링 폴더의 데이터 품질 분석
 * - URL 기반 중복 검사
 * - 도메인별 분포 분석
 */

const fs = require('fs-extra');
const path = require('path');

class CrawlingDataAnalyzer {
    constructor() {
        this.basePath = path.join(__dirname, '../crawlingTest');
        this.folders = {
            enhanced_output: path.join(this.basePath, 'enhanced_output'),
            unlimited_crawling_output: path.join(this.basePath, 'unlimited_crawling_output'),
            enhanced_strategic_output: path.join(this.basePath, 'enhanced_strategic_output')
        };
        
        this.analysis = {
            folders: {},
            urlMap: new Map(),
            domainStats: {},
            duplicates: [],
            totalFiles: 0
        };
    }

    async analyzeFolders() {
        console.log('🔍 크롤링 데이터 분석 시작...\n');
        
        for (const [folderName, folderPath] of Object.entries(this.folders)) {
            if (!await fs.pathExists(folderPath)) {
                console.log(`⚠️  폴더가 존재하지 않음: ${folderName}`);
                continue;
            }
            
            console.log(`📁 ${folderName} 분석 중...`);
            const folderAnalysis = await this.analyzeSingleFolder(folderName, folderPath);
            this.analysis.folders[folderName] = folderAnalysis;
            
            console.log(`   파일 수: ${folderAnalysis.fileCount.toLocaleString()}개`);
            console.log(`   평균 크기: ${Math.round(folderAnalysis.avgSize / 1024)}KB`);
            console.log(`   도메인 수: ${folderAnalysis.domains.length}개`);
            console.log(`   시간 범위: ${folderAnalysis.timeRange.start} ~ ${folderAnalysis.timeRange.end}\n`);
        }
        
        await this.findDuplicates();
        await this.generateReport();
    }

    async analyzeSingleFolder(folderName, folderPath) {
        const files = await fs.readdir(folderPath);
        const txtFiles = files.filter(f => f.endsWith('.txt')).slice(0, 100); // 샘플링
        
        const analysis = {
            fileCount: files.filter(f => f.endsWith('.txt')).length,
            domains: new Set(),
            sizes: [],
            timeRange: { start: null, end: null },
            sampleFiles: []
        };
        
        this.analysis.totalFiles += analysis.fileCount;
        
        for (const file of txtFiles) {
            try {
                const filePath = path.join(folderPath, file);
                const content = await fs.readFile(filePath, 'utf8');
                const metadata = this.parseMetadata(content);
                
                if (metadata.url) {
                    // URL 중복 검사를 위한 맵 구축
                    if (this.analysis.urlMap.has(metadata.url)) {
                        this.analysis.urlMap.get(metadata.url).push({
                            folder: folderName,
                            file: file,
                            timestamp: metadata.timestamp,
                            length: metadata.length
                        });
                    } else {
                        this.analysis.urlMap.set(metadata.url, [{
                            folder: folderName,
                            file: file,
                            timestamp: metadata.timestamp,
                            length: metadata.length
                        }]);
                    }
                    
                    // 도메인 분석
                    if (metadata.domain) {
                        analysis.domains.add(metadata.domain);
                        
                        if (!this.analysis.domainStats[metadata.domain]) {
                            this.analysis.domainStats[metadata.domain] = {
                                enhanced_output: 0,
                                unlimited_crawling_output: 0,
                                enhanced_strategic_output: 0
                            };
                        }
                        this.analysis.domainStats[metadata.domain][folderName]++;
                    }
                }
                
                // 파일 크기 및 시간 분석
                const stat = await fs.stat(filePath);
                analysis.sizes.push(stat.size);
                
                if (metadata.timestamp) {
                    const timestamp = new Date(metadata.timestamp);
                    if (!analysis.timeRange.start || timestamp < new Date(analysis.timeRange.start)) {
                        analysis.timeRange.start = metadata.timestamp;
                    }
                    if (!analysis.timeRange.end || timestamp > new Date(analysis.timeRange.end)) {
                        analysis.timeRange.end = metadata.timestamp;
                    }
                }
                
                analysis.sampleFiles.push({
                    file,
                    url: metadata.url,
                    domain: metadata.domain,
                    length: metadata.length,
                    timestamp: metadata.timestamp
                });
                
            } catch (error) {
                console.log(`   ⚠️  파일 읽기 오류: ${file} - ${error.message}`);
            }
        }
        
        analysis.domains = Array.from(analysis.domains);
        analysis.avgSize = analysis.sizes.length > 0 ? 
            analysis.sizes.reduce((a, b) => a + b, 0) / analysis.sizes.length : 0;
        
        return analysis;
    }

    parseMetadata(content) {
        const lines = content.split('\n');
        const metadata = {};
        
        for (const line of lines.slice(0, 10)) { // 처음 10줄만 확인
            if (line.startsWith('[URL]')) {
                metadata.url = line.replace('[URL]', '').trim();
            } else if (line.startsWith('[DOMAIN]')) {
                metadata.domain = line.replace('[DOMAIN]', '').trim();
            } else if (line.startsWith('[TIMESTAMP]')) {
                metadata.timestamp = line.replace('[TIMESTAMP]', '').trim();
            } else if (line.startsWith('[LENGTH]')) {
                metadata.length = parseInt(line.replace('[LENGTH]', '').trim());
            } else if (line.startsWith('[DEPTH]')) {
                metadata.depth = parseInt(line.replace('[DEPTH]', '').trim());
            }
        }
        
        return metadata;
    }

    async findDuplicates() {
        console.log('🔍 중복 URL 검사 중...');
        
        for (const [url, entries] of this.analysis.urlMap.entries()) {
            if (entries.length > 1) {
                // 동일 URL에 대해 최신/고품질 버전 선택
                const sorted = entries.sort((a, b) => {
                    // 1. enhanced_strategic_output 우선
                    if (a.folder === 'enhanced_strategic_output' && b.folder !== 'enhanced_strategic_output') return -1;
                    if (b.folder === 'enhanced_strategic_output' && a.folder !== 'enhanced_strategic_output') return 1;
                    
                    // 2. 타임스탬프 최신순
                    if (a.timestamp && b.timestamp) {
                        return new Date(b.timestamp) - new Date(a.timestamp);
                    }
                    
                    // 3. 내용 길이순
                    return (b.length || 0) - (a.length || 0);
                });
                
                this.analysis.duplicates.push({
                    url,
                    entries,
                    recommended: sorted[0], // 권장 버전
                    duplicateCount: entries.length - 1
                });
            }
        }
        
        console.log(`   발견된 중복 URL: ${this.analysis.duplicates.length}개`);
    }

    async generateReport() {
        const reportPath = path.join(__dirname, '../crawling-analysis-report.json');
        const summaryPath = path.join(__dirname, '../crawling-analysis-summary.txt');
        
        // 상세 보고서 (JSON)
        await fs.writeJson(reportPath, this.analysis, { spaces: 2 });
        
        // 요약 보고서 (텍스트)
        const summary = this.generateSummaryText();
        await fs.writeFile(summaryPath, summary, 'utf8');
        
        console.log(`\n📋 분석 완료!`);
        console.log(`   상세 보고서: ${reportPath}`);
        console.log(`   요약 보고서: ${summaryPath}`);
        
        // 콘솔에 요약 출력
        console.log('\n' + '='.repeat(80));
        console.log(summary);
        console.log('='.repeat(80));
    }

    generateSummaryText() {
        const { folders, duplicates, domainStats, totalFiles } = this.analysis;
        
        let summary = `🚀 대진대 크롤링 데이터 분석 보고서\n`;
        summary += `생성 시간: ${new Date().toLocaleString('ko-KR')}\n\n`;
        
        summary += `📊 전체 현황\n`;
        summary += `총 크롤링 파일: ${totalFiles.toLocaleString()}개\n`;
        summary += `중복 URL: ${duplicates.length}개\n`;
        summary += `고유 도메인: ${Object.keys(domainStats).length}개\n\n`;
        
        summary += `📁 폴더별 상세 정보\n`;
        for (const [folderName, data] of Object.entries(folders)) {
            summary += `\n${folderName}:\n`;
            summary += `  - 파일 수: ${data.fileCount.toLocaleString()}개\n`;
            summary += `  - 평균 크기: ${Math.round(data.avgSize / 1024)}KB\n`;
            summary += `  - 도메인 수: ${data.domains.length}개\n`;
            summary += `  - 기간: ${data.timeRange.start || 'N/A'} ~ ${data.timeRange.end || 'N/A'}\n`;
        }
        
        summary += `\n🏆 상위 도메인 (파일 수 기준)\n`;
        const sortedDomains = Object.entries(domainStats)
            .map(([domain, counts]) => ({
                domain,
                total: Object.values(counts).reduce((a, b) => a + b, 0),
                counts
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
        
        for (const { domain, total, counts } of sortedDomains) {
            summary += `${domain}: ${total}개 `;
            summary += `(S:${counts.enhanced_strategic_output}, E:${counts.enhanced_output}, U:${counts.unlimited_crawling_output})\n`;
        }
        
        summary += `\n🔍 중복 URL 상위 10개\n`;
        const topDuplicates = duplicates
            .sort((a, b) => b.duplicateCount - a.duplicateCount)
            .slice(0, 10);
        
        for (const dup of topDuplicates) {
            summary += `${dup.url} (${dup.duplicateCount + 1}회 중복)\n`;
            summary += `  권장: ${dup.recommended.folder}/${dup.recommended.file}\n`;
        }
        
        summary += `\n💡 통합 권장사항\n`;
        summary += `1. enhanced_strategic_output (${folders.enhanced_strategic_output?.fileCount || 0}개) - 최우선 통합\n`;
        summary += `2. enhanced_output (${folders.enhanced_output?.fileCount || 0}개) - 2순위 통합\n`;
        summary += `3. unlimited_crawling_output (${folders.unlimited_crawling_output?.fileCount || 0}개) - 배치 처리 통합\n`;
        summary += `\n중복 제거 후 예상 파일 수: ${totalFiles - duplicates.length}개\n`;
        
        return summary;
    }
}

// 실행
if (require.main === module) {
    const analyzer = new CrawlingDataAnalyzer();
    analyzer.analyzeFolders().catch(console.error);
}

module.exports = CrawlingDataAnalyzer;