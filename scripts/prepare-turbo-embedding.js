#!/usr/bin/env node

/**
 * 터보 크롤링 데이터 임베딩 준비 스크립트
 * - 3단계 통합 전략 구현
 * - 중복 제거 및 품질 필터링
 * - 배치 처리 준비
 */

const fs = require('fs-extra');
const path = require('path');

class TurboEmbeddingPreparer {
    constructor() {
        this.basePath = path.join(__dirname, '../crawlingTest');
        
        // 크롤링 데이터 폴더
        this.folders = {
            enhanced_strategic_output: path.join(this.basePath, 'enhanced_strategic_output'),
            enhanced_output: path.join(this.basePath, 'enhanced_output'),
            unlimited_crawling_output: path.join(this.basePath, 'unlimited_crawling_output')
        };
        
        // 준비된 데이터 저장 경로
        this.preparedPath = path.join(__dirname, '../prepared_embedding_data');
        this.batchesPath = path.join(this.preparedPath, 'batches');
        
        // 설정
        this.config = {
            batchSize: 500,          // 배치당 파일 수
            minContentLength: 100,   // 최소 내용 길이
            maxContentLength: 50000, // 최대 내용 길이
        };
        
        // 상태 추적
        this.stats = {
            phase1_files: 0,
            phase2_files: 0,
            duplicates_removed: 0,
            quality_filtered: 0,
            total_prepared: 0,
            batches_created: 0
        };
        
        this.urlMap = new Map();
        this.processedFiles = [];
    }

    async prepare() {
        console.log('🚀 터보 크롤링 임베딩 준비 시작...\n');
        
        // 준비 폴더 생성
        await this.createPreparedFolders();
        
        // 3단계 준비 실행
        await this.phase1_HighQualityData();
        await this.phase2_BatchProcessing();
        
        // 최종 보고서 생성
        await this.generatePreparedReport();
        
        console.log('\n✅ 모든 준비 작업 완료!');
        console.log('💡 이제 "npm run start-turbo-embedding" 명령으로 임베딩을 시작할 수 있습니다.');
    }

    async createPreparedFolders() {
        await fs.ensureDir(this.preparedPath);
        await fs.ensureDir(this.batchesPath);
        
        console.log(`📁 준비 폴더 생성됨: ${this.preparedPath}`);
    }

    async phase1_HighQualityData() {
        console.log('📋 Phase 1: 고품질 데이터 준비 중...');
        
        // 1-1. enhanced_strategic_output (최우선)
        await this.processFolder('enhanced_strategic_output', 1);
        
        // 1-2. enhanced_output (2순위)
        await this.processFolder('enhanced_output', 2);
        
        console.log(`   Phase 1 완료: ${this.stats.phase1_files}개 파일 준비됨\n`);
    }

    async phase2_BatchProcessing() {
        console.log('📋 Phase 2: 대용량 데이터 배치 준비 중...');
        
        // unlimited_crawling_output을 배치로 분할
        await this.processFolder('unlimited_crawling_output', 3);
        
        console.log(`   Phase 2 완료: ${this.stats.phase2_files}개 파일 준비됨\n`);
    }

    async processFolder(folderName, priority) {
        const folderPath = this.folders[folderName];
        
        if (!await fs.pathExists(folderPath)) {
            console.log(`⚠️  폴더가 존재하지 않음: ${folderName}`);
            return;
        }
        
        const files = await fs.readdir(folderPath);
        const txtFiles = files.filter(f => f.endsWith('.txt'));
        
        console.log(`   ${folderName}: ${txtFiles.length.toLocaleString()}개 파일 처리 중...`);
        
        let processed = 0;
        let skipped = 0;
        
        for (const file of txtFiles) {
            try {
                const filePath = path.join(folderPath, file);
                const content = await fs.readFile(filePath, 'utf8');
                
                // 메타데이터 파싱
                const metadata = this.parseMetadata(content);
                const textContent = this.extractTextContent(content);
                
                // 품질 검사
                if (!this.passesQualityCheck(textContent, metadata)) {
                    skipped++;
                    this.stats.quality_filtered++;
                    continue;
                }
                
                // 중복 검사
                if (this.isDuplicate(metadata.url, priority)) {
                    skipped++;
                    this.stats.duplicates_removed++;
                    continue;
                }
                
                // URL 등록
                if (metadata.url) {
                    this.urlMap.set(metadata.url, {
                        folder: folderName,
                        file: file,
                        priority: priority,
                        timestamp: metadata.timestamp
                    });
                }
                
                // 처리된 파일 정보 저장
                const processedFile = {
                    originalPath: filePath,
                    folder: folderName,
                    file: file,
                    url: metadata.url,
                    domain: metadata.domain,
                    length: textContent.length,
                    priority: priority,
                    timestamp: metadata.timestamp,
                    content: textContent,
                    metadata: metadata
                };
                
                this.processedFiles.push(processedFile);
                processed++;
                
                // Phase별 통계 업데이트
                if (priority <= 2) {
                    this.stats.phase1_files++;
                } else {
                    this.stats.phase2_files++;
                }
                
                // 진행상황 표시
                if (processed % 1000 === 0) {
                    console.log(`     진행: ${processed.toLocaleString()}개 처리됨`);
                }
                
            } catch (error) {
                console.log(`     ⚠️  파일 처리 오류: ${file} - ${error.message}`);
                skipped++;
            }
        }
        
        console.log(`     완료: ${processed.toLocaleString()}개 처리, ${skipped.toLocaleString()}개 스킵`);
    }

    parseMetadata(content) {
        const lines = content.split('\n');
        const metadata = {};
        
        for (const line of lines.slice(0, 15)) {
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
            } else if (line.startsWith('[METHOD]')) {
                metadata.method = line.replace('[METHOD]', '').trim();
            }
        }
        
        return metadata;
    }

    extractTextContent(content) {
        const lines = content.split('\n');
        let contentStartIndex = 0;
        
        // 메타데이터 섹션 건너뛰기
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '' && i > 5) {
                contentStartIndex = i + 1;
                break;
            }
        }
        
        return lines.slice(contentStartIndex).join('\n').trim();
    }

    passesQualityCheck(content, metadata) {
        // 내용 길이 검사
        if (content.length < this.config.minContentLength) {
            return false;
        }
        
        if (content.length > this.config.maxContentLength) {
            return false;
        }
        
        // 의미 있는 내용 검사
        const meaningfulContent = content
            .replace(/\s+/g, ' ')
            .replace(/[^\w가-힣\s]/g, '')
            .trim();
        
        if (meaningfulContent.length < this.config.minContentLength * 0.5) {
            return false;
        }
        
        // 도메인 검사 (daejin.ac.kr 관련만)
        if (metadata.domain && !metadata.domain.includes('daejin.ac.kr')) {
            return false;
        }
        
        return true;
    }

    isDuplicate(url, currentPriority) {
        if (!url || !this.urlMap.has(url)) {
            return false;
        }
        
        const existing = this.urlMap.get(url);
        
        // 현재 우선순위가 더 높으면 기존 것을 중복으로 처리
        if (currentPriority < existing.priority) {
            return false; // 현재 것을 사용
        }
        
        // 기존 우선순위가 더 높거나 같으면 현재 것을 중복으로 처리
        return true;
    }

    async generatePreparedReport() {
        // 배치 생성
        await this.createBatches();
        
        // 통계 계산
        this.stats.total_prepared = this.processedFiles.length;
        
        // 보고서 생성
        const report = {
            timestamp: new Date().toISOString(),
            config: this.config,
            statistics: this.stats,
            folders_processed: Object.keys(this.folders),
            prepared_files_path: this.preparedPath,
            batches_path: this.batchesPath,
            phase1_ready: this.stats.phase1_files > 0,
            phase2_ready: this.stats.phase2_files > 0,
            ready_for_embedding: true
        };
        
        const reportPath = path.join(this.preparedPath, 'preparation-report.json');
        await fs.writeJson(reportPath, report, { spaces: 2 });
        
        // 파일 목록 저장
        const fileListPath = path.join(this.preparedPath, 'prepared-files-list.json');
        await fs.writeJson(fileListPath, this.processedFiles, { spaces: 2 });
        
        console.log('📋 준비 보고서 생성 완료:');
        console.log(`   총 준비 파일: ${this.stats.total_prepared.toLocaleString()}개`);
        console.log(`   Phase 1: ${this.stats.phase1_files.toLocaleString()}개`);
        console.log(`   Phase 2: ${this.stats.phase2_files.toLocaleString()}개`);
        console.log(`   중복 제거: ${this.stats.duplicates_removed.toLocaleString()}개`);
        console.log(`   품질 필터링: ${this.stats.quality_filtered.toLocaleString()}개`);
        console.log(`   생성된 배치: ${this.stats.batches_created}개`);
    }

    async createBatches() {
        console.log('📦 배치 파일 생성 중...');
        
        // Phase 1과 Phase 2를 분리하여 배치 생성
        const phase1Files = this.processedFiles.filter(f => f.priority <= 2);
        const phase2Files = this.processedFiles.filter(f => f.priority > 2);
        
        // Phase 1 배치 (즉시 처리용)
        if (phase1Files.length > 0) {
            await this.createPhaseBatches(phase1Files, 'phase1');
        }
        
        // Phase 2 배치 (점진적 처리용)
        if (phase2Files.length > 0) {
            await this.createPhaseBatches(phase2Files, 'phase2');
        }
    }

    async createPhaseBatches(files, phaseName) {
        const phaseDir = path.join(this.batchesPath, phaseName);
        await fs.ensureDir(phaseDir);
        
        const batchCount = Math.ceil(files.length / this.config.batchSize);
        
        for (let i = 0; i < batchCount; i++) {
            const startIdx = i * this.config.batchSize;
            const endIdx = Math.min(startIdx + this.config.batchSize, files.length);
            const batchFiles = files.slice(startIdx, endIdx);
            
            const batchData = {
                batchNumber: i + 1,
                totalBatches: batchCount,
                phase: phaseName,
                fileCount: batchFiles.length,
                files: batchFiles.map(f => ({
                    file: f.file,
                    folder: f.folder,
                    url: f.url,
                    domain: f.domain,
                    length: f.length,
                    content: f.content,
                    metadata: f.metadata
                }))
            };
            
            const batchPath = path.join(phaseDir, `batch_${String(i + 1).padStart(3, '0')}.json`);
            await fs.writeJson(batchPath, batchData, { spaces: 2 });
            
            this.stats.batches_created++;
        }
        
        console.log(`   ${phaseName}: ${batchCount}개 배치 생성됨`);
    }
}

// 실행
if (require.main === module) {
    const preparer = new TurboEmbeddingPreparer();
    preparer.prepare().catch(console.error);
}

module.exports = TurboEmbeddingPreparer;