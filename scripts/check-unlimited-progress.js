// unlimited_crawling_output 통합 진행률 실시간 확인 스크립트
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function checkProgress() {
    try {
        console.clear();
        console.log('🚀 unlimited_crawling_output 통합 진행률 모니터링\n');
        console.log(`⏰ 확인 시간: ${new Date().toLocaleString()}\n`);
        
        // 1. 진행상황 파일 확인
        let progressData = null;
        try {
            const progressFile = await fs.readFile('/Users/minhyuk/Desktop/우진봇/unlimited-integration-progress.json', 'utf-8');
            progressData = JSON.parse(progressFile);
        } catch (error) {
            console.log('📄 진행상황 파일을 찾을 수 없습니다. 아직 시작되지 않았거나 완료되었을 수 있습니다.\n');
        }
        
        // 2. 데이터베이스 현황
        const { data: dbStats } = await supabase.rpc('get_document_stats');
        const { count: totalCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });
            
        const { count: unlimitedCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .like('source_file', 'unlimited_page_%');
        
        console.log('📊 현재 데이터베이스 현황:');
        console.log(`  💾 전체 문서 수: ${totalCount}개`);
        console.log(`  🔄 unlimited 문서: ${unlimitedCount}개`);
        console.log(`  📈 기존 대비 증가: +${totalCount - 10746}개 (${((totalCount - 10746) / 10746 * 100).toFixed(1)}%)\n`);
        
        // 3. 진행상황 상세 정보
        if (progressData) {
            const { 
                processed_files, 
                total_files, 
                generated_documents, 
                current_batch, 
                total_batches,
                timestamp 
            } = progressData;
            
            const progressPercent = (processed_files / total_files * 100).toFixed(1);
            const batchProgress = (current_batch / total_batches * 100).toFixed(1);
            
            console.log('📋 처리 진행 상황:');
            console.log(`  📁 파일 처리: ${processed_files}/${total_files} (${progressPercent}%)`);
            console.log(`  📦 배치 진행: ${current_batch}/${total_batches} (${batchProgress}%)`);
            console.log(`  📝 생성된 문서: ${generated_documents}개`);
            console.log(`  ⏱️  마지막 업데이트: ${new Date(timestamp).toLocaleString()}\n`);
            
            // 진행률 바 시각화
            const barLength = 50;
            const filledLength = Math.round(barLength * processed_files / total_files);
            const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
            console.log(`🔄 진행률: [${bar}] ${progressPercent}%\n`);
            
            // 예상 완료 시간 계산
            if (processed_files > 0) {
                const startTime = new Date(timestamp).getTime() - (processed_files * 2000); // 대략적 계산
                const elapsedTime = Date.now() - startTime;
                const avgTimePerFile = elapsedTime / processed_files;
                const remainingFiles = total_files - processed_files;
                const estimatedRemainingTime = remainingFiles * avgTimePerFile;
                const estimatedCompletion = new Date(Date.now() + estimatedRemainingTime);
                
                console.log('⏳ 예상 완료 시간:');
                console.log(`  📅 완료 예정: ${estimatedCompletion.toLocaleString()}`);
                console.log(`  ⌛ 남은 시간: ${Math.round(estimatedRemainingTime / 1000 / 60)}분\n`);
            }
            
            // 최종 예상 결과
            const currentRate = generated_documents / processed_files;
            const estimatedFinalDocuments = Math.round(total_files * currentRate);
            console.log('🎯 예상 최종 결과:');
            console.log(`  📊 예상 총 문서: ${10746 + estimatedFinalDocuments}개`);
            console.log(`  📈 예상 증가율: +${((estimatedFinalDocuments / 10746) * 100).toFixed(1)}%`);
            
        } else {
            console.log('⚠️ 진행상황 정보가 없습니다.');
            console.log('   - 아직 작업이 시작되지 않았거나');
            console.log('   - 이미 완료되었을 수 있습니다.');
            console.log('   - 또는 다른 터미널에서 실행 중일 수 있습니다.\n');
        }
        
        // 4. 실시간 로그 힌트
        console.log('💡 추가 모니터링 방법:');
        console.log('  • 이 스크립트 재실행: npm run check-unlimited-progress');
        console.log('  • 실시간 모니터링: npm run watch-unlimited-progress');
        console.log('  • 로그 파일 확인: tail -f logs/unlimited-integration.log');
        console.log('  • 프로세스 확인: ps aux | grep "integrate-unlimited"');
        
    } catch (error) {
        console.error('❌ 진행률 확인 실패:', error.message);
    }
}

// 실행
checkProgress();