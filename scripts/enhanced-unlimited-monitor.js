// unlimited_crawling_output 향상된 실시간 모니터링 스크립트
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

let previousStats = null;
let startTime = Date.now();

async function getEnhancedProgress() {
    try {
        // 1. 데이터베이스 현황
        const { count: totalCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });
            
        const { count: unlimitedCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .like('source_file', 'unlimited_page_%');

        // 2. 로그 파일에서 실제 진행상황 분석
        let currentBatch = 0;
        let processedSubBatches = 0;
        try {
            const logContent = await fs.readFile('/Users/minhyuk/Desktop/우진봇/unlimited-integration.log', 'utf-8');
            const logLines = logContent.split('\n');
            
            // 마지막 소배치 번호 찾기
            const batchMatches = logLines
                .filter(line => line.includes('✅ 소배치') && line.includes('완료'))
                .map(line => {
                    const match = line.match(/소배치 (\d+) 완료/);
                    return match ? parseInt(match[1]) : 0;
                });
            
            if (batchMatches.length > 0) {
                processedSubBatches = Math.max(...batchMatches);
                currentBatch = Math.floor(processedSubBatches / 221) + 1; // 배치당 약 221개 소배치
            }
        } catch (error) {
            // 로그 파일 읽기 실패시 기본값 사용
        }

        // 3. 진행상황 파일
        let progressData = null;
        try {
            const progressFile = await fs.readFile('/Users/minhyuk/Desktop/우진봇/unlimited-integration-progress.json', 'utf-8');
            progressData = JSON.parse(progressFile);
        } catch (error) {
            // 파일이 없거나 읽기 실패
        }

        // 4. 실제 처리된 파일 수 추정 (소배치 * 15 / 평균 청크수)
        const estimatedProcessedFiles = Math.floor(processedSubBatches * 15 / 6.6);
        const estimatedProgress = Math.min(estimatedProcessedFiles / 20231 * 100, 100);

        return {
            totalCount,
            unlimitedCount,
            processedSubBatches,
            currentBatch,
            estimatedProcessedFiles,
            estimatedProgress,
            progressData
        };
    } catch (error) {
        console.error('진행상황 분석 오류:', error.message);
        return null;
    }
}

async function displayEnhancedProgress() {
    try {
        console.clear();
        console.log('🚀 unlimited_crawling_output 향상된 실시간 모니터링');
        console.log('═'.repeat(70));
        console.log(`⏰ ${new Date().toLocaleString()} | 🔴 실시간 감시 중...\n`);
        
        const stats = await getEnhancedProgress();
        if (!stats) return;

        const {
            totalCount,
            unlimitedCount,
            processedSubBatches,
            currentBatch,
            estimatedProcessedFiles,
            estimatedProgress,
            progressData
        } = stats;

        // 변화량 계산
        let countIncrease = 0;
        if (previousStats) {
            countIncrease = totalCount - previousStats.totalCount;
        }
        previousStats = { totalCount, unlimitedCount };

        // 데이터베이스 현황
        console.log('📊 데이터베이스 현황:');
        console.log(`  💾 전체 문서: ${totalCount}개 ${countIncrease > 0 ? `(+${countIncrease} 신규)` : ''}`);
        console.log(`  🔄 unlimited: ${unlimitedCount}개`);
        console.log(`  📈 기존 대비: +${totalCount - 10746}개 (${((totalCount - 10746) / 10746 * 100).toFixed(1)}%)\n`);

        // 실제 처리 진행상황 (로그 기반)
        console.log('📋 실제 처리 진행상황 (로그 분석):');
        console.log(`  🔥 소배치 완료: ${processedSubBatches}개`);
        console.log(`  📁 추정 파일: ${estimatedProcessedFiles}/${20231} (${estimatedProgress.toFixed(1)}%)`);
        console.log(`  📦 현재 배치: ${currentBatch}/41`);
        console.log(`  📝 실제 생성: ${unlimitedCount}개\n`);

        // 향상된 진행률 바
        const barLength = 50;
        const filledLength = Math.round(barLength * estimatedProgress / 100);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        console.log(`🔄 실제 진행률: [${bar}] ${estimatedProgress.toFixed(1)}%\n`);

        // 처리 속도 분석
        const estimatedDocsGenerated = processedSubBatches * 15;
        const actualDocsGenerated = unlimitedCount;
        const generationEfficiency = actualDocsGenerated / estimatedDocsGenerated * 100;

        console.log('⚡ 처리 성능 분석:');
        console.log(`  📊 소배치당 문서: ${(actualDocsGenerated / processedSubBatches).toFixed(1)}개`);
        console.log(`  📈 생성 효율: ${generationEfficiency.toFixed(1)}%`);
        console.log(`  🎯 품질 통과율: ${(generationEfficiency / 15 * 100).toFixed(1)}%\n`);

        // 예상 완료 시간 (실제 진행률 기반)
        if (estimatedProgress > 0 && processedSubBatches > 0) {
            const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;
            const estimatedTotalMinutes = elapsedMinutes / (estimatedProgress / 100);
            const remainingMinutes = estimatedTotalMinutes - elapsedMinutes;
            
            console.log('⏳ 향상된 예상 완료:');
            console.log(`  ⌛ 남은 시간: ${Math.round(remainingMinutes)}분`);
            console.log(`  📅 완료 예정: ${new Date(Date.now() + remainingMinutes * 60 * 1000).toLocaleString()}\n`);
        }

        // 최종 예상 결과
        const currentRate = actualDocsGenerated / estimatedProcessedFiles;
        const estimatedFinalDocs = Math.round(20231 * currentRate);
        
        console.log('🎯 예상 최종 결과 (향상된 추정):');
        console.log(`  📊 예상 총 문서: ${10746 + estimatedFinalDocs}개`);
        console.log(`  📈 예상 증가율: +${((estimatedFinalDocs / 10746) * 100).toFixed(1)}%`);
        console.log(`  🚀 현재 달성: ${((actualDocsGenerated / estimatedFinalDocs) * 100).toFixed(1)}%\n`);

        // 기존 진행상황 파일 정보 (참고용)
        if (progressData) {
            console.log('📄 파일 기반 정보 (참고):');
            console.log(`  📁 파일: ${progressData.processed_files}/${progressData.total_files} (${(progressData.processed_files/progressData.total_files*100).toFixed(1)}%)`);
            console.log(`  📦 배치: ${progressData.current_batch}/${progressData.total_batches}`);
            console.log(`  ⏱️  업데이트: ${new Date(progressData.timestamp).toLocaleString()}\n`);
        }

        console.log('═'.repeat(70));
        console.log('💡 Ctrl+C로 종료 | 30초마다 자동 갱신');

    } catch (error) {
        console.error('❌ 모니터링 오류:', error.message);
    }
}

// 즉시 한 번 실행
displayEnhancedProgress();

// 30초마다 반복
const interval = setInterval(displayEnhancedProgress, 30000);

// Ctrl+C 처리
process.on('SIGINT', () => {
    console.log('\n\n👋 향상된 모니터링을 종료합니다.');
    clearInterval(interval);
    process.exit(0);
});