#!/usr/bin/env node

/**
 * 터보 크롤링 데이터 임베딩 실행 스크립트
 * - 준비된 배치 데이터를 순차적으로 임베딩
 * - 실시간 진행상황 모니터링
 * - 오류 복구 및 체크포인트 시스템
 */

const fs = require('fs-extra');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

class TurboEmbeddingExecutor {
    constructor() {
        // API 클라이언트 초기화
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        
        // 경로 설정
        this.preparedPath = path.join(__dirname, '../prepared_embedding_data');
        this.batchesPath = path.join(this.preparedPath, 'batches');
        this.progressPath = path.join(this.preparedPath, 'embedding-progress.json');
        this.logPath = path.join(__dirname, '../logs/turbo-embedding.log');
        
        // 설정
        this.config = {
            embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            chunkSize: parseInt(process.env.CHUNK_SIZE) || 1000,
            chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 200,
            batchDelay: 2000, // 배치 간 대기 시간 (ms)
            retryAttempts: 3,
            retryDelay: 5000
        };
        
        // 진행상황 추적
        this.progress = {
            currentPhase: null,
            currentBatch: 0,
            totalBatches: 0,
            processedFiles: 0,
            totalFiles: 0,
            startTime: null,
            errors: [],
            completed: false
        };
        
        this.shouldStop = false;
        this.setupSignalHandlers();
    }

    setupSignalHandlers() {
        process.on('SIGINT', async () => {
            console.log('\n⏹️  중단 요청됨... 안전하게 저장 중...');
            this.shouldStop = true;
            await this.saveProgress();
            process.exit(0);
        });
    }

    async execute(resumeFromCheckpoint = false) {
        console.log('🚀 터보 크롤링 임베딩 실행 시작...\n');
        
        // 준비 상태 확인
        if (!await this.checkPreparationStatus()) {
            console.log('❌ 준비 작업이 완료되지 않았습니다. prepare-turbo-embedding.js를 먼저 실행하세요.');
            return;
        }
        
        // 체크포인트에서 재시작인지 확인
        if (resumeFromCheckpoint) {
            await this.loadProgress();
        } else {
            await this.initializeProgress();
        }
        
        // Phase 1: 고품질 데이터 임베딩
        if (this.progress.currentPhase === null || this.progress.currentPhase === 'phase1') {
            await this.executePhase('phase1');
        }
        
        // Phase 2: 대용량 데이터 배치 임베딩
        if (!this.shouldStop && (this.progress.currentPhase === null || this.progress.currentPhase === 'phase2')) {
            await this.executePhase('phase2');
        }
        
        // 완료 처리
        if (!this.shouldStop) {
            await this.completeEmbedding();
        }
    }

    async checkPreparationStatus() {
        const reportPath = path.join(this.preparedPath, 'preparation-report.json');
        
        if (!await fs.pathExists(reportPath)) {
            return false;
        }
        
        const report = await fs.readJson(reportPath);
        return report.ready_for_embedding === true;
    }

    async initializeProgress() {
        this.progress = {
            currentPhase: null,
            currentBatch: 0,
            totalBatches: 0,
            processedFiles: 0,
            totalFiles: 0,
            startTime: new Date().toISOString(),
            errors: [],
            completed: false
        };
        
        // 전체 배치 수 계산
        await this.calculateTotalBatches();
        await this.saveProgress();
    }

    async calculateTotalBatches() {
        let totalBatches = 0;
        let totalFiles = 0;
        
        for (const phase of ['phase1', 'phase2']) {
            const phaseDir = path.join(this.batchesPath, phase);
            
            if (await fs.pathExists(phaseDir)) {
                const batches = await fs.readdir(phaseDir);
                const jsonBatches = batches.filter(f => f.endsWith('.json'));
                totalBatches += jsonBatches.length;
                
                // 파일 수 계산
                for (const batchFile of jsonBatches) {
                    const batchPath = path.join(phaseDir, batchFile);
                    const batchData = await fs.readJson(batchPath);
                    totalFiles += batchData.fileCount;
                }
            }
        }
        
        this.progress.totalBatches = totalBatches;
        this.progress.totalFiles = totalFiles;
        
        console.log(`📊 총 ${totalBatches}개 배치, ${totalFiles.toLocaleString()}개 파일 임베딩 예정`);
    }

    async executePhase(phaseName) {
        console.log(`\n📋 ${phaseName.toUpperCase()} 임베딩 시작...`);
        
        const phaseDir = path.join(this.batchesPath, phaseName);
        
        if (!await fs.pathExists(phaseDir)) {
            console.log(`   ⚠️  ${phaseName} 디렉토리가 존재하지 않음`);
            return;
        }
        
        const batches = await fs.readdir(phaseDir);
        const jsonBatches = batches.filter(f => f.endsWith('.json')).sort();
        
        this.progress.currentPhase = phaseName;
        
        for (let i = 0; i < jsonBatches.length; i++) {
            if (this.shouldStop) break;
            
            // 재시작 시 건너뛰기 처리
            if (this.progress.currentBatch > i) {
                continue;
            }
            
            const batchFile = jsonBatches[i];
            const batchPath = path.join(phaseDir, batchFile);
            
            console.log(`\n   배치 ${i + 1}/${jsonBatches.length}: ${batchFile}`);
            
            try {
                await this.processBatch(batchPath, i + 1);
                this.progress.currentBatch = i + 1;
                
                // 배치 간 대기
                if (i < jsonBatches.length - 1) {
                    console.log(`     ${this.config.batchDelay/1000}초 대기...`);
                    await this.sleep(this.config.batchDelay);
                }
                
            } catch (error) {
                const errorInfo = {
                    batch: batchFile,
                    phase: phaseName,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
                
                this.progress.errors.push(errorInfo);
                console.error(`     ❌ 배치 처리 실패: ${error.message}`);
                
                // 재시도 로직
                let retrySuccess = false;
                for (let retry = 1; retry <= this.config.retryAttempts; retry++) {
                    console.log(`     🔄 재시도 ${retry}/${this.config.retryAttempts}...`);
                    
                    await this.sleep(this.config.retryDelay);
                    
                    try {
                        await this.processBatch(batchPath, i + 1);
                        retrySuccess = true;
                        break;
                    } catch (retryError) {
                        console.error(`     ❌ 재시도 ${retry} 실패: ${retryError.message}`);
                    }
                }
                
                if (!retrySuccess) {
                    console.error(`     💥 배치 ${batchFile} 최종 실패 - 다음 배치로 진행`);
                }
            }
            
            await this.saveProgress();
        }
        
        // Phase 완료 후 배치 카운터 리셋
        this.progress.currentBatch = 0;
        console.log(`\n✅ ${phaseName.toUpperCase()} 완료!`);
    }

    async processBatch(batchPath, batchNumber) {
        const batchData = await fs.readJson(batchPath);
        const { files } = batchData;
        
        console.log(`     처리할 파일: ${files.length}개`);
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                // 텍스트 청크 분할
                const chunks = this.splitIntoChunks(file.content);
                
                // 각 청크에 대해 임베딩 생성 및 저장
                for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
                    const chunk = chunks[chunkIndex];
                    
                    // OpenAI 임베딩 생성
                    const embeddingResponse = await this.openai.embeddings.create({
                        model: this.config.embeddingModel,
                        input: chunk,
                    });
                    
                    const embedding = embeddingResponse.data[0].embedding;
                    
                    // Supabase에 저장
                    const { error } = await this.supabase
                        .from('documents')
                        .insert({
                            content: chunk,
                            embedding: embedding,
                            source_type: 'turbo_crawling',
                            metadata: {
                                original_url: file.url,
                                domain: file.domain,
                                folder: file.folder,
                                file_name: file.file,
                                chunk_index: chunkIndex,
                                total_chunks: chunks.length,
                                content_length: chunk.length,
                                timestamp: file.metadata.timestamp,
                                crawling_depth: file.metadata.depth,
                                crawling_method: file.metadata.method || 'unknown'
                            }
                        });
                    
                    if (error) {
                        throw new Error(`Supabase 저장 오류: ${error.message}`);
                    }
                }
                
                this.progress.processedFiles++;
                
                // 진행률 표시
                if (i % 10 === 0 || i === files.length - 1) {
                    const totalProgress = (this.progress.processedFiles / this.progress.totalFiles * 100).toFixed(1);
                    console.log(`       파일 ${i + 1}/${files.length} 완료 (전체: ${totalProgress}%)`);
                }
                
            } catch (error) {
                console.error(`       ❌ 파일 처리 오류: ${file.file} - ${error.message}`);
                throw error; // 배치 전체 재시도를 위해 에러 전파
            }
        }
    }

    splitIntoChunks(text) {
        const chunks = [];
        const chunkSize = this.config.chunkSize;
        const overlap = this.config.chunkOverlap;
        
        if (text.length <= chunkSize) {
            return [text];
        }
        
        let start = 0;
        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            const chunk = text.slice(start, end);
            
            // 의미 있는 단위로 자르기 (문장 끝에서 자르기)
            if (end < text.length) {
                const lastSentence = chunk.lastIndexOf('.');
                const lastNewline = chunk.lastIndexOf('\n');
                const cutPoint = Math.max(lastSentence, lastNewline);
                
                if (cutPoint > start + chunkSize * 0.5) {
                    chunks.push(chunk.slice(0, cutPoint + 1).trim());
                    start = cutPoint + 1 - overlap;
                } else {
                    chunks.push(chunk.trim());
                    start = end - overlap;
                }
            } else {
                chunks.push(chunk.trim());
                break;
            }
        }
        
        return chunks.filter(chunk => chunk.length > 50); // 너무 짧은 청크 제거
    }

    async saveProgress() {
        await fs.writeJson(this.progressPath, this.progress, { spaces: 2 });
    }

    async loadProgress() {
        if (await fs.pathExists(this.progressPath)) {
            this.progress = await fs.readJson(this.progressPath);
            console.log(`📋 체크포인트에서 재시작: ${this.progress.currentPhase || 'phase1'} 배치 ${this.progress.currentBatch}`);
        }
    }

    async completeEmbedding() {
        this.progress.completed = true;
        this.progress.completedTime = new Date().toISOString();
        
        const startTime = new Date(this.progress.startTime);
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000 / 60);
        
        await this.saveProgress();
        
        console.log('\n' + '='.repeat(80));
        console.log('🎉 터보 크롤링 임베딩 완료!');
        console.log('='.repeat(80));
        console.log(`📊 처리 통계:`);
        console.log(`   - 총 처리 파일: ${this.progress.processedFiles.toLocaleString()}개`);
        console.log(`   - 소요 시간: ${duration}분`);
        console.log(`   - 평균 속도: ${Math.round(this.progress.processedFiles / duration)}파일/분`);
        console.log(`   - 오류 수: ${this.progress.errors.length}개`);
        console.log('='.repeat(80));
        console.log('💡 이제 챗봇에서 새로운 데이터를 사용할 수 있습니다!');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 실행
if (require.main === module) {
    const args = process.argv.slice(2);
    const resume = args.includes('--resume');
    
    const executor = new TurboEmbeddingExecutor();
    executor.execute(resume).catch(console.error);
}

module.exports = TurboEmbeddingExecutor;