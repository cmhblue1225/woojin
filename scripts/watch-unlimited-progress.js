// unlimited_crawling_output 통합 진행률 실시간 감시 스크립트 (30초마다 갱신)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

let previousUnlimitedCount = 0;
let startTime = Date.now();

async function displayProgress() {
    try {
        console.clear();
        console.log('🔄 unlimited_crawling_output 실시간 진행률 모니터링');
        console.log('═'.repeat(70));
        console.log(`⏰ ${new Date().toLocaleString()} | 🔴 실시간 감시 중...\n`);
        
        // 1. 진행상황 파일 확인
        let progressData = null;
        try {
            const progressFile = await fs.readFile('/Users/minhyuk/Desktop/우진봇/unlimited-integration-progress.json', 'utf-8');
            progressData = JSON.parse(progressFile);
        } catch (error) {
            // 파일이 없을 수 있음
        }
        
        // 2. 데이터베이스 현황
        const { count: totalCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });
            
        const { count: unlimitedCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .like('source_file', 'unlimited_page_%');
        
        // 변화량 계산
        const unlimitedIncrease = unlimitedCount - previousUnlimitedCount;
        previousUnlimitedCount = unlimitedCount;
        
        console.log('📊 데이터베이스 현황:');
        console.log(`  💾 전체 문서: ${totalCount}개 ${unlimitedIncrease > 0 ? `(+${unlimitedIncrease} 신규)` : ''}`);
        console.log(`  🔄 unlimited: ${unlimitedCount}개`);
        console.log(`  📈 기존 대비: +${totalCount - 10746}개 (${((totalCount - 10746) / 10746 * 100).toFixed(1)}%)\n`);
        
        // 3. 진행상황 상세
        if (progressData) {
            const { 
                processed_files, 
                total_files, 
                generated_documents, 
                current_batch, 
                total_batches,
                timestamp 
            } = progressData;
            
            const progressPercent = (processed_files / total_files * 100);
            const batchProgress = (current_batch / total_batches * 100);
            
            console.log('📋 처리 진행상황:');
            console.log(`  📁 파일: ${processed_files}/${total_files} (${progressPercent.toFixed(1)}%)`);
            console.log(`  📦 배치: ${current_batch}/${total_batches} (${batchProgress.toFixed(1)}%)`);
            console.log(`  📝 생성: ${generated_documents}개`);
            
            // 진행률 바
            const barLength = 40;
            const filledLength = Math.round(barLength * progressPercent / 100);
            const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
            console.log(`\n🔄 [${bar}] ${progressPercent.toFixed(1)}%\n`);
            
            // 속도 계산
            const timeSinceUpdate = (Date.now() - new Date(timestamp).getTime()) / 1000;
            console.log(`⚡ 처리 속도: ${timeSinceUpdate < 60 ? '활발' : '대기 중'}`);
            console.log(`📅 마지막 업데이트: ${Math.round(timeSinceUpdate)}초 전\n`);
            
            // 예상 완료
            if (processed_files > 0 && progressPercent > 0) {
                const elapsedHours = (Date.now() - startTime) / 1000 / 3600;
                const estimatedTotalHours = elapsedHours / (progressPercent / 100);
                const remainingHours = estimatedTotalHours - elapsedHours;
                
                console.log('⏳ 예상 완료:');
                console.log(`  ⌛ 남은 시간: ${Math.round(remainingHours * 60)}분`);
                console.log(`  📅 완료 예정: ${new Date(Date.now() + remainingHours * 3600 * 1000).toLocaleString()}\n`);
            }
            
            // 성능 통계
            const avgDocsPerFile = generated_documents / processed_files;
            const estimatedFinalDocs = Math.round(total_files * avgDocsPerFile);
            
            console.log('📊 성능 통계:');
            console.log(`  📄 평균 청크/파일: ${avgDocsPerFile.toFixed(1)}개`);
            console.log(`  🎯 예상 최종 문서: ${10746 + estimatedFinalDocs}개`);
            console.log(`  📈 예상 증가율: +${((estimatedFinalDocs / 10746) * 100).toFixed(1)}%`);
            
        } else {
            console.log('⚠️ 진행상황 파일 없음 - 작업이 완료되었거나 아직 시작되지 않음');
        }
        
        console.log('\n' + '═'.repeat(70));
        console.log('💡 Ctrl+C로 종료 | 30초마다 자동 갱신');
        
    } catch (error) {
        console.error('❌ 모니터링 오류:', error.message);
    }
}

// 즉시 한 번 실행
displayProgress();

// 30초마다 반복
const interval = setInterval(displayProgress, 30000);

// Ctrl+C 처리
process.on('SIGINT', () => {
    console.log('\n\n👋 모니터링을 종료합니다.');
    clearInterval(interval);
    process.exit(0);
});