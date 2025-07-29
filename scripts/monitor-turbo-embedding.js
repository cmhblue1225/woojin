#!/usr/bin/env node

/**
 * 터보 임베딩 실시간 모니터링 스크립트
 * - 실시간 진행상황 표시
 * - 성능 통계 및 예상 완료 시간
 * - 에러 및 알림 시스템
 */

const fs = require('fs-extra');
const path = require('path');

class TurboEmbeddingMonitor {
    constructor() {
        this.progressPath = path.join(__dirname, '../prepared_embedding_data/embedding-progress.json');
        this.reportPath = path.join(__dirname, '../prepared_embedding_data/preparation-report.json');
        
        this.lastProgress = null;
        this.startTime = null;
        this.speedHistory = [];
        this.maxSpeedHistory = 20; // 최근 20개 기록만 유지
        
        this.isMonitoring = false;
    }

    async startMonitoring(interval = 10000) {
        console.log('👀 터보 임베딩 실시간 모니터링 시작...');
        console.log('💡 Ctrl+C로 모니터링을 중단할 수 있습니다.\n');
        
        this.isMonitoring = true;
        
        // 신호 처리
        process.on('SIGINT', () => {
            this.isMonitoring = false;
            console.log('\n👋 모니터링을 중단했습니다.');
            process.exit(0);
        });
        
        // 초기 정보 로드
        await this.loadInitialInfo();
        
        // 모니터링 루프
        while (this.isMonitoring) {
            await this.updateAndDisplay();
            await this.sleep(interval);
        }
    }

    async loadInitialInfo() {
        // 준비 보고서에서 초기 정보 로드
        if (await fs.pathExists(this.reportPath)) {
            const report = await fs.readJson(this.reportPath);
            console.log('📋 임베딩 준비 정보:');
            console.log(`   총 준비 파일: ${report.statistics.total_prepared.toLocaleString()}개`);
            console.log(`   Phase 1: ${report.statistics.phase1_files.toLocaleString()}개`);
            console.log(`   Phase 2: ${report.statistics.phase2_files.toLocaleString()}개`);
            console.log(`   배치 수: ${report.statistics.batches_created}개\n`);
        }
    }

    async updateAndDisplay() {
        try {
            if (!await fs.pathExists(this.progressPath)) {
                console.log('⏳ 임베딩이 아직 시작되지 않았습니다...');
                return;
            }
            
            const progress = await fs.readJson(this.progressPath);
            
            // 처음 로드시 시작 시간 설정
            if (!this.startTime && progress.startTime) {
                this.startTime = new Date(progress.startTime);
            }
            
            // 속도 계산
            const speed = this.calculateSpeed(progress);
            
            // 화면 지우기
            console.clear();
            
            // 헤더 표시
            this.displayHeader();
            
            // 진행상황 표시
            this.displayProgress(progress, speed);
            
            // 성능 통계 표시
            this.displayPerformanceStats(progress, speed);
            
            // 에러 정보 표시
            this.displayErrors(progress);
            
            // 현재 진행상황 저장
            this.lastProgress = progress;
            
        } catch (error) {
            console.error('❌ 모니터링 오류:', error.message);
        }
    }

    calculateSpeed(progress) {
        if (!this.lastProgress || !this.startTime) {
            return { current: 0, average: 0, estimated: 0 };
        }
        
        const now = new Date();
        const elapsed = (now - this.startTime) / 1000 / 60; // 분
        const processed = progress.processedFiles;
        const lastProcessed = this.lastProgress.processedFiles;
        
        // 현재 속도 (최근 측정 기간 기준)
        const currentSpeed = (processed - lastProcessed) / (10 / 60); // 10초 간격 기준
        
        // 평균 속도
        const averageSpeed = elapsed > 0 ? processed / elapsed : 0;
        
        // 속도 이력 관리
        if (currentSpeed > 0) {
            this.speedHistory.push(currentSpeed);
            if (this.speedHistory.length > this.maxSpeedHistory) {
                this.speedHistory.shift();
            }
        }
        
        // 예상 완료 시간 계산
        const remaining = progress.totalFiles - progress.processedFiles;
        const estimatedMinutes = averageSpeed > 0 ? remaining / averageSpeed : 0;
        const estimatedCompletion = new Date(now.getTime() + estimatedMinutes * 60 * 1000);
        
        return {
            current: Math.round(currentSpeed),
            average: Math.round(averageSpeed),
            peak: Math.round(Math.max(...this.speedHistory, 0)),
            estimated: estimatedCompletion,
            estimatedMinutes: Math.round(estimatedMinutes)
        };
    }

    displayHeader() {
        const now = new Date().toLocaleString('ko-KR');
        console.log('🚀 터보 크롤링 임베딩 실시간 모니터');
        console.log('='.repeat(80));
        console.log(`⏰ 현재 시간: ${now}`);
        console.log('='.repeat(80));
    }

    displayProgress(progress, speed) {
        const percentage = progress.totalFiles > 0 ? 
            (progress.processedFiles / progress.totalFiles * 100).toFixed(1) : 0;
        
        // 진행률 바 생성
        const barLength = 50;
        const filledLength = Math.round((progress.processedFiles / progress.totalFiles) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        console.log('📊 전체 진행상황:');
        console.log(`   🗂️  처리 파일: ${progress.processedFiles.toLocaleString()} / ${progress.totalFiles.toLocaleString()} (${percentage}%)`);
        console.log(`   📈 진행률: [${bar}] ${percentage}%`);
        console.log(`   📋 현재 단계: ${progress.currentPhase?.toUpperCase() || 'INITIALIZING'}`);
        console.log(`   📦 배치: ${progress.currentBatch} / ${progress.totalBatches}`);
        
        if (speed.estimated && speed.estimatedMinutes > 0) {
            console.log(`   ⏱️  예상 완료: ${speed.estimated.toLocaleString('ko-KR')} (${speed.estimatedMinutes}분 후)`);
        }
        
        console.log();
    }

    displayPerformanceStats(progress, speed) {
        const elapsed = this.startTime ? 
            Math.round((new Date() - this.startTime) / 1000 / 60) : 0;
        
        console.log('⚡ 성능 통계:');
        console.log(`   🏃 현재 속도: ${speed.current} 파일/분`);
        console.log(`   📈 평균 속도: ${speed.average} 파일/분`);
        console.log(`   🏆 최고 속도: ${speed.peak} 파일/분`);
        console.log(`   ⏰ 경과 시간: ${elapsed}분`);
        
        // Phase별 진행상황
        if (progress.currentPhase) {
            console.log(`   📋 ${progress.currentPhase.toUpperCase()} 진행: 배치 ${progress.currentBatch}`);
        }
        
        console.log();
    }

    displayErrors(progress) {
        if (progress.errors && progress.errors.length > 0) {
            console.log('⚠️  오류 정보:');
            console.log(`   총 오류: ${progress.errors.length}개`);
            
            // 최근 3개 오류만 표시
            const recentErrors = progress.errors.slice(-3);
            for (const error of recentErrors) {
                const time = new Date(error.timestamp).toLocaleTimeString('ko-KR');
                console.log(`   [${time}] ${error.phase}/${error.batch}: ${error.error}`);
            }
            console.log();
        }
    }

    async showSummary() {
        if (!await fs.pathExists(this.progressPath)) {
            console.log('❌ 진행상황 파일이 없습니다.');
            return;
        }
        
        const progress = await fs.readJson(this.progressPath);
        
        console.log('\n📋 임베딩 요약 정보:');
        console.log('='.repeat(60));
        
        if (progress.completed) {
            const startTime = new Date(progress.startTime);
            const endTime = new Date(progress.completedTime);
            const duration = Math.round((endTime - startTime) / 1000 / 60);
            
            console.log('✅ 상태: 완료');
            console.log(`📊 처리 파일: ${progress.processedFiles.toLocaleString()}개`);
            console.log(`⏰ 소요 시간: ${duration}분`);
            console.log(`📈 평균 속도: ${Math.round(progress.processedFiles / duration)}파일/분`);
            console.log(`❌ 오류 수: ${progress.errors?.length || 0}개`);
        } else {
            const percentage = progress.totalFiles > 0 ? 
                (progress.processedFiles / progress.totalFiles * 100).toFixed(1) : 0;
            
            console.log(`⏳ 상태: 진행 중 (${percentage}%)`);
            console.log(`📊 처리 파일: ${progress.processedFiles.toLocaleString()} / ${progress.totalFiles.toLocaleString()}`);
            console.log(`📋 현재 단계: ${progress.currentPhase?.toUpperCase() || 'INITIALIZING'}`);
            console.log(`📦 배치: ${progress.currentBatch} / ${progress.totalBatches}`);
            console.log(`❌ 오류 수: ${progress.errors?.length || 0}개`);
        }
        
        console.log('='.repeat(60));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI 명령어 처리
async function main() {
    const args = process.argv.slice(2);
    const monitor = new TurboEmbeddingMonitor();
    
    if (args.includes('--summary') || args.includes('-s')) {
        await monitor.showSummary();
    } else {
        const interval = args.includes('--fast') ? 5000 : 10000;
        await monitor.startMonitoring(interval);
    }
}

// 스크립트 직접 실행
if (require.main === module) {
    main().catch(console.error);
}

module.exports = TurboEmbeddingMonitor;