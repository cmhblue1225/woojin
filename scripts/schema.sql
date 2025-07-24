-- 대진대학교 RAG 챗봇 데이터베이스 스키마

-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 문서 테이블
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI text-embedding-3-small 차원
    source_type VARCHAR(50) NOT NULL, -- 'timetable', 'announcement', 'website' 등
    source_file VARCHAR(255), -- 원본 파일명
    metadata JSONB DEFAULT '{}', -- 추가 메타데이터 (제목, 카테고리, 날짜 등)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 벡터 검색을 위한 인덱스
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 소스 타입별 검색을 위한 인덱스
CREATE INDEX idx_documents_source_type ON documents (source_type);

-- 메타데이터 검색을 위한 인덱스
CREATE INDEX idx_documents_metadata ON documents USING GIN (metadata);

-- 채팅 히스토리 테이블 (선택사항)
CREATE TABLE chat_history (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID DEFAULT gen_random_uuid(),
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    context_documents JSONB, -- 응답에 사용된 문서들
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 세션별 검색을 위한 인덱스
CREATE INDEX idx_chat_history_session ON chat_history (session_id);

-- 임베딩 작업 상태 테이블
CREATE TABLE embedding_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    total_documents INTEGER DEFAULT 0,
    processed_documents INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 정책 - 모든 사용자가 읽기 가능
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_jobs ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책
CREATE POLICY "Public read access" ON documents FOR SELECT USING (true);
CREATE POLICY "Public read access" ON chat_history FOR SELECT USING (true);
CREATE POLICY "Public read access" ON embedding_jobs FOR SELECT USING (true);

-- 공개 삽입 정책
CREATE POLICY "Public insert access" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert access" ON chat_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert access" ON embedding_jobs FOR INSERT WITH CHECK (true);

-- 공개 업데이트 정책
CREATE POLICY "Public update access" ON documents FOR UPDATE USING (true);
CREATE POLICY "Public update access" ON embedding_jobs FOR UPDATE USING (true);

-- 함수: 유사도 검색
CREATE OR REPLACE FUNCTION search_documents(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_source_type VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    content TEXT,
    source_type VARCHAR,
    source_file VARCHAR,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        d.id,
        d.content,
        d.source_type,
        d.source_file,
        d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM documents d
    WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
    AND (filter_source_type IS NULL OR d.source_type = filter_source_type)
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
$$;