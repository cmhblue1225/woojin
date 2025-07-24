// 부분 데이터 갱신 스크립트
require('dotenv').config();
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');

class PartialDataUpdater {
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

        this.backupFile = path.join(__dirname, `../backups/backup-${Date.now()}.json`);
        this.logFile = path.join(__dirname, '../logs/partial-update.log');
    }

    async initialize() {
        // 필요한 디렉토리 생성
        await fs.ensureDir(path.dirname(this.backupFile));
        await fs.ensureDir(path.dirname(this.logFile));
        
        this.log('🔄 부분 데이터 갱신 시작');
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }

    // 텍스트를 청크로 분할 (기존 로직과 동일)
    splitTextIntoChunks(text, maxLength = 1000, overlap = 200) {
        const chunks = [];
        let start = 0;

        while (start < text.length) {
            let end = start + maxLength;
            
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

    // 기존 데이터 백업
    async backupExistingData(sourceType, sourceFile) {
        this.log(`💾 기존 데이터 백업 중: ${sourceType || sourceFile}`);
        
        let query = this.supabase.from('documents').select('*');
        
        if (sourceType) {
            query = query.eq('source_type', sourceType);
        }
        if (sourceFile) {
            query = query.eq('source_file', sourceFile);
        }

        const { data, error } = await query;
        
        if (error) {
            throw new Error(`백업 실패: ${error.message}`);
        }

        const backupData = {
            timestamp: new Date().toISOString(),
            sourceType,
            sourceFile,
            data: data || [],
            count: data?.length || 0
        };

        await fs.writeFile(this.backupFile, JSON.stringify(backupData, null, 2));
        this.log(`✅ ${backupData.count}개 데이터 백업 완료: ${this.backupFile}`);
        
        return backupData;
    }

    // 기존 데이터 삭제
    async deleteExistingData(sourceType, sourceFile) {
        this.log(`🗑️ 기존 데이터 삭제 중: ${sourceType || sourceFile}`);
        
        let query = this.supabase.from('documents').delete();
        
        if (sourceType) {
            query = query.eq('source_type', sourceType);
        }
        if (sourceFile) {
            query = query.eq('source_file', sourceFile);
        }

        const { error } = await query;
        
        if (error) {
            throw new Error(`삭제 실패: ${error.message}`);
        }

        this.log('✅ 기존 데이터 삭제 완료');
    }

    // 롤백 기능
    async rollback() {
        this.log('⏪ 데이터 롤백 시작');
        
        if (!await fs.pathExists(this.backupFile)) {
            throw new Error('백업 파일이 존재하지 않습니다');
        }

        const backupData = await fs.readJson(this.backupFile);
        
        if (backupData.data.length === 0) {
            this.log('롤백할 데이터가 없습니다');
            return;
        }

        // 현재 데이터 삭제
        await this.deleteExistingData(backupData.sourceType, backupData.sourceFile);

        // 백업 데이터 복원
        for (const doc of backupData.data) {
            const { id, created_at, ...docData } = doc; // ID와 생성일시 제외
            
            const { error } = await this.supabase
                .from('documents')
                .insert(docData);

            if (error) {
                throw new Error(`롤백 실패: ${error.message}`);
            }
        }

        this.log(`✅ ${backupData.data.length}개 데이터 롤백 완료`);
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

    // 시간표 데이터 처리
    async processTimetableData() {
        this.log('📊 시간표 데이터 처리 중...');
        const filePath = path.join(__dirname, '../data/timetable.txt');
        const documents = [];

        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
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
        
        const sections = content.split(/\n(?=\d+\.|▣|Ⅰ\.|Ⅱ\.)/);
        const documents = [];

        sections.forEach((section, index) => {
            const cleanSection = section.trim();
            if (cleanSection.length > 100) {
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

    // 특정 파일 데이터 처리
    async processFileData(fileName) {
        this.log(`📄 파일 데이터 처리 중: ${fileName}`);
        
        if (fileName === 'timetable.txt') {
            return await this.processTimetableData();
        } else if (fileName === '종합강의 시간표 안내.txt') {
            return await this.processAnnouncementData();
        } else {
            throw new Error(`지원하지 않는 파일: ${fileName}`);
        }
    }

    // 문서 배치 처리 및 임베딩
    async processBatch(documents) {
        const batchSize = this.config.batchSize;
        let processed = 0;

        for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);
            
            this.log(`📦 배치 처리 중: ${i + 1}-${Math.min(i + batchSize, documents.length)}/${documents.length}`);

            for (const doc of batch) {
                try {
                    const embedding = await this.createEmbedding(doc.content);
                    
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
                    this.log(`✅ 문서 ${processed}/${documents.length} 처리 완료`);

                    // API 율제한 방지
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    this.log(`❌ 문서 처리 실패: ${error.message}`);
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

    // 타입별 갱신
    async updateByType(sourceType) {
        try {
            await this.initialize();

            // 백업
            const backupData = await this.backupExistingData(sourceType, null);
            
            if (backupData.count === 0) {
                this.log(`⚠️ 갱신할 ${sourceType} 데이터가 없습니다`);
                return;
            }

            // 새 데이터 로드
            let documents = [];
            if (sourceType === 'timetable') {
                documents = await this.processTimetableData();
            } else if (sourceType === 'announcement') {
                documents = await this.processAnnouncementData();
            } else {
                throw new Error(`지원하지 않는 타입: ${sourceType}`);
            }

            // 기존 데이터 삭제
            await this.deleteExistingData(sourceType, null);

            // 새 데이터 처리
            const processed = await this.processBatch(documents);

            this.log(`🎉 ${sourceType} 데이터 갱신 완료: ${processed}개 문서`);

        } catch (error) {
            this.log(`💥 갱신 실패: ${error.message}`);
            this.log('롤백을 시도합니다...');
            
            try {
                await this.rollback();
                this.log('✅ 롤백 완료');
            } catch (rollbackError) {
                this.log(`❌ 롤백 실패: ${rollbackError.message}`);
            }
            
            throw error;
        }
    }

    // 파일별 갱신
    async updateByFile(fileName) {
        try {
            await this.initialize();

            // 백업
            const backupData = await this.backupExistingData(null, fileName);
            
            if (backupData.count === 0) {
                this.log(`⚠️ 갱신할 ${fileName} 데이터가 없습니다`);
                return;
            }

            // 새 데이터 로드
            const documents = await this.processFileData(fileName);

            // 기존 데이터 삭제
            await this.deleteExistingData(null, fileName);

            // 새 데이터 처리
            const processed = await this.processBatch(documents);

            this.log(`🎉 ${fileName} 데이터 갱신 완료: ${processed}개 문서`);

        } catch (error) {
            this.log(`💥 갱신 실패: ${error.message}`);
            this.log('롤백을 시도합니다...');
            
            try {
                await this.rollback();
                this.log('✅ 롤백 완료');
            } catch (rollbackError) {
                this.log(`❌ 롤백 실패: ${rollbackError.message}`);
            }
            
            throw error;
        }
    }
}

// CLI 인터페이스
async function main() {
    const args = process.argv.slice(2);
    const updater = new PartialDataUpdater();

    try {
        if (args.includes('--type=timetable')) {
            await updater.updateByType('timetable');
        } else if (args.includes('--type=announcement')) {
            await updater.updateByType('announcement');
        } else if (args.find(arg => arg.startsWith('--file='))) {
            const fileName = args.find(arg => arg.startsWith('--file=')).split('=')[1];
            await updater.updateByFile(fileName);
        } else {
            console.log(`
사용법:
  node scripts/partial-update.js --type=timetable     # 시간표 데이터만 갱신
  node scripts/partial-update.js --type=announcement # 수강신청 안내만 갱신
  node scripts/partial-update.js --file=timetable.txt # 특정 파일만 갱신

지원 파일:
  - timetable.txt
  - 종합강의 시간표 안내.txt
            `);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 갱신 실패:', error.message);
        process.exit(1);
    }
}

// 스크립트 직접 실행
if (require.main === module) {
    main();
}

module.exports = PartialDataUpdater;