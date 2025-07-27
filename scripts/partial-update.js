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

    // 시간표 데이터 처리 (개선된 그룹화 임베딩)
    async processTimetableData() {
        this.log('📊 시간표 데이터 처리 중...');
        const filePath = path.join(__dirname, '../data/timetable.txt');
        const rawData = [];
        const documents = [];

        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    rawData.push(row);
                })
                .on('end', () => {
                    this.log(`📄 원본 데이터 ${rawData.length}개 로드 완료`);
                    
                    // 1. 개별 수업 정보 (기존 방식 개선)
                    rawData.forEach(row => {
                        const timeText = this.formatTime(row.start_time, row.end_time);
                        const dayText = this.formatDay(row.week);
                        const typeText = this.formatSubjectType(row.Kind);
                        
                        const content = `${row.professor} 교수님이 담당하시는 "${row.name}" 강의 정보입니다. 
이 수업은 ${typeText}이며 ${row.score}학점입니다. 
과목코드는 ${row.code}이고, ${dayText} ${timeText}에 진행됩니다.
수강 시간: ${row.week}요일 ${row.start_time} - ${row.end_time}`;

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
                                type: row.Kind,
                                embedding_type: 'individual'
                            }
                        });
                    });

                    // 2. 교수별 그룹화
                    const professorGroups = this.groupByProfessor(rawData);
                    Object.entries(professorGroups).forEach(([professor, classes]) => {
                        const content = this.createProfessorSummary(professor, classes);
                        documents.push({
                            content,
                            source_type: 'timetable',
                            source_file: 'timetable.txt',
                            metadata: {
                                professor,
                                class_count: classes.length,
                                embedding_type: 'professor_group'
                            }
                        });
                    });

                    // 3. 과목별 그룹화
                    const subjectGroups = this.groupBySubject(rawData);
                    Object.entries(subjectGroups).forEach(([subject, classes]) => {
                        if (classes.length > 1) { // 여러 분반이 있는 과목만
                            const content = this.createSubjectSummary(subject, classes);
                            documents.push({
                                content,
                                source_type: 'timetable',
                                source_file: 'timetable.txt',
                                metadata: {
                                    subject_name: subject,
                                    section_count: classes.length,
                                    embedding_type: 'subject_group'
                                }
                            });
                        }
                    });

                    // 4. 시간대별 그룹화
                    const timeGroups = this.groupByTimeSlot(rawData);
                    Object.entries(timeGroups).forEach(([timeSlot, classes]) => {
                        if (classes.length > 3) { // 3개 이상 수업이 있는 시간대만
                            const content = this.createTimeSlotSummary(timeSlot, classes);
                            documents.push({
                                content,
                                source_type: 'timetable',
                                source_file: 'timetable.txt',
                                metadata: {
                                    time_slot: timeSlot,
                                    class_count: classes.length,
                                    embedding_type: 'time_group'
                                }
                            });
                        }
                    });

                    this.log(`✅ 시간표 데이터 처리 완료: 총 ${documents.length}개 문서 생성`);
                    this.log(`   - 개별 수업: ${rawData.length}개`);
                    this.log(`   - 교수별 그룹: ${Object.keys(professorGroups).length}개`);
                    this.log(`   - 과목별 그룹: ${Object.keys(subjectGroups).filter(([,classes]) => classes.length > 1).length}개`);
                    this.log(`   - 시간대별 그룹: ${Object.keys(timeGroups).filter(([,classes]) => classes.length > 3).length}개`);
                    
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

    // 시간 포맷팅 헬퍼 (오류 방지 개선)
    formatTime(startTime, endTime) {
        const formatHour = (time) => {
            if (!time || typeof time !== 'string') return '시간 미정';
            
            const parts = time.split(':');
            if (parts.length < 2) return time;
            
            const [hour, minute] = parts;
            const h = parseInt(hour);
            if (isNaN(h)) return time;
            
            const period = h < 12 ? '오전' : '오후';
            const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
            return `${period} ${displayHour}시${minute === '00' ? '' : ` ${minute}분`}`;
        };
        
        if (!startTime || !endTime) {
            return '시간 미정';
        }
        
        return `${formatHour(startTime)}부터 ${formatHour(endTime)}까지`;
    }

    // 요일 포맷팅 헬퍼
    formatDay(day) {
        const dayMap = {
            '월': '월요일',
            '화': '화요일', 
            '수': '수요일',
            '목': '목요일',
            '금': '금요일',
            '토': '토요일',
            '일': '일요일'
        };
        return dayMap[day] || day + '요일';
    }

    // 과목 종류 포맷팅 헬퍼
    formatSubjectType(type) {
        const typeMap = {
            '교필': '교양필수 과목',
            '교선': '교양선택 과목',
            '전기': '전공기초 과목',
            '전필': '전공필수 과목',
            '전선': '전공선택 과목',
            '일선': '일반선택 과목',
            '복전': '복수전공 과목',
            '부전': '부전공 과목',
            '마전': '마이크로전공 과목'
        };
        return typeMap[type] || type;
    }

    // 교수별 그룹화
    groupByProfessor(data) {
        const groups = {};
        data.forEach(row => {
            if (!groups[row.professor]) {
                groups[row.professor] = [];
            }
            groups[row.professor].push(row);
        });
        return groups;
    }

    // 과목별 그룹화 
    groupBySubject(data) {
        const groups = {};
        data.forEach(row => {
            if (!groups[row.name]) {
                groups[row.name] = [];
            }
            groups[row.name].push(row);
        });
        return groups;
    }

    // 시간대별 그룹화
    groupByTimeSlot(data) {
        const groups = {};
        data.forEach(row => {
            const timeSlot = `${row.week}_${row.start_time}`;
            if (!groups[timeSlot]) {
                groups[timeSlot] = [];
            }
            groups[timeSlot].push(row);
        });
        return groups;
    }

    // 교수별 요약 생성
    createProfessorSummary(professor, classes) {
        const subjects = [...new Set(classes.map(c => c.name))];
        const schedules = classes.map(c => `${this.formatDay(c.week)} ${this.formatTime(c.start_time, c.end_time)}`);
        const types = [...new Set(classes.map(c => this.formatSubjectType(c.Kind)))];
        
        return `${professor} 교수님이 담당하시는 강의 목록입니다.

담당 과목: ${subjects.join(', ')}
총 ${classes.length}개 분반을 담당하고 계십니다.
과목 유형: ${types.join(', ')}

세부 시간표:
${classes.map(c => `- ${c.name} (${c.code}): ${this.formatDay(c.week)} ${this.formatTime(c.start_time, c.end_time)}, ${c.score}학점`).join('\n')}

${professor} 교수님의 수업을 듣고 싶으시면 위 시간표를 참고하세요.`;
    }

    // 과목별 요약 생성
    createSubjectSummary(subject, classes) {
        const professors = [...new Set(classes.map(c => c.professor))];
        const schedules = classes.map(c => `${c.professor} 교수님 - ${this.formatDay(c.week)} ${this.formatTime(c.start_time, c.end_time)}`);
        const credits = classes[0].score;
        const type = this.formatSubjectType(classes[0].Kind);
        
        return `"${subject}" 과목의 분반 정보입니다.

이 과목은 ${type}이며 ${credits}학점입니다.
총 ${classes.length}개 분반이 개설되어 있습니다.
담당 교수: ${professors.join(', ')}

분반별 시간표:
${classes.map(c => `- ${c.code}: ${c.professor} 교수님, ${this.formatDay(c.week)} ${this.formatTime(c.start_time, c.end_time)}`).join('\n')}

${subject} 수업을 수강하고 싶으시면 원하는 시간대의 분반을 선택하세요.`;
    }

    // 시간대별 요약 생성
    createTimeSlotSummary(timeSlot, classes) {
        const [day, time] = timeSlot.split('_');
        const dayText = this.formatDay(day);
        const timeText = this.formatTime(time, classes[0].end_time);
        const subjects = classes.map(c => `${c.name} (${c.professor} 교수님)`);
        
        return `${dayText} ${timeText} 시간대에 개설된 강의 목록입니다.

이 시간에는 총 ${classes.length}개의 강의가 진행됩니다:
${subjects.map((subject, index) => `${index + 1}. ${subject}`).join('\n')}

${dayText} ${timeText}에 수업이 있는지 확인하고 싶으시면 위 목록을 참고하세요.
시간표 중복을 피하려면 이 시간대의 다른 강의들을 확인해보세요.`;
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