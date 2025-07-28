#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class UltraEmbeddingMonitor {
    constructor() {
        this.progressFile = '/Users/minhyuk/Desktop/우진봇/unlimited-integration-progress.json';
        this.startTime = new Date();
        this.previousData = null;
        this.speedHistory = [];
        this.maxHistory = 10;
        
        // 화면 설정
        this.terminalWidth = process.stdout.columns || 120;
        this.setupSignalHandlers();
    }

    setupSignalHandlers() {
        process.on('SIGINT', () => {
            console.log('\n\n👋 모니터링을 종료합니다...');
            process.exit(0);
        });
    }

    formatNumber(num) {
        if (typeof num !== 'number') return num;
        return num.toLocaleString('ko-KR');
    }

    formatDuration(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours}시간 ${minutes}분`;
        } else if (minutes > 0) {
            return `${minutes}분 ${seconds}초`;
        } else {
            return `${seconds}초`;
        }
    }

    createProgressBar(percentage, width = 50) {
        const filled = Math.floor((percentage / 100) * width);
        const empty = width - filled;
        
        let color = '';
        if (percentage < 25) color = '\x1b[91m'; // 빨강
        else if (percentage < 50) color = '\x1b[93m'; // 노랑
        else if (percentage < 75) color = '\x1b[94m'; // 파랑
        else color = '\x1b[92m'; // 초록
        
        const bar = color + '█'.repeat(filled) + '\x1b[90m' + '░'.repeat(empty) + '\x1b[0m';
        return `[${bar}] ${percentage.toFixed(1)}%`;
    }

    getSystemInfo() {
        try {
            const memInfo = execSync("ps aux | grep 'integrate-unlimited-crawling' | grep -v grep | awk '{print $6}'", { encoding: 'utf8' }).trim();
            const cpuInfo = execSync("ps aux | grep 'integrate-unlimited-crawling' | grep -v grep | awk '{print $3}'", { encoding: 'utf8' }).trim();
            const etimeInfo = execSync("ps -o etime= -p $(pgrep -f 'integrate-unlimited-crawling')", { encoding: 'utf8' }).trim();
            
            return {
                memory: memInfo ? `${(parseInt(memInfo) / 1024).toFixed(1)} MB` : 'N/A',
                cpu: cpuInfo ? `${cpuInfo}%` : 'N/A',
                uptime: etimeInfo || 'N/A'
            };
        } catch (error) {
            return { memory: 'N/A', cpu: 'N/A', uptime: 'N/A' };
        }
    }

    calculateSpeed(current, previous) {
        if (!previous) return null;
        
        const currentTime = new Date(current.timestamp);
        const previousTime = new Date(previous.timestamp);
        const timeDiff = (currentTime - previousTime) / 1000; // 초
        
        if (timeDiff <= 0) return null;
        
        const filesDiff = current.processed_files - previous.processed_files;
        const docsDiff = current.generated_documents - previous.generated_documents;
        
        const speed = {
            filesPerSecond: filesDiff / timeDiff,
            docsPerSecond: docsDiff / timeDiff,
            timeDiff: timeDiff
        };
        
        // 속도 히스토리 업데이트
        this.speedHistory.push(speed);
        if (this.speedHistory.length > this.maxHistory) {
            this.speedHistory.shift();
        }
        
        return speed;
    }

    getAverageSpeed() {
        if (this.speedHistory.length === 0) return null;
        
        const avgFiles = this.speedHistory.reduce((sum, s) => sum + s.filesPerSecond, 0) / this.speedHistory.length;
        const avgDocs = this.speedHistory.reduce((sum, s) => sum + s.docsPerSecond, 0) / this.speedHistory.length;
        
        return {
            filesPerSecond: avgFiles,
            docsPerSecond: avgDocs
        };
    }

    estimateCompletion(current, avgSpeed) {
        if (!avgSpeed || avgSpeed.filesPerSecond <= 0) return null;
        
        const remainingFiles = current.total_files - current.processed_files;
        const remainingSeconds = remainingFiles / avgSpeed.filesPerSecond;
        const completionTime = new Date(Date.now() + remainingSeconds * 1000);
        
        return {
            remainingTime: remainingSeconds * 1000,
            completionTime: completionTime
        };
    }

    displayCompactStatus() {
        console.clear();
        
        // 제목
        console.log('\x1b[1m\x1b[96m🚀 우진봇 임베딩 진행률 모니터링\x1b[0m');
        console.log('═'.repeat(this.terminalWidth));
        
        try {
            // 데이터 로드
            if (!fs.existsSync(this.progressFile)) {
                console.log('\x1b[91m❌ 진행상황 파일을 찾을 수 없습니다.\x1b[0m');
                return;
            }
            
            const current = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'));
            const system = this.getSystemInfo();
            const speed = this.calculateSpeed(current, this.previousData);
            const avgSpeed = this.getAverageSpeed();
            const estimate = avgSpeed ? this.estimateCompletion(current, avgSpeed) : null;
            
            // 진행률 계산
            const fileProgress = (current.processed_files / current.total_files) * 100;
            const batchProgress = (current.current_batch / current.total_batches) * 100;
            
            // === 핵심 정보 표시 ===
            console.log('\n\x1b[1m📊 진행 현황\x1b[0m');
            console.log(`📁 파일: ${this.createProgressBar(fileProgress, 60)}`);
            console.log(`   ${this.formatNumber(current.processed_files)} / ${this.formatNumber(current.total_files)} (${fileProgress.toFixed(1)}%)`);
            
            console.log(`📦 배치: ${this.createProgressBar(batchProgress, 60)}`);
            console.log(`   ${current.current_batch} / ${current.total_batches} (${batchProgress.toFixed(1)}%)`);
            
            console.log(`📝 문서: \x1b[1m\x1b[92m${this.formatNumber(current.generated_documents)}개\x1b[0m 생성됨`);
            
            // === 성능 정보 ===
            console.log('\n\x1b[1m⚡ 성능 정보\x1b[0m');
            
            if (avgSpeed && avgSpeed.filesPerSecond > 0) {
                console.log(`🚀 평균 속도: \x1b[93m${avgSpeed.filesPerSecond.toFixed(2)} 파일/초\x1b[0m | \x1b[93m${avgSpeed.docsPerSecond.toFixed(2)} 문서/초\x1b[0m`);
                
                if (speed && speed.filesPerSecond > 0) {
                    console.log(`📈 현재 속도: \x1b[96m${speed.filesPerSecond.toFixed(2)} 파일/초\x1b[0m | \x1b[96m${speed.docsPerSecond.toFixed(2)} 문서/초\x1b[0m`);
                }
                
                if (estimate) {
                    console.log(`⏰ 예상 완료: \x1b[95m${estimate.completionTime.toLocaleString('ko-KR')}\x1b[0m`);
                    console.log(`⏳ 남은 시간: \x1b[95m${this.formatDuration(estimate.remainingTime)}\x1b[0m`);
                }
            } else {
                console.log(`🔄 속도 계산 중... (측정 횟수: ${this.speedHistory.length}/${this.maxHistory})`);
            }
            
            // === 시스템 정보 ===
            console.log('\n\x1b[1m💻 시스템 상태\x1b[0m');
            console.log(`🧠 메모리: ${system.memory} | ⚙️ CPU: ${system.cpu} | ⏰ 실행시간: ${system.uptime}`);
            
            // === 예상 최종 결과 ===
            const estimatedFinalDocs = Math.round((current.generated_documents / current.processed_files) * current.total_files);
            console.log('\n\x1b[1m🎯 예상 최종 결과\x1b[0m');
            console.log(`📊 예상 총 문서: \x1b[1m\x1b[92m${this.formatNumber(estimatedFinalDocs)}개\x1b[0m`);
            console.log(`📈 예상 증가율: \x1b[1m\x1b[93m+${((estimatedFinalDocs - 10000) / 10000 * 100).toFixed(0)}%\x1b[0m (기준: 10,000개)`);
            
            // === 하단 정보 ===
            const lastUpdate = new Date(current.timestamp).toLocaleString('ko-KR');
            const monitorRunTime = this.formatDuration(Date.now() - this.startTime.getTime());
            
            console.log('\n' + '─'.repeat(this.terminalWidth));
            console.log(`\x1b[2m📅 마지막 업데이트: ${lastUpdate} | ⏱️ 모니터링 시간: ${monitorRunTime}\x1b[0m`);
            console.log(`\x1b[2m🔄 5초마다 자동 새로고침 | 💡 종료: Ctrl+C\x1b[0m`);
            
            // 이전 데이터 저장
            this.previousData = { ...current };
            
        } catch (error) {
            console.log(`\x1b[91m❌ 모니터링 오류: ${error.message}\x1b[0m`);
        }
    }

    async start() {
        console.log('\x1b[96m🚀 Ultra 임베딩 모니터링 시작...\x1b[0m\n');
        
        // 초기 표시
        this.displayCompactStatus();
        
        // 5초마다 업데이트
        this.interval = setInterval(() => {
            this.displayCompactStatus();
        }, 5000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        console.log('\n👋 모니터링이 종료되었습니다.');
    }
}

// 실행
async function main() {
    const monitor = new UltraEmbeddingMonitor();
    
    process.on('SIGINT', () => {
        monitor.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        monitor.stop();
        process.exit(0);
    });
    
    await monitor.start();
}

if (require.main === module) {
    main().catch(error => {
        console.error('\x1b[91m❌ 모니터링 오류:', error.message, '\x1b[0m');
        process.exit(1);
    });
}

module.exports = UltraEmbeddingMonitor;