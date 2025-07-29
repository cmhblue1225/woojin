// 데이터 품질 분석 스크립트
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function analyzeDataQuality() {
    try {
        console.log('🔍 데이터베이스 품질 분석 시작...\n');

        // 1. 전체 통계
        const { data: stats, error: statsError } = await supabase
            .from('documents')
            .select('*');

        if (statsError) throw statsError;

        console.log(`📊 전체 문서 수: ${stats.length}개`);

        // 2. 소스 타입별 분포
        const sourceStats = stats.reduce((acc, doc) => {
            acc[doc.source_type] = (acc[doc.source_type] || 0) + 1;
            return acc;
        }, {});

        console.log('\n📂 소스 타입별 분포:');
        Object.entries(sourceStats).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}개`);
        });

        // 3. 콘텐츠 길이 분석
        const lengths = stats.map(doc => doc.content.length);
        const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
        const minLength = Math.min(...lengths);
        const maxLength = Math.max(...lengths);

        console.log('\n📏 콘텐츠 길이 분석:');
        console.log(`  평균 길이: ${avgLength}자`);
        console.log(`  최소 길이: ${minLength}자`);
        console.log(`  최대 길이: ${maxLength}자`);

        // 4. 짧은 문서들 (100자 미만)
        const shortDocs = stats.filter(doc => doc.content.length < 100);
        console.log(`\n⚠️  짧은 문서 (100자 미만): ${shortDocs.length}개`);

        // 5. 샘플 콘텐츠 확인 (각 소스 타입별로)
        console.log('\n📄 샘플 콘텐츠 확인:');
        
        for (const [sourceType, count] of Object.entries(sourceStats)) {
            console.log(`\n--- ${sourceType} (${count}개) ---`);
            
            const samples = stats
                .filter(doc => doc.source_type === sourceType)
                .slice(0, 3); // 상위 3개 샘플
                
            samples.forEach((doc, index) => {
                console.log(`\n[${sourceType} 샘플 ${index + 1}]`);
                console.log(`소스: ${doc.source_file}`);
                console.log(`길이: ${doc.content.length}자`);
                console.log(`내용: ${doc.content.substring(0, 200)}...`);
            });
        }

        // 6. 웹사이트 데이터 품질 특별 분석
        const websiteDocs = stats.filter(doc => doc.source_type === 'website');
        if (websiteDocs.length > 0) {
            console.log('\n🌐 웹사이트 데이터 품질 분석:');
            
            // 네비게이션, 메뉴 등 불필요한 내용 포함 문서 찾기
            const navigationDocs = websiteDocs.filter(doc => 
                doc.content.includes('메뉴') || 
                doc.content.includes('네비게이션') ||
                doc.content.includes('바로가기') ||
                doc.content.includes('사이트맵') ||
                doc.content.length < 50
            );
            
            console.log(`  네비게이션/메뉴 포함 문서: ${navigationDocs.length}개`);
            
            // 실제 컨텐츠가 있는 문서 찾기
            const contentfulDocs = websiteDocs.filter(doc => 
                doc.content.length > 200 &&
                !doc.content.includes('메뉴') &&
                !doc.content.includes('네비게이션')
            );
            
            console.log(`  의미있는 컨텐츠 문서: ${contentfulDocs.length}개`);
        }

        // 7. 데이터 품질 점수 계산
        const qualityScore = calculateQualityScore(stats);
        console.log(`\n📈 전체 데이터 품질 점수: ${qualityScore.toFixed(1)}/100`);
        
        return stats;

    } catch (error) {
        console.error('❌ 분석 중 오류:', error.message);
        throw error;
    }
}

function calculateQualityScore(documents) {
    let score = 0;
    
    // 1. 문서 수 점수 (많을수록 좋음, 최대 30점)
    const docCountScore = Math.min(documents.length / 100, 30);
    score += docCountScore;
    
    // 2. 평균 길이 점수 (적당한 길이가 좋음, 최대 25점)
    const avgLength = documents.reduce((acc, doc) => acc + doc.content.length, 0) / documents.length;
    const lengthScore = avgLength > 100 && avgLength < 2000 ? 25 : 
                       avgLength > 50 ? 15 : 5;
    score += lengthScore;
    
    // 3. 다양성 점수 (소스 타입 다양성, 최대 20점)
    const sourceTypes = new Set(documents.map(doc => doc.source_type));
    const diversityScore = Math.min(sourceTypes.size * 7, 20);
    score += diversityScore;
    
    // 4. 완전성 점수 (짧은 문서 비율이 낮을수록 좋음, 최대 25점)
    const shortDocs = documents.filter(doc => doc.content.length < 100);
    const completenessScore = Math.max(25 - (shortDocs.length / documents.length) * 50, 0);
    score += completenessScore;
    
    return score;
}

// 실행
if (require.main === module) {
    analyzeDataQuality()
        .then(() => {
            console.log('\n✅ 분석 완료!');
        })
        .catch(error => {
            console.error('\n❌ 분석 실패:', error.message);
        });
}

module.exports = { analyzeDataQuality };