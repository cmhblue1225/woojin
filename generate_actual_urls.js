// 실제 크롤링된 URL 목록 생성 스크립트
const fs = require('fs');
const path = require('path');

async function generateActualUrls() {
    console.log('🔍 실제 크롤링된 URL 목록 생성 중...');
    
    const crawlingDirs = [
        '/Users/minhyuk/Desktop/우진봇/crawlingTest/unlimited_crawling_output',
        '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_output',
        '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_strategic_output'
    ];
    
    const actualUrls = new Set();
    let totalFiles = 0;
    
    for (const dirPath of crawlingDirs) {
        if (!fs.existsSync(dirPath)) {
            console.log(`⚠️ 디렉토리 없음: ${dirPath}`);
            continue;
        }
        
        const files = fs.readdirSync(dirPath);
        const txtFiles = files.filter(file => file.endsWith('.txt'));
        
        console.log(`📂 ${path.basename(dirPath)}: ${txtFiles.length}개 파일 처리 중...`);
        
        let processedInDir = 0;
        for (const filename of txtFiles) {
            try {
                const filepath = path.join(dirPath, filename);
                const content = fs.readFileSync(filepath, 'utf-8');
                const lines = content.split('\n');
                
                // 첫 번째 줄에서 URL 추출
                if (lines[0] && lines[0].startsWith('[URL]')) {
                    const url = lines[0].replace('[URL]', '').trim();
                    if (url && url.includes('daejin.ac.kr')) {
                        actualUrls.add(url);
                        processedInDir++;
                    }
                }
                
                if (processedInDir % 1000 === 0) {
                    console.log(`  📊 진행률: ${processedInDir}/${txtFiles.length} (${((processedInDir/txtFiles.length)*100).toFixed(1)}%)`);
                }
                
            } catch (error) {
                // 개별 파일 오류는 무시
            }
        }
        
        totalFiles += processedInDir;
        console.log(`✅ ${path.basename(dirPath)}: ${processedInDir}개 URL 추출 완료`);
    }
    
    console.log(`\n📊 총 결과:`);
    console.log(`  📁 총 파일 수: ${totalFiles}개`);
    console.log(`  🔗 고유 URL 수: ${actualUrls.size}개`);
    
    // URL 목록을 JSON 파일로 저장
    const urlList = Array.from(actualUrls).sort();
    const outputData = {
        total_count: urlList.length,
        generated_at: new Date().toISOString(),
        source_files: totalFiles,
        urls: urlList
    };
    
    const outputPath = '/Users/minhyuk/Desktop/우진봇/actual_crawled_urls.json';
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n💾 실제 URL 목록 저장: ${outputPath}`);
    console.log(`📋 파일 크기: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)}MB`);
    
    // 도메인별 통계
    const domainStats = {};
    urlList.forEach(url => {
        try {
            const domain = new URL(url).hostname;
            domainStats[domain] = (domainStats[domain] || 0) + 1;
        } catch (e) {
            // URL 파싱 오류 무시
        }
    });
    
    console.log(`\n🌐 도메인별 URL 통계 (상위 10개):`);
    const sortedDomains = Object.entries(domainStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
        
    sortedDomains.forEach(([domain, count]) => {
        console.log(`  ${domain}: ${count}개`);
    });
    
    return {
        totalUrls: actualUrls.size,
        totalFiles: totalFiles,
        outputPath: outputPath
    };
}

// 실행
generateActualUrls()
    .then(result => {
        console.log(`\n🎉 완료! ${result.totalUrls}개 실제 URL 추출됨`);
    })
    .catch(error => {
        console.error('❌ 오류:', error.message);
    });