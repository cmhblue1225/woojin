// 문서 임베딩 스크립트
require('dotenv').config();
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');

class DocumentEmbedder {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        this.config = {
            embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
            chunkSize: parseInt(process.env.CHUNK_SIZE) || 1000,
            chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 200,
            batchSize: parseInt(process.env.BATCH_SIZE) || 10
        };

        this.statusFile = path.join(__dirname, '../embedding-status.json');
        this.logFile = path.join(__dirname, '../logs/embedding.log');
    }

    async initialize() {
        // 로그 디렉토리 생성
        await fs.ensureDir(path.dirname(this.logFile));
        
        // 임베딩 작업 시작 로그
        await this.updateStatus('initializing', 0, 0, '임베딩 작업을 시작합니다...');
        this.log('🚀 임베딩 작업 시작');
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }

    async updateStatus(status, total, processed, message = '') {
        const statusData = {
            status,
            total,
            processed,
            progress: total > 0 ? Math.round((processed / total) * 100) : 0,
            message,
            timestamp: new Date().toISOString()
        };

        await fs.writeFile(this.statusFile, JSON.stringify(statusData, null, 2));
    }

    // 텍스트를 청크로 분할
    splitTextIntoChunks(text, maxLength = 1000, overlap = 200) {
        const chunks = [];
        let start = 0;

        while (start < text.length) {
            let end = start + maxLength;
            
            // 마지막 청크가 아니면 단어 경계에서 자르기
            if (end < text.length) {
                const lastSpace = text.lastIndexOf(' ', end);
                if (lastSpace > start + maxLength * 0.8) {
                    end = lastSpace;
                }
            }

            const chunk = text.slice(start, end).trim();
            if (chunk.length > 0) {
                chunks.push(chunk);
            }

            start = Math.max(start + 1, end - overlap);
        }

        return chunks;
    }

    // 시간표 데이터 처리
    async processTimetableData() {
        this.log('📊 시간표 데이터 처리 중...');
        const filePath = path.join(__dirname, '../data/timetable.txt');
        const documents = [];

        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    // CSV 행을 텍스트로 변환
                    const content = `과목 정보:
종류: ${row.Kind}
과목코드: ${row.code}
학점: ${row.score}
과목명: ${row.name}
교수: ${row.professor}
요일: ${row.week}
시작시간: ${row.start_time}
종료시간: ${row.end_time}`;

                    documents.push({
                        content,
                        source_type: 'timetable',
                        source_file: 'timetable.txt',
                        metadata: {
                            subject_code: row.code,
                            subject_name: row.name,
                            professor: row.professor,
                            day: row.week,
                            start_time: row.start_time,
                            end_time: row.end_time,
                            credits: row.score,
                            type: row.Kind
                        }
                    });
                })
                .on('end', () => {
                    this.log(`✅ 시간표 데이터 ${documents.length}개 로드 완료`);
                    resolve(documents);
                })
                .on('error', reject);
        });
    }

    // 수강신청 안내 데이터 처리
    async processAnnouncementData() {
        this.log('📋 수강신청 안내 데이터 처리 중...');
        const filePath = path.join(__dirname, '../data/종합강의 시간표 안내.txt');
        const content = await fs.readFile(filePath, 'utf8');
        
        // 섹션별로 분할
        const sections = content.split(/\n(?=\d+\.|▣|Ⅰ\.|Ⅱ\.)/);
        const documents = [];

        sections.forEach((section, index) => {
            const cleanSection = section.trim();
            if (cleanSection.length > 100) { // 너무 짧은 섹션 제외
                const chunks = this.splitTextIntoChunks(cleanSection, this.config.chunkSize, this.config.chunkOverlap);
                
                chunks.forEach((chunk, chunkIndex) => {
                    documents.push({
                        content: chunk,
                        source_type: 'announcement',
                        source_file: '종합강의 시간표 안내.txt',
                        metadata: {
                            section_index: index,
                            chunk_index: chunkIndex,
                            total_chunks: chunks.length
                        }
                    });
                });
            }
        });

        this.log(`✅ 수강신청 안내 데이터 ${documents.length}개 청크 생성 완료`);
        return documents;
    }

    // 임베딩 생성
    async createEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: this.config.embeddingModel,
                input: text,
                encoding_format: "float",
            });

            return response.data[0].embedding;
        } catch (error) {
            this.log(`❌ 임베딩 생성 실패: ${error.message}`);
            throw error;
        }
    }

    // 배치 임베딩 처리
    async processBatch(documents, startIndex = 0) {
        const batchSize = this.config.batchSize;
        let processed = startIndex;

        for (let i = startIndex; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);
            
            this.log(`📦 배치 처리 중: ${i + 1}-${Math.min(i + batchSize, documents.length)}/${documents.length}`);

            for (const doc of batch) {
                try {
                    // 임베딩 생성
                    const embedding = await this.createEmbedding(doc.content);
                    
                    // Supabase에 저장
                    const { error } = await this.supabase
                        .from('documents')
                        .insert({
                            content: doc.content,
                            embedding: embedding,
                            source_type: doc.source_type,
                            source_file: doc.source_file,
                            metadata: doc.metadata
                        });

                    if (error) {
                        throw error;
                    }

                    processed++;
                    await this.updateStatus('running', documents.length, processed, 
                        `문서 ${processed}/${documents.length} 처리 완료`);

                    // API 율제한 방지를 위한 딜레이
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    this.log(`❌ 문서 처리 실패 (${processed + 1}): ${error.message}`);
                    await this.updateStatus('error', documents.length, processed, error.message);
                    throw error;
                }
            }

            // 배치 간 딜레이
            if (i + batchSize < documents.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return processed;
    }

    // 메인 실행 함수
    async run() {
        try {
            await this.initialize();

            // 기존 데이터 삭제 확인
            this.log('🗑️  기존 데이터 삭제 중...');
            await this.supabase.from('documents').delete().neq('id', 0);

            // 문서 수집
            this.log('📚 문서 데이터 수집 중...');
            const timetableDocuments = await this.processTimetableData();
            const announcementDocuments = await this.processAnnouncementData();
            const allDocuments = [...timetableDocuments, ...announcementDocuments];

            this.log(`🎯 총 ${allDocuments.length}개 문서를 임베딩합니다.`);

            // 임베딩 처리
            await this.updateStatus('running', allDocuments.length, 0, '임베딩 생성 시작...');
            await this.processBatch(allDocuments);

            // 완료
            await this.updateStatus('completed', allDocuments.length, allDocuments.length, '임베딩 작업 완료!');
            this.log('🎉 모든 임베딩 작업이 완료되었습니다!');

        } catch (error) {
            this.log(`💥 임베딩 작업 실패: ${error.message}`);
            await this.updateStatus('failed', 0, 0, error.message);
            process.exit(1);
        }
    }
}

// 스크립트 직접 실행
if (require.main === module) {
    const embedder = new DocumentEmbedder();
    embedder.run().catch(console.error);
}

module.exports = DocumentEmbedder;