#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class EmbeddingController {
    constructor() {
        this.progressFile = '/Users/minhyuk/Desktop/우진봇/unlimited-integration-progress.json';
        this.pidFile = '/Users/minhyuk/Desktop/우진봇/embedding-process.pid';
        this.logFile = '/Users/minhyuk/Desktop/우진봇/logs/embedding-controller.log';
    }

    log(message) {
        const timestamp = new Date().toLocaleString('ko-KR');
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        
        // 로그 파일에도 기록
        try {
            const logDir = path.dirname(this.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            fs.appendFileSync(this.logFile, logMessage + '\n');
        } catch (error) {
            // 로그 파일 쓰기 실패는 무시
        }
    }

    getCurrentProcessInfo() {
        try {
            const result = execSync("ps aux | grep 'integrate-unlimited-crawling' | grep -v grep", { encoding: 'utf8' });
            if (!result.trim()) {
                return null;
            }

            const lines = result.trim().split('\n');
            const processes = lines.map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    pid: parts[1],
                    cpu: parts[2],
                    memory: parts[3],
                    startTime: parts[8],
                    command: parts.slice(10).join(' ')
                };
            });

            return processes[0]; // 첫 번째 프로세스 반환
        } catch (error) {
            return null;
        }
    }

    getProgressStatus() {
        try {
            if (!fs.existsSync(this.progressFile)) {
                return null;
            }
            const data = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'));
            return data;
        } catch (error) {
            return null;
        }
    }

    savePid(pid) {
        try {
            fs.writeFileSync(this.pidFile, pid.toString());
            this.log(`PID ${pid} 저장됨`);
        } catch (error) {
            this.log(`PID 저장 실패: ${error.message}`);
        }
    }

    getSavedPid() {
        try {
            if (!fs.existsSync(this.pidFile)) {
                return null;
            }
            const pid = fs.readFileSync(this.pidFile, 'utf8').trim();
            return pid;
        } catch (error) {
            return null;
        }
    }

    removePidFile() {
        try {
            if (fs.existsSync(this.pidFile)) {
                fs.unlinkSync(this.pidFile);
                this.log('PID 파일 제거됨');
            }
        } catch (error) {
            this.log(`PID 파일 제거 실패: ${error.message}`);
        }
    }

    displayStatus() {
        console.log('\n🚀 임베딩 프로세스 상태 확인');
        console.log('=' * 50);

        const processInfo = this.getCurrentProcessInfo();
        const progressData = this.getProgressStatus();

        if (processInfo) {
            console.log('\n✅ 임베딩 프로세스 실행 중');
            console.log(`📍 PID: ${processInfo.pid}`);
            console.log(`⚙️  CPU: ${processInfo.cpu}%`);
            console.log(`🧠 메모리: ${processInfo.memory}%`);
            console.log(`⏰ 시작시간: ${processInfo.startTime}`);
            
            if (progressData) {
                const progress = (progressData.processed_files / progressData.total_files * 100).toFixed(1);
                console.log(`📊 진행률: ${progress}% (${progressData.processed_files}/${progressData.total_files})`);
                console.log(`📝 생성 문서: ${progressData.generated_documents.toLocaleString()}개`);
                console.log(`📦 배치: ${progressData.current_batch}/${progressData.total_batches}`);
            }
        } else {
            console.log('\n❌ 임베딩 프로세스가 실행되지 않음');
            
            if (progressData) {
                const progress = (progressData.processed_files / progressData.total_files * 100).toFixed(1);
                console.log(`📊 마지막 진행률: ${progress}% (${progressData.processed_files}/${progressData.total_files})`);
                console.log(`📝 마지막 생성 문서: ${progressData.generated_documents.toLocaleString()}개`);
            }
        }
    }

    pauseEmbedding() {
        console.log('\n⏸️  임베딩 프로세스 일시중지 시도...');
        
        const processInfo = this.getCurrentProcessInfo();
        if (!processInfo) {
            console.log('❌ 실행 중인 임베딩 프로세스를 찾을 수 없습니다.');
            return false;
        }

        try {
            // SIGTERM 신호로 우아한 종료 시도
            console.log(`📍 PID ${processInfo.pid}에 종료 신호 전송 중...`);
            execSync(`kill -TERM ${processInfo.pid}`);
            
            // PID 저장
            this.savePid(processInfo.pid);
            
            // 3초 대기 후 프로세스 확인
            setTimeout(() => {
                const checkProcess = this.getCurrentProcessInfo();
                if (checkProcess) {
                    console.log('⚠️  프로세스가 아직 실행 중입니다. 강제 종료를 시도합니다...');
                    try {
                        execSync(`kill -9 ${processInfo.pid}`);
                        this.log(`프로세스 ${processInfo.pid} 강제 종료됨`);
                    } catch (error) {
                        console.log(`❌ 강제 종료 실패: ${error.message}`);
                    }
                } else {
                    this.log(`프로세스 ${processInfo.pid} 정상 종료됨`);
                }
            }, 3000);

            console.log('✅ 임베딩 프로세스 중지 명령 전송됨');
            console.log('📋 진행상황은 자동으로 저장되었습니다.');
            console.log('🔄 재개하려면: npm run resume-embedding');
            
            return true;
        } catch (error) {
            console.log(`❌ 프로세스 중지 실패: ${error.message}`);
            return false;
        }
    }

    resumeEmbedding() {
        console.log('\n▶️  임베딩 프로세스 재개 시도...');
        
        // 현재 실행 중인 프로세스 확인
        const processInfo = this.getCurrentProcessInfo();
        if (processInfo) {
            console.log('⚠️  임베딩 프로세스가 이미 실행 중입니다!');
            console.log(`📍 PID: ${processInfo.pid}`);
            return false;
        }

        // 진행상황 파일 확인
        const progressData = this.getProgressStatus();
        if (!progressData) {
            console.log('❌ 진행상황 파일을 찾을 수 없습니다.');
            console.log('💡 처음부터 시작하려면: npm run integrate-unlimited');
            return false;
        }

        // 완료 여부 확인
        if (progressData.processed_files >= progressData.total_files) {
            console.log('✅ 임베딩이 이미 완료되었습니다!');
            console.log(`📊 최종 결과: ${progressData.generated_documents.toLocaleString()}개 문서 생성`);
            return false;
        }

        try {
            console.log('📋 이전 진행상황 확인됨:');
            const progress = (progressData.processed_files / progressData.total_files * 100).toFixed(1);
            console.log(`   📊 진행률: ${progress}%`);
            console.log(`   📁 처리된 파일: ${progressData.processed_files.toLocaleString()}개`);
            console.log(`   📝 생성된 문서: ${progressData.generated_documents.toLocaleString()}개`);
            console.log(`   📦 현재 배치: ${progressData.current_batch}/${progressData.total_batches}`);
            
            console.log('\n🚀 임베딩 프로세스 재시작 중...');
            
            // 백그라운드에서 임베딩 재시작
            const { spawn } = require('child_process');
            const child = spawn('node', ['scripts/integrate-unlimited-crawling.js'], {
                detached: true,
                stdio: 'ignore',
                cwd: '/Users/minhyuk/Desktop/우진봇'
            });
            
            child.unref();
            
            // PID 저장
            this.savePid(child.pid);
            this.log(`임베딩 프로세스 재시작됨 - PID: ${child.pid}`);
            
            console.log('✅ 임베딩 프로세스가 백그라운드에서 재시작되었습니다!');
            console.log(`📍 새 PID: ${child.pid}`);
            console.log('📈 진행상황 확인: npm run ultra-monitor');
            
            // 3초 후 프로세스 확인
            setTimeout(() => {
                const newProcess = this.getCurrentProcessInfo();
                if (newProcess) {
                    console.log(`🎉 프로세스 정상 실행 확인됨 (PID: ${newProcess.pid})`);
                } else {
                    console.log('⚠️  프로세스 시작을 확인할 수 없습니다. 수동으로 확인해주세요.');
                }
            }, 3000);
            
            return true;
        } catch (error) {
            console.log(`❌ 프로세스 재시작 실패: ${error.message}`);
            console.log('💡 수동 재시작: npm run integrate-unlimited');
            return false;
        }
    }

    forceStop() {
        console.log('\n🛑 임베딩 프로세스 강제 중지...');
        
        const processInfo = this.getCurrentProcessInfo();
        if (!processInfo) {
            console.log('❌ 실행 중인 임베딩 프로세스를 찾을 수 없습니다.');
            return false;
        }

        try {
            execSync(`kill -9 ${processInfo.pid}`);
            this.removePidFile();
            console.log(`✅ 프로세스 ${processInfo.pid} 강제 종료됨`);
            this.log(`프로세스 ${processInfo.pid} 강제 종료됨`);
            return true;
        } catch (error) {
            console.log(`❌ 강제 종료 실패: ${error.message}`);
            return false;
        }
    }

    showHelp() {
        console.log('\n🎮 임베딩 프로세스 컨트롤러');
        console.log('=' * 40);
        console.log('📋 사용 방법:');
        console.log('  npm run embedding-status    # 현재 상태 확인');
        console.log('  npm run pause-embedding     # 일시중지');
        console.log('  npm run resume-embedding    # 재개');
        console.log('  npm run stop-embedding      # 강제 중지');
        console.log('');
        console.log('📈 모니터링:');
        console.log('  npm run ultra-monitor       # 실시간 모니터링');
        console.log('  npm run advanced-monitor    # 상세 모니터링');
        console.log('');
        console.log('🚀 처음 시작:');
        console.log('  npm run integrate-unlimited # 새로 시작');
    }
}

// CLI 처리
function main() {
    const controller = new EmbeddingController();
    const command = process.argv[2];

    switch (command) {
        case 'status':
            controller.displayStatus();
            break;
        case 'pause':
            controller.pauseEmbedding();
            break;
        case 'resume':
            controller.resumeEmbedding();
            break;
        case 'stop':
            controller.forceStop();
            break;
        case 'help':
        default:
            controller.showHelp();
            break;
    }
}

if (require.main === module) {
    main();
}

module.exports = EmbeddingController;