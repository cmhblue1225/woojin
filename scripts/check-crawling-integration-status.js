// 크롤링 데이터 통합 상태 체크 스크립트
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// 크롤링 디렉토리 정의
const CRAWLING_DIRS = [
    {
        name: 'enhanced_output',
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_output',
        prefix: 'page_'
    },
    {
        name: 'enhanced_strategic_output',
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_strategic_output',
        prefix: 'enhanced_strategic_page_'
    },
    {
        name: 'strategic_output',
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/strategic_output',
        prefix: 'strategic_page_'
    },
    {
        name: 'unlimited_crawling_output',
        path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/unlimited_crawling_output',
        prefix: 'unlimited_page_'
    }
];

// 디렉토리별 파일 수 확인
async function checkDirectoryFileCount(dirConfig) {
    try {
        const files = await fs.readdir(dirConfig.path);
        const txtFiles = files.filter(file => 
            file.startsWith(dirConfig.prefix) && file.endsWith('.txt')
        );
        
        return {
            name: dirConfig.name,
            path: dirConfig.path,
            totalFiles: txtFiles.length,
            prefix: dirConfig.prefix,
            exists: true
        };
    } catch (error) {
        return {
            name: dirConfig.name,
            path: dirConfig.path,
            totalFiles: 0,
            prefix: dirConfig.prefix,
            exists: false,
            error: error.message
        };
    }
}

// 데이터베이스 상태 확인
async function checkDatabaseStatus() {
    try {
        // 총 문서 수
        const { count: totalCount } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });

        // 소스 타입별 분포
        const { data: allDocs } = await supabase
            .from('documents')
            .select('source_type, source_file');

        const sourceTypeStats = allDocs.reduce((acc, doc) => {
            acc[doc.source_type] = (acc[doc.source_type] || 0) + 1;
            return acc;
        }, {});

        // 웹사이트 소스 파일별 통계
        const websiteDocs = allDocs.filter(doc => doc.source_type === 'website');
        const websiteFileStats = {};
        
        websiteDocs.forEach(doc => {
            const fileName = doc.source_file;
            // 청크가 있는 경우 원본 파일명 추출
            const baseFileName = fileName.includes('_chunk_') 
                ? fileName.split('_chunk_')[0] 
                : fileName;
            
            websiteFileStats[baseFileName] = (websiteFileStats[baseFileName] || 0) + 1;
        });

        return {
            totalCount,
            sourceTypeStats,
            websiteFileCount: Object.keys(websiteFileStats).length,
            websiteDocCount: websiteDocs.length,
            websiteFileStats: websiteFileStats
        };

    } catch (error) {
        console.error('데이터베이스 확인 실패:', error.message);
        return null;
    }
}

// 크롤링 파일과 DB 매칭 분석
async function analyzeCrawlingIntegration() {
    try {
        console.log('🔍 크롤링 데이터 통합 상태 분석 시작...\n');

        // 1. 크롤링 디렉토리별 파일 수 확인
        console.log('📁 크롤링 디렉토리별 파일 수 확인:');
        const dirStats = [];
        let totalCrawledFiles = 0;

        for (const dirConfig of CRAWLING_DIRS) {
            const stat = await checkDirectoryFileCount(dirConfig);
            dirStats.push(stat);
            
            if (stat.exists) {
                console.log(`  ✅ ${stat.name}: ${stat.totalFiles}개 파일`);
                totalCrawledFiles += stat.totalFiles;
            } else {
                console.log(`  ❌ ${stat.name}: 폴더 없음 (${stat.error})`);
            }
        }

        console.log(`\n📊 총 크롤링 파일 수: ${totalCrawledFiles}개\n`);

        // 2. 데이터베이스 상태 확인
        console.log('💾 데이터베이스 상태 확인:');
        const dbStatus = await checkDatabaseStatus();
        
        if (!dbStatus) {
            console.log('❌ 데이터베이스 확인 실패');
            return;
        }

        console.log(`  📊 총 문서 수: ${dbStatus.totalCount}개`);
        console.log(`  📋 소스 타입별 분포:`);
        Object.entries(dbStatus.sourceTypeStats).forEach(([type, count]) => {
            console.log(`    - ${type}: ${count}개`);
        });
        console.log(`  🌐 웹사이트 원본 파일 수: ${dbStatus.websiteFileCount}개`);
        console.log(`  📄 웹사이트 문서 수: ${dbStatus.websiteDocCount}개`);

        // 3. 통합 상태 분석
        console.log('\n🔬 통합 상태 분석:');
        
        // enhanced_output 통합 상태
        const enhancedStat = dirStats.find(s => s.name === 'enhanced_output');
        if (enhancedStat && enhancedStat.exists) {
            const enhancedInDb = Object.keys(dbStatus.websiteFileStats).filter(
                file => file.startsWith('page_') && /^page_\d{5}\.txt$/.test(file)
            ).length;
            
            console.log(`  📁 enhanced_output:`);
            console.log(`    - 크롤링 파일: ${enhancedStat.totalFiles}개`);
            console.log(`    - DB 통합: ${enhancedInDb}개`);
            console.log(`    - 통합률: ${((enhancedInDb / enhancedStat.totalFiles) * 100).toFixed(1)}%`);
        }

        // enhanced_strategic_output 통합 상태
        const strategicStat = dirStats.find(s => s.name === 'enhanced_strategic_output');
        if (strategicStat && strategicStat.exists) {
            const strategicInDb = Object.keys(dbStatus.websiteFileStats).filter(
                file => file.startsWith('enhanced_strategic_page_')
            ).length;
            
            console.log(`  📁 enhanced_strategic_output:`);
            console.log(`    - 크롤링 파일: ${strategicStat.totalFiles}개`);
            console.log(`    - DB 통합: ${strategicInDb}개`);
            console.log(`    - 통합률: ${strategicStat.totalFiles > 0 ? ((strategicInDb / strategicStat.totalFiles) * 100).toFixed(1) : 0}%`);
        }

        // strategic_output 통합 상태
        const basicStrategicStat = dirStats.find(s => s.name === 'strategic_output');
        if (basicStrategicStat && basicStrategicStat.exists) {
            const basicStrategicInDb = Object.keys(dbStatus.websiteFileStats).filter(
                file => file.startsWith('strategic_page_')
            ).length;
            
            console.log(`  📁 strategic_output:`);
            console.log(`    - 크롤링 파일: ${basicStrategicStat.totalFiles}개`);
            console.log(`    - DB 통합: ${basicStrategicInDb}개`);
            console.log(`    - 통합률: ${basicStrategicStat.totalFiles > 0 ? ((basicStrategicInDb / basicStrategicStat.totalFiles) * 100).toFixed(1) : 0}%`);
        }

        // unlimited_crawling_output 통합 상태
        const unlimitedStat = dirStats.find(s => s.name === 'unlimited_crawling_output');
        if (unlimitedStat && unlimitedStat.exists) {
            const unlimitedInDb = Object.keys(dbStatus.websiteFileStats).filter(
                file => file.startsWith('unlimited_page_')
            ).length;
            
            console.log(`  📁 unlimited_crawling_output:`);
            console.log(`    - 크롤링 파일: ${unlimitedStat.totalFiles}개`);
            console.log(`    - DB 통합: ${unlimitedInDb}개`);
            console.log(`    - 통합률: ${((unlimitedInDb / unlimitedStat.totalFiles) * 100).toFixed(1)}%`);
        }

        // 4. 전체 요약
        const totalIntegratedFiles = Object.keys(dbStatus.websiteFileStats).length;
        const integrationRate = ((totalIntegratedFiles / totalCrawledFiles) * 100).toFixed(1);
        
        console.log('\n📋 전체 요약:');
        console.log(`  🗂️  총 크롤링 파일: ${totalCrawledFiles}개`);
        console.log(`  💾 DB 통합 파일: ${totalIntegratedFiles}개`);
        console.log(`  📊 전체 통합률: ${integrationRate}%`);
        
        if (integrationRate < 100) {
            const missingFiles = totalCrawledFiles - totalIntegratedFiles;
            console.log(`  ⚠️  미통합 파일: ${missingFiles}개`);
            console.log(`\n🚀 권장 사항:`);
            console.log(`  - 미통합된 ${missingFiles}개 파일을 추가로 통합하면 답변 품질이 더욱 향상됩니다.`);
        } else {
            console.log(`  ✅ 모든 크롤링 데이터가 통합되었습니다!`);
        }

        // 5. 미통합 디렉토리 세부 정보
        console.log('\n🔍 미통합 상세 정보:');
        for (const stat of dirStats) {
            if (!stat.exists) continue;
            
            let prefix;
            switch (stat.name) {
                case 'enhanced_output':
                    prefix = 'page_';
                    break;
                case 'enhanced_strategic_output':
                    prefix = 'enhanced_strategic_page_';
                    break;
                case 'strategic_output':
                    prefix = 'strategic_page_';
                    break;
                case 'unlimited_crawling_output':
                    prefix = 'unlimited_page_';
                    break;
            }

            const integratedCount = Object.keys(dbStatus.websiteFileStats).filter(
                file => file.startsWith(prefix)
            ).length;

            if (integratedCount < stat.totalFiles) {
                console.log(`  📁 ${stat.name}: ${stat.totalFiles - integratedCount}개 미통합`);
            }
        }

        return {
            totalCrawledFiles,
            totalIntegratedFiles,
            integrationRate: parseFloat(integrationRate),
            dirStats,
            dbStatus
        };

    } catch (error) {
        console.error('❌ 분석 실패:', error.message);
        return null;
    }
}

// 메인 실행
if (require.main === module) {
    analyzeCrawlingIntegration()
        .then(result => {
            if (result) {
                console.log('\n✅ 분석 완료!');
            }
        })
        .catch(error => {
            console.error('\n❌ 실행 실패:', error.message);
        });
}

module.exports = { analyzeCrawlingIntegration };