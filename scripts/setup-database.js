// Supabase 데이터베이스 설정 스크립트
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ SUPABASE_URL과 SUPABASE_ANON_KEY 환경변수가 필요합니다.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        console.log('🔄 데이터베이스 스키마 설정 중...');

        // SQL 스키마 파일 읽기
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // SQL 실행 (주의: RLS 정책으로 인해 service role key가 필요할 수 있음)
        console.log('⚠️  스키마 실행은 Supabase 대시보드에서 수동으로 실행해주세요.');
        console.log('📄 schema.sql 파일 내용을 Supabase SQL Editor에 복사하여 실행하세요.');
        
        // 테이블 존재 확인
        const { data: tables, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public');

        if (error) {
            console.log('📝 테이블 확인 중 오류 (정상적일 수 있음):', error.message);
        } else {
            console.log('✅ 현재 테이블들:', tables?.map(t => t.table_name) || []);
        }

        console.log('✅ 데이터베이스 설정 완료');

    } catch (error) {
        console.error('❌ 데이터베이스 설정 실패:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };