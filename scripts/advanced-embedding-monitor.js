#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AdvancedEmbeddingMonitor {
    constructor() {
        this.progressFile = '/Users/minhyuk/Desktop/우진봇/unlimited-integration-progress.json';
        this.logFile = '/Users/minhyuk/Desktop/우진봇/logs/unlimited-integration.log';
        this.startTime = new Date();
        this.previousStats = null;
        this.performanceHistory = [];
        this.maxHistoryLength = 20;
        
        // 화면 크기 설정
        this.terminalWidth = process.stdout.columns || 120;
        this.clearScreen();
        this.setupSignalHandlers();
    }

    setupSignalHandlers() {
        process.on('SIGINT', () => {
            console.log('\n\n👋 모니터링을 종료합니다...');
            process.exit(0);
        });
    }

    clearScreen() {
        console.clear();
        process.stdout.write('\x1b[?25l'); // 커서 숨기기
    }

    showCursor() {
        process.stdout.write('\x1b[?25h'); // 커서 보이기
    }

    createProgressBar(percentage, width = 50, style = 'modern') {
        const filled = Math.floor((percentage / 100) * width);
        const empty = width - filled;
        
        let bar = '';
        let fillChar = '█';
        let emptyChar = '░';
        
        if (style === 'modern') {
            fillChar = '█';
            emptyChar = '░';
        } else if (style === 'classic') {
            fillChar = '=';
            emptyChar = '-';
        }
        
        // 그라데이션 효과
        if (percentage < 25) {
            bar = `\x1b[91m${fillChar.repeat(filled)}\x1b[37m${emptyChar.repeat(empty)}\x1b[0m`;
        } else if (percentage < 50) {
            bar = `\x1b[93m${fillChar.repeat(filled)}\x1b[37m${emptyChar.repeat(empty)}\x1b[0m`;
        } else if (percentage < 75) {
            bar = `\x1b[94m${fillChar.repeat(filled)}\x1b[37m${emptyChar.repeat(empty)}\x1b[0m`;
        } else {
            bar = `\x1b[92m${fillChar.repeat(filled)}\x1b[37m${emptyChar.repeat(empty)}\x1b[0m`;
        }
        
        return `[${bar}] ${percentage.toFixed(1)}%`;
    }

    formatNumber(num) {
        return num.toLocaleString('ko-KR');
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}시간 ${minutes % 60}분 ${seconds % 60}초`;
        } else if (minutes > 0) {
            return `${minutes}분 ${seconds % 60}초`;
        } else {
            return `${seconds}초`;
        }
    }

    getSystemInfo() {
        try {
            // 메모리 사용량
            const memInfo = execSync("ps aux | grep 'integrate-unlimited-crawling' | grep -v grep | awk '{print $6}'", { encoding: 'utf8' }).trim();
            const memoryUsage = memInfo ? parseInt(memInfo) * 1024 : 0; // KB to bytes
            
            // CPU 사용량
            const cpuInfo = execSync("ps aux | grep 'integrate-unlimited-crawling' | grep -v grep | awk '{print $3}'", { encoding: 'utf8' }).trim();
            const cpuUsage = cpuInfo ? parseFloat(cpuInfo) : 0;
            
            // 프로세스 실행 시간
            const etimeInfo = execSync("ps -o etime= -p $(pgrep -f 'integrate-unlimited-crawling')", { encoding: 'utf8' }).trim();
            
            return {
                memoryUsage,
                cpuUsage,
                processUptime: etimeInfo || 'N/A'
            };
        } catch (error) {
            return {
                memoryUsage: 0,
                cpuUsage: 0,
                processUptime: 'N/A'
            };
        }
    }

    async checkDatabaseStatus() {
        try {
            // 환경변수 로드
            require('dotenv').config();
            
            const { createClient } = require('@supabase/supabase-js');
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_ANON_KEY;
            
            if (!supabaseUrl || !supabaseKey) {
                // 환경변수가 없는 경우 로컬 방식으로 추정
                return this.estimateDatabaseFromProgress();
            }
            
            const supabase = createClient(supabaseUrl, supabaseKey);
            
            // 전체 문서 수
            const { count: totalCount, error: totalError } = await supabase
                .from('documents')
                .select('*', { count: 'exact', head: true });
            
            if (totalError) {
                console.log('DB 조회 오류:', totalError.message);
                return this.estimateDatabaseFromProgress();
            }
            
            // unlimited 문서 수
            const { count: unlimitedCount, error: unlimitedError } = await supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .like('source', '%unlimited_crawling_output%');
            
            if (unlimitedError) {
                console.log('Unlimited DB 조회 오류:', unlimitedError.message);
            }
            
            return {
                total: totalCount || 0,
                unlimited: unlimitedCount || 0,
                source: 'database'
            };
            
        } catch (error) {
            // 에러 시 추정값 반환
            return this.estimateDatabaseFromProgress();
        }
    }

    estimateDatabaseFromProgress() {
        try {
            const progressData = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'));
            
            // 기존 문서 수 추정 (시작 시 약 10,000개였다고 가정)
            const baseDocuments = 10000;
            const estimatedTotal = baseDocuments + progressData.generated_documents;
            
            return {
                total: estimatedTotal,
                unlimited: progressData.generated_documents,
                source: 'estimated'
            };
        } catch (error) {
            return {
                total: 'Error',
                unlimited: 'Error',
                source: 'error'
            };
        }
    }

    calculateSpeed(current, previous) {
        if (!previous) return 0;
        
        const timeDiff = (new Date(current.timestamp) - new Date(previous.timestamp)) / 1000; // seconds
        const filesDiff = current.processed_files - previous.processed_files;
        const docsDiff = current.generated_documents - previous.generated_documents;
        
        return {
            filesPerSecond: timeDiff > 0 ? filesDiff / timeDiff : 0,
            docsPerSecond: timeDiff > 0 ? docsDiff / timeDiff : 0,
            timeDiff: timeDiff
        };
    }

    estimateCompletion(current, speed) {
        const remainingFiles = current.total_files - current.processed_files;
        if (speed.filesPerSecond <= 0) return null;
        
        const remainingSeconds = remainingFiles / speed.filesPerSecond;
        const completionTime = new Date(Date.now() + remainingSeconds * 1000);
        
        return {
            remainingTime: remainingSeconds * 1000,
            completionTime: completionTime
        };
    }

    createTitle() {
        const title = "🚀 대진대학교 우진봇 임베딩 모니터링 시스템";
        const subtitle = "Advanced Real-time Embedding Progress Monitor";
        const line = "═".repeat(this.terminalWidth);
        
        console.log(`\x1b[1m\x1b[96m${title}\x1b[0m`);
        console.log(`\x1b[2m${subtitle}\x1b[0m`);
        console.log(`\x1b[90m${line}\x1b[0m`);
    }

    async displayStatus() {
        this.clearScreen();
        this.createTitle();
        
        try {
            // 진행상황 데이터 로드
            if (!fs.existsSync(this.progressFile)) {
                console.log('\x1b[91m❌ 진행상황 파일을 찾을 수 없습니다.\x1b[0m');
                return;
            }
            
            const progressData = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'));
            const systemInfo = this.getSystemInfo();
            const dbStatus = await this.checkDatabaseStatus();
            
            // 속도 계산
            const speed = this.calculateSpeed(progressData, this.previousStats);
            const estimate = this.estimateCompletion(progressData, speed);
            
            // 성능 히스토리 업데이트
            if (speed.filesPerSecond > 0) {
                this.performanceHistory.push({
                    timestamp: Date.now(),
                    filesPerSecond: speed.filesPerSecond,
                    docsPerSecond: speed.docsPerSecond
                });
                
                if (this.performanceHistory.length > this.maxHistoryLength) {
                    this.performanceHistory.shift();
                }
            }
            
            const fileProgress = (progressData.processed_files / progressData.total_files) * 100;
            const batchProgress = (progressData.current_batch / progressData.total_batches) * 100;
            
            // === 메인 진행상황 표시 ===
            console.log('\n\x1b[1m📊 진행 상황\x1b[0m');
            console.log('┌' + '─'.repeat(this.terminalWidth - 2) + '┐');
            console.log(`│ 📁 파일 처리: ${this.createProgressBar(fileProgress, 40)} │`);
            console.log(`│    ${this.formatNumber(progressData.processed_files)} / ${this.formatNumber(progressData.total_files)} 파일 처리됨`);
            console.log('│' + ' '.repeat(this.terminalWidth - 2) + '│');
            console.log(`│ 📦 배치 진행: ${this.createProgressBar(batchProgress, 40)} │`);
            console.log(`│    배치 ${progressData.current_batch} / ${progressData.total_batches} 완료`);
            console.log('│' + ' '.repeat(this.terminalWidth - 2) + '│');
            console.log(`│ 📝 생성된 문서: \x1b[1m\x1b[92m${this.formatNumber(progressData.generated_documents)}개\x1b[0m │`);
            console.log('└' + '─'.repeat(this.terminalWidth - 2) + '┘');
            
            // === 실시간 성능 정보 ===
            console.log('\n\x1b[1m⚡ 실시간 성능\x1b[0m');
            console.log('┌' + '─'.repeat(this.terminalWidth - 2) + '┐');
            if (speed.filesPerSecond > 0) {
                console.log(`│ 🚀 처리 속도: \x1b[93m${speed.filesPerSecond.toFixed(2)} 파일/초\x1b[0m │`);
                console.log(`│ 📝 문서 생성: \x1b[93m${speed.docsPerSecond.toFixed(2)} 문서/초\x1b[0m │`);
                
                if (estimate) {
                    console.log(`│ ⏱️  예상 완료: \x1b[96m${estimate.completionTime.toLocaleString('ko-KR')}\x1b[0m │`);
                    console.log(`│ ⏳ 남은 시간: \x1b[96m${this.formatDuration(estimate.remainingTime)}\x1b[0m │`);
                }
            } else {
                console.log('│ 🔄 속도 계산 중... (다음 업데이트를 기다리는 중) │');
            }
            console.log('└' + '─'.repeat(this.terminalWidth - 2) + '┘');
            
            // === 시스템 리소스 ===
            console.log('\n\x1b[1m💻 시스템 리소스\x1b[0m');
            console.log('┌' + '─'.repeat(this.terminalWidth - 2) + '┐');
            console.log(`│ 🧠 메모리 사용: \x1b[94m${this.formatBytes(systemInfo.memoryUsage)}\x1b[0m │`);
            console.log(`│ ⚙️  CPU 사용률: \x1b[94m${systemInfo.cpuUsage.toFixed(1)}%\x1b[0m │`);
            console.log(`│ ⏰ 프로세스 실행: \x1b[94m${systemInfo.processUptime}\x1b[0m │`);
            console.log('└' + '─'.repeat(this.terminalWidth - 2) + '┘');
            
            // === 데이터베이스 상태 ===
            console.log('\n\x1b[1m🗄️  데이터베이스 상태\x1b[0m');
            console.log('┌' + '─'.repeat(this.terminalWidth - 2) + '┐');
            
            let statusSuffix = '';
            if (dbStatus.source === 'estimated') {
                statusSuffix = ' \x1b[2m(추정)\x1b[0m';
            } else if (dbStatus.source === 'database') {
                statusSuffix = ' \x1b[2m(실시간)\x1b[0m';
            }
            
            console.log(`│ 📚 전체 문서: \x1b[92m${this.formatNumber(dbStatus.total)}개\x1b[0m${statusSuffix} │`);
            console.log(`│ 🆕 unlimited 문서: \x1b[92m${this.formatNumber(dbStatus.unlimited)}개\x1b[0m${statusSuffix} │`);
            
            if (typeof dbStatus.total === 'number' && typeof dbStatus.unlimited === 'number') {
                const otherDocs = dbStatus.total - dbStatus.unlimited;
                console.log(`│ 📋 기타 문서: \x1b[92m${this.formatNumber(otherDocs)}개\x1b[0m${statusSuffix} │`);
                
                // 증가율 계산
                if (dbStatus.source === 'estimated') {
                    const increaseRate = ((dbStatus.unlimited / 10000) * 100).toFixed(1);
                    console.log(`│ 📈 증가율: \x1b[93m+${increaseRate}%\x1b[0m (기준: 10,000개) │`);
                }
            }
            console.log('└' + '─'.repeat(this.terminalWidth - 2) + '┘');
            
            // === 성능 트렌드 ===
            if (this.performanceHistory.length > 3) {
                console.log('\n\x1b[1m📈 성능 트렌드 (최근 20회)\x1b[0m');
                console.log('┌' + '─'.repeat(this.terminalWidth - 2) + '┐');
                
                const avgFilesPerSec = this.performanceHistory.reduce((sum, item) => sum + item.filesPerSecond, 0) / this.performanceHistory.length;
                const avgDocsPerSec = this.performanceHistory.reduce((sum, item) => sum + item.docsPerSecond, 0) / this.performanceHistory.length;
                
                console.log(`│ 📊 평균 파일 처리: \x1b[95m${avgFilesPerSec.toFixed(2)} 파일/초\x1b[0m │`);
                console.log(`│ 📊 평균 문서 생성: \x1b[95m${avgDocsPerSec.toFixed(2)} 문서/초\x1b[0m │`);
                
                // 미니 차트
                const chartWidth = 60;
                const maxSpeed = Math.max(...this.performanceHistory.map(h => h.filesPerSecond));
                let chart = '│ 📉 ';
                
                for (let i = 0; i < Math.min(chartWidth, this.performanceHistory.length); i++) {
                    const historyIndex = Math.max(0, this.performanceHistory.length - chartWidth + i);
                    const speed = this.performanceHistory[historyIndex]?.filesPerSecond || 0;
                    const height = Math.floor((speed / maxSpeed) * 8);
                    
                    const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
                    chart += blocks[Math.max(0, Math.min(7, height))] || '▁';
                }
                
                console.log(chart + ' │');
                console.log('└' + '─'.repeat(this.terminalWidth - 2) + '┘');
            }
            
            // === 하단 정보 ===
            const lastUpdate = new Date(progressData.timestamp).toLocaleString('ko-KR');
            const monitorRunTime = this.formatDuration(Date.now() - this.startTime.getTime());
            
            console.log(`\n\x1b[2m📅 마지막 업데이트: ${lastUpdate}\x1b[0m`);
            console.log(`\x1b[2m⏱️  모니터링 실행 시간: ${monitorRunTime}\x1b[0m`);
            console.log(`\x1b[2m🔄 다음 업데이트: 5초 후\x1b[0m`);
            console.log(`\x1b[2m💡 종료하려면 Ctrl+C를 누르세요\x1b[0m`);
            
            // 이전 상태 저장
            this.previousStats = { ...progressData };
            
        } catch (error) {
            console.log(`\x1b[91m❌ 오류 발생: ${error.message}\x1b[0m`);
        }
    }

    async start() {
        console.log('\x1b[96m🚀 고급 임베딩 모니터링 시작...\x1b[0m\n');
        
        // 초기 표시
        await this.displayStatus();
        
        // 5초마다 업데이트
        this.interval = setInterval(async () => {
            await this.displayStatus();
        }, 5000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.showCursor();
        console.log('\n👋 모니터링이 종료되었습니다.');
    }
}

// 실행
async function main() {
    const monitor = new AdvancedEmbeddingMonitor();
    
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

module.exports = AdvancedEmbeddingMonitor;