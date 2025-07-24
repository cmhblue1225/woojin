// 임베딩 상태 확인 스크립트
const fs = require('fs-extra');
const path = require('path');

class EmbeddingChecker {
    constructor() {
        this.statusFile = path.join(__dirname, '../embedding-status.json');
        this.logFile = path.join(__dirname, '../logs/embedding.log');
    }

    async checkStatus() {
        try {
            // 상태 파일 확인
            if (!await fs.pathExists(this.statusFile)) {
                console.log('❌ 임베딩 작업이 아직 시작되지 않았습니다.');
                console.log('💡 npm run embed 명령어로 임베딩을 시작하세요.');
                return false;
            }

            const statusData = await fs.readJson(this.statusFile);
            
            console.log('\n📊 임베딩 상태 정보:');
            console.log('─'.repeat(50));
            console.log(`📄 상태: ${this.getStatusEmoji(statusData.status)} ${statusData.status}`);
            console.log(`📈 진행률: ${statusData.progress}% (${statusData.processed}/${statusData.total})`);
            console.log(`💬 메시지: ${statusData.message}`);
            console.log(`⏰ 마지막 업데이트: ${new Date(statusData.timestamp).toLocaleString('ko-KR')}`);
            
            // 진행률 바 표시
            if (statusData.total > 0) {
                const barLength = 30;
                const filledLength = Math.round((statusData.processed / statusData.total) * barLength);
                const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
                console.log(`🔄 [${bar}] ${statusData.progress}%`);
            }

            console.log('─'.repeat(50));

            // 완료 여부 확인
            if (statusData.status === 'completed') {
                console.log('🎉 임베딩 작업이 완료되었습니다!');
                console.log('💡 이제 npm run dev 명령어로 챗봇 서버를 시작할 수 있습니다.');
                return true;
            } else if (statusData.status === 'failed' || statusData.status === 'error') {
                console.log('💥 임베딩 작업이 실패했습니다.');
                console.log('📋 로그를 확인하여 문제를 해결하세요.');
                await this.showRecentLogs();
                return false;
            } else if (statusData.status === 'running') {
                console.log('⏳ 임베딩 작업이 진행 중입니다...');
                
                // 예상 완료 시간 계산
                if (statusData.processed > 0) {
                    const startTime = new Date(statusData.timestamp);
                    const currentTime = new Date();
                    const elapsed = currentTime - startTime;
                    const avgTimePerDoc = elapsed / statusData.processed;
                    const remaining = statusData.total - statusData.processed;
                    const estimatedCompletion = new Date(currentTime.getTime() + (avgTimePerDoc * remaining));
                    
                    console.log(`⏱️  예상 완료 시간: ${estimatedCompletion.toLocaleString('ko-KR')}`);
                }
                
                return false;
            } else {
                console.log('⏸️  임베딩 작업이 대기 중입니다.');
                return false;
            }

        } catch (error) {
            console.error('❌ 상태 확인 중 오류 발생:', error.message);
            return false;
        }
    }

    getStatusEmoji(status) {
        const emojis = {
            'pending': '⏸️',
            'initializing': '🔄',
            'running': '⏳',
            'completed': '✅',
            'failed': '❌',
            'error': '💥'
        };
        return emojis[status] || '❓';
    }

    async showRecentLogs(lines = 10) {
        try {
            if (!await fs.pathExists(this.logFile)) {
                console.log('📋 로그 파일이 없습니다.');
                return;
            }

            const logContent = await fs.readFile(this.logFile, 'utf8');
            const logLines = logContent.trim().split('\n').slice(-lines);

            console.log(`\n📋 최근 로그 (마지막 ${lines}줄):`);
            console.log('─'.repeat(50));
            logLines.forEach(line => console.log(line));
            console.log('─'.repeat(50));

        } catch (error) {
            console.error('❌ 로그 읽기 실패:', error.message);
        }
    }

    async showFullLogs() {
        try {
            if (!await fs.pathExists(this.logFile)) {
                console.log('📋 로그 파일이 없습니다.');
                return;
            }

            const logContent = await fs.readFile(this.logFile, 'utf8');
            console.log('\n📋 전체 로그:');
            console.log('='.repeat(50));
            console.log(logContent);
            console.log('='.repeat(50));

        } catch (error) {
            console.error('❌ 로그 읽기 실패:', error.message);
        }
    }

    async watchStatus(interval = 5000) {
        console.log('👀 임베딩 상태를 실시간으로 모니터링합니다...');
        console.log('💡 Ctrl+C로 모니터링을 중단할 수 있습니다.\n');

        const monitor = async () => {
            // 화면 지우기
            console.clear();
            console.log('🔍 실시간 임베딩 상태 모니터링\n');

            const isCompleted = await this.checkStatus();
            
            if (isCompleted) {
                process.exit(0);
            }
        };

        // 즉시 한 번 실행
        await monitor();

        // 주기적 업데이트
        const intervalId = setInterval(monitor, interval);

        // Ctrl+C 처리
        process.on('SIGINT', () => {
            clearInterval(intervalId);
            console.log('\n👋 모니터링을 중단했습니다.');
            process.exit(0);
        });
    }
}

// CLI 명령어 처리
async function main() {
    const checker = new EmbeddingChecker();
    const args = process.argv.slice(2);

    if (args.includes('--watch') || args.includes('-w')) {
        await checker.watchStatus();
    } else if (args.includes('--logs') || args.includes('-l')) {
        await checker.showFullLogs();
    } else {
        await checker.checkStatus();
    }
}

// 스크립트 직접 실행
if (require.main === module) {
    main().catch(console.error);
}

module.exports = EmbeddingChecker;