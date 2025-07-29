// 대진대학교 챗봇 성능 벤치마크 도구
// 기존 서버 vs 최적화 서버 자동 성능 테스트

const fetch = require('node-fetch');

// 테스트 설정
const ORIGINAL_SERVER = 'http://localhost:3001';
const OPTIMIZED_SERVER = 'http://localhost:3003';
const TEST_ROUNDS = 5; // 각 질문당 테스트 횟수

// 테스트 질문 세트
const TEST_QUERIES = [
    '컴퓨터공학과 교수님들이 누구인가요?',
    '수강신청 방법을 알려주세요',
    '도서관 이용시간이 어떻게 되나요?',
    '기숙사 신청은 어떻게 하나요?',
    '김철수 교수님 시간표를 알려주세요',
    '전자공학과 커리큘럼이 어떻게 되나요?',
    '학과 사무실 위치가 어디인가요?',
    '졸업 요건을 알려주세요'
];

// 서버 상태 확인
async function checkServerHealth(serverUrl) {
    try {
        const response = await fetch(`${serverUrl}/api/health`, {
            timeout: 5000
        });
        
        if (response.ok) {
            const data = await response.json();
            return { online: true, data };
        }
        return { online: false, error: 'Not OK response' };
    } catch (error) {
        return { online: false, error: error.message };
    }
}

// 단일 질문 테스트
async function testSingleQuery(serverUrl, query) {
    const startTime = Date.now();
    
    try {
        const response = await fetch(`${serverUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: query }),
            timeout: 30000 // 30초 타임아웃
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        return {
            success: true,
            responseTime,
            responseLength: data.response?.length || 0,
            documentsFound: data.context?.length || data.performance?.documentsFound || 0,
            contextLength: data.performance?.contextLength || 0,
            error: null
        };
        
    } catch (error) {
        const endTime = Date.now();
        return {
            success: false,
            responseTime: endTime - startTime,
            error: error.message
        };
    }
}

// 여러 라운드 테스트
async function testMultipleRounds(serverUrl, serverName, query, rounds = TEST_ROUNDS) {
    console.log(`\n🔄 ${serverName}에서 "${query}" 테스트 중... (${rounds}라운드)`);
    
    const results = [];
    
    for (let i = 0; i < rounds; i++) {
        process.stdout.write(`  라운드 ${i + 1}/${rounds}... `);
        
        const result = await testSingleQuery(serverUrl, query);
        results.push(result);
        
        if (result.success) {
            console.log(`✅ ${result.responseTime}ms`);
        } else {
            console.log(`❌ 실패: ${result.error}`);
        }
        
        // 서버 부하 방지를 위한 대기
        if (i < rounds - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return results;
}

// 통계 계산
function calculateStats(results) {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
        return {
            successRate: 0,
            avgResponseTime: 0,
            minResponseTime: 0,
            maxResponseTime: 0,
            avgResponseLength: 0,
            avgDocumentsFound: 0,
            avgContextLength: 0
        };
    }
    
    const responseTimes = successfulResults.map(r => r.responseTime);
    const responseLengths = successfulResults.map(r => r.responseLength);
    const documentsFound = successfulResults.map(r => r.documentsFound);
    const contextLengths = successfulResults.map(r => r.contextLength);
    
    return {
        successRate: (successfulResults.length / results.length) * 100,
        avgResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
        avgResponseLength: Math.round(responseLengths.reduce((a, b) => a + b, 0) / responseLengths.length),
        avgDocumentsFound: Math.round(documentsFound.reduce((a, b) => a + b, 0) / documentsFound.length * 10) / 10,
        avgContextLength: Math.round(contextLengths.reduce((a, b) => a + b, 0) / contextLengths.length)
    };
}

// 결과 출력
function printResults(queryStats, overallStats) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 성능 테스트 결과');
    console.log('='.repeat(80));
    
    // 질문별 결과
    console.log('\n📋 질문별 성능 비교:');
    console.log('-'.repeat(80));
    
    TEST_QUERIES.forEach((query, index) => {
        const originalStats = queryStats.original[index];
        const optimizedStats = queryStats.optimized[index];
        
        console.log(`\n${index + 1}. "${query}"`);
        console.log(`   🔵 기존 서버: ${originalStats.avgResponseTime}ms (성공률: ${originalStats.successRate}%)`);
        console.log(`   🟢 최적화서버: ${optimizedStats.avgResponseTime}ms (성공률: ${optimizedStats.successRate}%)`);
        
        if (originalStats.avgResponseTime > 0 && optimizedStats.avgResponseTime > 0) {
            const improvement = ((originalStats.avgResponseTime - optimizedStats.avgResponseTime) / originalStats.avgResponseTime * 100).toFixed(1);
            console.log(`   📈 개선률: ${improvement > 0 ? '+' : ''}${improvement}%`);
        }
    });
    
    // 전체 통계
    console.log('\n📊 전체 성능 통계:');
    console.log('-'.repeat(80));
    
    const printServerStats = (name, stats, emoji) => {
        console.log(`\n${emoji} ${name}:`);
        console.log(`   평균 응답시간: ${stats.avgResponseTime}ms`);
        console.log(`   응답시간 범위: ${stats.minResponseTime}ms ~ ${stats.maxResponseTime}ms`);
        console.log(`   성공률: ${stats.successRate.toFixed(1)}%`);
        console.log(`   평균 응답길이: ${stats.avgResponseLength}자`);
        console.log(`   평균 문서수: ${stats.avgDocumentsFound}개`);
        if (stats.avgContextLength > 0) {
            console.log(`   평균 컨텍스트: ${stats.avgContextLength}자`);
        }
    };
    
    printServerStats('기존 서버', overallStats.original, '🔵');
    printServerStats('최적화 서버', overallStats.optimized, '🟢');
    
    // 종합 비교
    if (overallStats.original.avgResponseTime > 0 && overallStats.optimized.avgResponseTime > 0) {
        const overallImprovement = ((overallStats.original.avgResponseTime - overallStats.optimized.avgResponseTime) / overallStats.original.avgResponseTime * 100).toFixed(1);
        
        console.log('\n🎯 종합 결과:');
        console.log('-'.repeat(40));
        console.log(`전체 성능 개선률: ${overallImprovement > 0 ? '+' : ''}${overallImprovement}%`);
        
        if (overallImprovement > 0) {
            console.log(`🚀 최적화 서버가 ${overallImprovement}% 더 빠릅니다!`);
        } else {
            console.log(`⚠️ 추가 최적화가 필요합니다.`);
        }
        
        // 속도 등급
        const avgResponse = overallStats.optimized.avgResponseTime;
        let grade = '';
        if (avgResponse < 1000) grade = '🏆 매우 빠름';
        else if (avgResponse < 2000) grade = '🥇 빠름';
        else if (avgResponse < 3000) grade = '🥈 보통';
        else if (avgResponse < 5000) grade = '🥉 느림';
        else grade = '🐌 매우 느림';
        
        console.log(`최적화 서버 속도 등급: ${grade} (${avgResponse}ms)`);
    }
    
    console.log('\n' + '='.repeat(80));
}

// 메인 벤치마크 실행
async function runBenchmark() {
    console.log('🎓 대진대학교 챗봇 성능 벤치마크 도구');
    console.log('=' .repeat(50));
    console.log(`테스트 라운드: ${TEST_ROUNDS}회`);
    console.log(`테스트 질문: ${TEST_QUERIES.length}개`);
    
    // 서버 상태 확인
    console.log('\n🔍 서버 상태 확인 중...');
    const originalHealth = await checkServerHealth(ORIGINAL_SERVER);
    const optimizedHealth = await checkServerHealth(OPTIMIZED_SERVER);
    
    console.log(`🔵 기존 서버 (3001): ${originalHealth.online ? '✅ 온라인' : '❌ 오프라인 - ' + originalHealth.error}`);
    console.log(`🟢 최적화 서버 (3003): ${optimizedHealth.online ? '✅ 온라인' : '❌ 오프라인 - ' + optimizedHealth.error}`);
    
    if (!originalHealth.online || !optimizedHealth.online) {
        console.log('\n❌ 모든 서버가 온라인 상태여야 테스트를 진행할 수 있습니다.');
        process.exit(1);
    }
    
    // 테스트 시작
    console.log('\n🚀 성능 테스트 시작...');
    const startTime = Date.now();
    
    const queryStats = {
        original: [],
        optimized: []
    };
    
    // 각 질문에 대해 테스트
    for (let i = 0; i < TEST_QUERIES.length; i++) {
        const query = TEST_QUERIES[i];
        
        console.log(`\n📝 질문 ${i + 1}/${TEST_QUERIES.length}: "${query}"`);
        
        // 기존 서버 테스트
        const originalResults = await testMultipleRounds(ORIGINAL_SERVER, '기존 서버', query);
        queryStats.original.push(calculateStats(originalResults));
        
        // 최적화 서버 테스트
        const optimizedResults = await testMultipleRounds(OPTIMIZED_SERVER, '최적화 서버', query);
        queryStats.optimized.push(calculateStats(optimizedResults));
        
        // 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 전체 통계 계산
    const calculateOverallStats = (serverStats) => {
        const allStats = {
            successRate: serverStats.reduce((sum, stat) => sum + stat.successRate, 0) / serverStats.length,
            avgResponseTime: Math.round(serverStats.reduce((sum, stat) => sum + stat.avgResponseTime, 0) / serverStats.length),
            minResponseTime: Math.min(...serverStats.map(stat => stat.minResponseTime).filter(t => t > 0)),
            maxResponseTime: Math.max(...serverStats.map(stat => stat.maxResponseTime)),
            avgResponseLength: Math.round(serverStats.reduce((sum, stat) => sum + stat.avgResponseLength, 0) / serverStats.length),
            avgDocumentsFound: Math.round(serverStats.reduce((sum, stat) => sum + stat.avgDocumentsFound, 0) / serverStats.length * 10) / 10,
            avgContextLength: Math.round(serverStats.reduce((sum, stat) => sum + stat.avgContextLength, 0) / serverStats.length)
        };
        
        // NaN 방지
        if (!isFinite(allStats.minResponseTime)) allStats.minResponseTime = 0;
        if (!isFinite(allStats.maxResponseTime)) allStats.maxResponseTime = 0;
        
        return allStats;
    };
    
    const overallStats = {
        original: calculateOverallStats(queryStats.original),
        optimized: calculateOverallStats(queryStats.optimized)
    };
    
    const endTime = Date.now();
    const totalTime = Math.round((endTime - startTime) / 1000);
    
    // 결과 출력
    printResults(queryStats, overallStats);
    
    console.log(`\n⏱️ 전체 테스트 소요시간: ${totalTime}초`);
    console.log(`📅 테스트 완료: ${new Date().toLocaleString('ko-KR')}`);
}

// 스크립트 실행
if (require.main === module) {
    runBenchmark().catch(error => {
        console.error('\n❌ 벤치마크 실행 중 오류 발생:', error);
        process.exit(1);
    });
}

module.exports = { runBenchmark, testSingleQuery, calculateStats };