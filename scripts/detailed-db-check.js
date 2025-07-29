require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function checkDB() {
    try {
        console.log('📊 데이터베이스 상세 분석...');
        
        const { data: allDocs, error } = await supabase
            .from('documents')
            .select('source_type, source_file, content');
            
        if (error) throw error;
        
        console.log(`💾 총 문서 수: ${allDocs.length}개`);
        
        // 소스 타입별 분포
        const sourceTypeStats = allDocs.reduce((acc, doc) => {
            acc[doc.source_type] = (acc[doc.source_type] || 0) + 1;
            return acc;
        }, {});
        
        console.log('📋 소스 타입별 분포:');
        Object.entries(sourceTypeStats).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count}개`);
        });
        
        // 웹사이트 타입 파일들 분석
        const websiteDocs = allDocs.filter(doc => doc.source_type === 'website');
        console.log(`\n🌐 웹사이트 문서 상세 정보 (${websiteDocs.length}개):`);
        
        websiteDocs.forEach((doc, idx) => {
            console.log(`  ${idx + 1}. ${doc.source_file} (길이: ${doc.content.length}자)`);
        });
        
        // 각 크롤링 prefix별 분석
        const prefixes = ['page_', 'enhanced_strategic_page_', 'strategic_page_', 'unlimited_page_'];
        
        console.log('\n🔍 크롤링 prefix별 DB 통합 현황:');
        prefixes.forEach(prefix => {
            const matchingDocs = allDocs.filter(doc => 
                doc.source_file.startsWith(prefix) || 
                doc.source_file.includes(prefix)
            );
            console.log(`  - ${prefix}*: ${matchingDocs.length}개`);
            
            if (matchingDocs.length > 0 && matchingDocs.length <= 10) {
                matchingDocs.forEach(doc => {
                    console.log(`    → ${doc.source_file}`);
                });
            }
        });
        
        // timetable이 아닌 문서들 확인
        const nonTimetableDocs = allDocs.filter(doc => doc.source_type !== 'timetable');
        console.log(`\n📄 timetable이 아닌 문서들 (${nonTimetableDocs.length}개):`);
        
        nonTimetableDocs.slice(0, 10).forEach((doc, idx) => {
            console.log(`  ${idx + 1}. [${doc.source_type}] ${doc.source_file} (길이: ${doc.content.length}자)`);
        });
        
        // announcement 타입 확인
        const announcementDocs = allDocs.filter(doc => doc.source_type === 'announcement');
        console.log(`\n📢 announcement 문서들 (${announcementDocs.length}개):`);
        if (announcementDocs.length > 0) {
            console.log(`  첫 번째 파일: ${announcementDocs[0].source_file}`);
            console.log(`  마지막 파일: ${announcementDocs[announcementDocs.length - 1].source_file}`);
        }
        
    } catch (error) {
        console.error('❌ 확인 실패:', error.message);
    }
}

checkDB();