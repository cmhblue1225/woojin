// 크롤링 파일 필터링 이유 분석 스크립트
const fs = require('fs').promises;
const path = require('path');

// 품질 필터링 함수 (실제 스크립트와 동일)
function processContent(content) {
    const cleanPatterns = [
        /^\/WEB-INF\/jsp\/.*$/gm,
        /^[a-zA-Z0-9_]+_JW_MS_K2WT\d+_[MN]$/gm,
        /메뉴|네비게이션|바로가기|이전|다음|TOP|닫기/g,
        /^\s*\n+/gm,
        /\n{3,}/g
    ];
    
    let cleaned = content;
    cleanPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
    });
    cleaned = cleaned.trim();
    
    const meaningfulKeywords = [
        '대학교', '학과', '전공', '교수', '학생', '교육', '연구', '프로그램',
        '입학', '졸업', '수강', '강의', '시간표', '공지', '일정', '센터',
        '도서관', '기숙사', '장학', '취업', '국제', '교류', '안내', '소개',
        '모집', '신청', '등록', '대학원', '학부', '과정', '학회', '행사'
    ];
    
    const hasMeaningfulContent = meaningfulKeywords.some(keyword => 
        cleaned.includes(keyword)
    );
    
    if (!hasMeaningfulContent || cleaned.length < 100) {
        return { processed: null, reason: cleaned.length < 100 ? 'too_short' : 'no_meaningful_content' };
    }
    
    return { processed: cleaned, reason: 'success' };
}

async function analyzeFilteringReasons() {
    console.log('🔍 크롤링 파일 필터링 분석...\n');
    
    const dirs = [
        { 
            name: 'enhanced_strategic_output', 
            path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_strategic_output',
            maxSample: 100
        },
        { 
            name: 'enhanced_output', 
            path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_output',
            maxSample: 100
        },
        { 
            name: 'strategic_output', 
            path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/strategic_output',
            maxSample: 50
        },
        { 
            name: 'unlimited_crawling_output', 
            path: '/Users/minhyuk/Desktop/우진봇/crawlingTest/unlimited_crawling_output',
            maxSample: 100
        }
    ];
    
    let totalAnalyzed = 0;
    let results = {
        tooShort: 0,
        noMeaningfulContent: 0,
        emptyFiles: 0,
        processedSuccessfully: 0,
        errors: 0
    };
    
    const examples = {
        tooShort: [],
        noMeaningfulContent: [],
        success: []
    };
    
    for (const dir of dirs) {
        try {
            const files = await fs.readdir(dir.path);
            const txtFiles = files.filter(f => f.endsWith('.txt')).slice(0, dir.maxSample);
            
            console.log(`📁 ${dir.name}: ${txtFiles.length}개 파일 분석 중...`);
            
            for (const file of txtFiles) {
                try {
                    const content = await fs.readFile(path.join(dir.path, file), 'utf-8');
                    totalAnalyzed++;
                    
                    if (!content.trim()) {
                        results.emptyFiles++;
                        continue;
                    }
                    
                    // 메타데이터 제거
                    const lines = content.split('\n');
                    let contentStart = 0;
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line.startsWith('[') && line.endsWith(']')) {
                            contentStart = i + 1;
                        } else if (line === '') {
                            contentStart = i + 1;
                            break;
                        }
                    }
                    const actualContent = lines.slice(contentStart).join('\n').trim();
                    
                    const result = processContent(actualContent);
                    
                    if (result.reason === 'success') {
                        results.processedSuccessfully++;
                        if (examples.success.length < 3) {
                            examples.success.push({
                                file: file,
                                length: result.processed.length,
                                preview: result.processed.substring(0, 100)
                            });
                        }
                    } else if (result.reason === 'too_short') {
                        results.tooShort++;
                        if (examples.tooShort.length < 3) {
                            examples.tooShort.push({
                                file: file,
                                length: actualContent.length,
                                preview: actualContent.substring(0, 100)
                            });
                        }
                    } else if (result.reason === 'no_meaningful_content') {
                        results.noMeaningfulContent++;
                        if (examples.noMeaningfulContent.length < 3) {
                            examples.noMeaningfulContent.push({
                                file: file,
                                length: actualContent.length,
                                preview: actualContent.substring(0, 100)
                            });
                        }
                    }
                    
                } catch (error) {
                    results.errors++;
                }
            }
        } catch (error) {
            console.error(`❌ ${dir.name} 처리 실패:`, error.message);
        }
    }
    
    console.log(`\n📊 필터링 분석 결과 (샘플 ${totalAnalyzed}개 파일):`);
    console.log(`✅ 성공적으로 처리: ${results.processedSuccessfully}개 (${(results.processedSuccessfully/totalAnalyzed*100).toFixed(1)}%)`);
    console.log(`❌ 너무 짧음 (<100자): ${results.tooShort}개 (${(results.tooShort/totalAnalyzed*100).toFixed(1)}%)`);
    console.log(`❌ 의미있는 내용 없음: ${results.noMeaningfulContent}개 (${(results.noMeaningfulContent/totalAnalyzed*100).toFixed(1)}%)`);
    console.log(`❌ 빈 파일: ${results.emptyFiles}개 (${(results.emptyFiles/totalAnalyzed*100).toFixed(1)}%)`);
    console.log(`❌ 처리 오류: ${results.errors}개 (${(results.errors/totalAnalyzed*100).toFixed(1)}%)`);
    
    const successRate = results.processedSuccessfully / totalAnalyzed * 100;
    console.log(`\n🎯 실제 통합율: ${(5877/26026*100).toFixed(1)}% (5,877/26,026)`);
    console.log(`📊 샘플 성공율: ${successRate.toFixed(1)}%`);
    console.log(`📈 차이: ${((5877/26026*100) - successRate).toFixed(1)}%포인트`);
    
    // 예시 출력
    console.log('\n🔍 필터링된 파일 예시:');
    
    console.log('\n❌ 너무 짧은 파일들:');
    examples.tooShort.forEach((ex, idx) => {
        console.log(`  ${idx + 1}. ${ex.file} (${ex.length}자): "${ex.preview}..."`);
    });
    
    console.log('\n❌ 의미있는 내용이 없는 파일들:');
    examples.noMeaningfulContent.forEach((ex, idx) => {
        console.log(`  ${idx + 1}. ${ex.file} (${ex.length}자): "${ex.preview}..."`);
    });
    
    console.log('\n✅ 성공적으로 처리된 파일들:');
    examples.success.forEach((ex, idx) => {
        console.log(`  ${idx + 1}. ${ex.file} (${ex.length}자): "${ex.preview}..."`);
    });
    
    // 필터링 기준 분석
    console.log('\n💡 필터링 기준 분석:');
    console.log('1. 최소 길이: 100자 이상');
    console.log('2. 필수 키워드 포함: 대학교, 학과, 전공, 교수, 학생, 교육, 연구, 프로그램, 입학, 졸업, 수강, 강의, 시간표, 공지, 일정, 센터, 도서관, 기숙사, 장학, 취업, 국제, 교류, 안내, 소개, 모집, 신청, 등록, 대학원, 학부, 과정, 학회, 행사');
    console.log('3. 불필요한 패턴 제거: 메뉴, 네비게이션, JSP 경로 등');
    
    console.log('\n🔧 필터링 완화 제안:');
    if (results.tooShort > results.processedSuccessfully * 0.3) {
        console.log('- 최소 길이를 100자 → 50자로 완화 고려');
    }
    if (results.noMeaningfulContent > results.processedSuccessfully * 0.5) {
        console.log('- 키워드 목록 확장 또는 완화 고려');
    }
}

analyzeFilteringReasons();