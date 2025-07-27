#!/usr/bin/env node
/**
 * Supabase 데이터베이스 내용 확인 스크립트
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function checkSupabaseData() {
    console.log('🔍 Supabase 데이터베이스 내용 확인 중...\n');
    
    try {
        // 문서 통계 조회
        const { data: stats, error: statsError } = await supabase
            .from('documents')
            .select('source_type, source_file')
            .order('created_at', { ascending: false });

        if (statsError) {
            console.error('❌ 데이터 조회 오류:', statsError.message);
            return;
        }

        // 소스 타입별 통계
        const sourceTypeStats = {};
        const sourceFileStats = {};
        
        stats.forEach(doc => {
            sourceTypeStats[doc.source_type] = (sourceTypeStats[doc.source_type] || 0) + 1;
            sourceFileStats[doc.source_file] = (sourceFileStats[doc.source_file] || 0) + 1;
        });

        console.log('📊 데이터베이스 통계:');
        console.log('─'.repeat(50));
        console.log(`📄 총 문서 수: ${stats.length.toLocaleString()}개`);
        
        console.log('\n📂 소스 타입별 분포:');
        Object.entries(sourceTypeStats).forEach(([type, count]) => {
            console.log(`   ${type}: ${count.toLocaleString()}개`);
        });
        
        console.log('\n📁 소스 파일별 분포:');
        Object.entries(sourceFileStats).forEach(([file, count]) => {
            console.log(`   ${file}: ${count.toLocaleString()}개`);
        });

        // 최근 문서 샘플 확인
        const { data: recentDocs, error: recentError } = await supabase
            .from('documents')
            .select('source_type, source_file, content, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (!recentError && recentDocs.length > 0) {
            console.log('\n📝 최근 문서 샘플:');
            console.log('─'.repeat(50));
            recentDocs.forEach((doc, index) => {
                const preview = doc.content.substring(0, 100).replace(/\n/g, ' ');
                console.log(`${index + 1}. [${doc.source_type}] ${doc.source_file}`);
                console.log(`   내용: ${preview}...`);
                console.log(`   생성: ${new Date(doc.created_at).toLocaleString('ko-KR')}\n`);
            });
        }

        // 데이터 정합성 확인
        console.log('🔍 데이터 정합성 검사:');
        console.log('─'.repeat(50));
        
        const expectedFiles = ['timetable.txt', '종합강의 시간표 안내.txt'];
        const expectedTypes = ['timetable', 'announcement'];
        
        let isValid = true;
        
        expectedFiles.forEach(file => {
            const count = sourceFileStats[file] || 0;
            if (count === 0) {
                console.log(`❌ ${file}: 데이터 없음`);
                isValid = false;
            } else {
                console.log(`✅ ${file}: ${count.toLocaleString()}개 문서`);
            }
        });
        
        expectedTypes.forEach(type => {
            const count = sourceTypeStats[type] || 0;
            if (count === 0) {
                console.log(`❌ ${type}: 데이터 없음`);
                isValid = false;
            } else {
                console.log(`✅ ${type}: ${count.toLocaleString()}개 문서`);
            }
        });

        // 불필요한 데이터 확인
        const unexpectedTypes = Object.keys(sourceTypeStats).filter(type => !expectedTypes.includes(type));
        if (unexpectedTypes.length > 0) {
            console.log(`⚠️  예상하지 못한 소스 타입: ${unexpectedTypes.join(', ')}`);
            isValid = false;
        }

        console.log(`\n${isValid ? '✅' : '❌'} 데이터 정합성: ${isValid ? '정상' : '문제 발견'}`);

    } catch (error) {
        console.error('❌ 확인 중 오류 발생:', error.message);
    }
}

// 실행
if (require.main === module) {
    checkSupabaseData();
}

module.exports = { checkSupabaseData };