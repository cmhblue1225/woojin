# 🎓 대진대학교 우진봇 - RAG 기반 AI 챗봇

> **최종 업데이트**: 2025.07.28 - 대규모 크롤링 데이터 통합 완성 🎉

대진대학교 학생들을 위한 RAG(Retrieval-Augmented Generation) 기반 AI 챗봇입니다. 수강신청, 시간표, 학사정보부터 **대진대학교 전체 홈페이지 정보**까지 포괄하는 종합 정보 서비스입니다.

## 🚀 주요 기능

- **🤖 지능형 챗봇**: Claude 3.5 Sonnet 기반 자연스러운 한국어 대화
- **📚 대규모 RAG 시스템**: OpenAI text-embedding-3-small + Supabase pgvector
- **🌐 완전통합 대학정보**: **10,746개 문서** 기반 포괄적 답변 (26,000개 크롤링 파일 중 5,877개 웹사이트 문서 통합)
- **⚡ 실시간 응답**: 벡터 검색 임계값 최적화 (0.1)로 정확한 답변
- **📱 완전 반응형 UI**: Material-UI + Glassmorphism 디자인
- **🎯 도메인별 검색**: 학과, 부서, 시설별 특화 검색
- **🔍 컨텍스트 표시**: 답변 출처 문서 및 검색 점수 표시

## 🛠️ 기술 스택

### 백엔드
- **Node.js + Express**: API 서버
- **Supabase**: PostgreSQL + pgvector 벡터 데이터베이스
- **OpenAI API**: 텍스트 임베딩 생성
- **Claude API**: 대화형 응답 생성

### 프론트엔드
- **React + TypeScript**: 사용자 인터페이스
- **Material-UI**: 디자인 시스템
- **Axios**: HTTP 클라이언트

### 배포
- **Render.com**: 풀스택 애플리케이션 배포
- **Environment Variables**: 보안 정보 관리

## 📁 프로젝트 구조

```
우진봇/
├── 🎨 client/                           # React 프론트엔드
│   ├── src/
│   │   ├── components/                  # React 컴포넌트
│   │   │   ├── ChatInterface.tsx        # 메인 채팅 인터페이스
│   │   │   ├── ChatMessage.tsx          # 카카오톡 스타일 말풍선
│   │   │   └── QuickActions.tsx         # 빠른 질문 버튼
│   │   ├── App.tsx                      # 메인 앱 컴포넌트
│   │   └── App.css                      # 글래스모피즘 스타일
│   ├── package.json
│   └── public/
├── 🛠️ scripts/                         # 데이터 처리 스크립트
│   ├── domain-embedding.js              # 도메인별 임베딩 (신규)
│   ├── selective-recrawl.js             # 선택적 재크롤링 (신규)
│   ├── analyze-domains.js               # 도메인 분석 (신규)
│   ├── embed-documents.js               # 기존 문서 임베딩
│   ├── partial-update.js                # 부분 데이터 갱신
│   ├── check-embedding.js               # 임베딩 상태 확인
│   ├── schema.sql                       # 데이터베이스 스키마
│   └── setup-database.js                # DB 초기화
├── 📊 data/                            # 원본 학습 데이터
│   ├── timetable.txt                    # 시간표 데이터 (교수별)
│   └── 종합강의 시간표 안내.txt          # 수강신청 안내
├── 🕷️ crawlingTest/                    # 홈페이지 크롤링
│   ├── enhanced_output/                 # 크롤링 결과 (5,118페이지)
│   │   ├── page_0.txt ~ page_5117.txt   # 대진대 전체 홈페이지
│   │   └── analysis.json                # 도메인별 분석 결과
│   └── crawler.py                       # Python 크롤링 스크립트
├── 📝 logs/                            # 상세 로깅
│   ├── domain-embedding.log             # 도메인별 임베딩 로그
│   ├── domain-embedding-status.json     # 실시간 진행 상태
│   ├── selective-recrawl.log            # 재크롤링 로그
│   └── embedding.log                    # 기존 임베딩 로그
├── 💾 backups/                         # 자동 백업
├── 🖥️ server.js                        # Express 백엔드 서버
├── package.json
├── .env.example                         # 환경변수 예시
└── README.md
```

## 🔧 설치 및 설정

### 1. 환경변수 설정

`.env` 파일을 생성하고 다음 환경변수들을 설정하세요:

```bash
# API Keys
CLAUDE_API_KEY=your_claude_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 2. 의존성 설치

```bash
# 루트 디렉토리에서
npm run install-all
```

### 3. 데이터베이스 설정

1. Supabase 프로젝트 생성
2. SQL Editor에서 `scripts/schema.sql` 실행
3. pgvector 확장 활성화 확인

### 4. 문서 임베딩

#### 🆕 도메인별 임베딩 (권장)
```bash
# 전체 도메인 임베딩 (28개 도메인, 6,976개 문서)
node scripts/domain-embedding.js

# 특정 도메인만 임베딩
node scripts/domain-embedding.js www.daejin.ac.kr

# 품질 분석 및 재처리
node scripts/selective-recrawl.js --analyze
node scripts/selective-recrawl.js
```

#### 기존 임베딩 시스템
```bash
# 기존 문서 임베딩 (시간표 + 수강신청 안내)
npm run embed

# 부분 갱신 (효율적)
npm run update-timetable
npm run update-announcement

# 상태 확인
npm run check-embedding
npm run watch-embedding
```

### 5. 개발 서버 실행

```bash
# 프론트엔드와 백엔드 동시 실행
npm run dev

# 또는 개별 실행
npm run server  # 백엔드만
npm run client  # 프론트엔드만
```

## 📊 사용 가능한 명령어

### 개발 및 배포
```bash
npm run dev              # 풀스택 개발 서버 실행
npm run build           # 프로덕션 빌드
npm run start           # 프로덕션 서버 실행
npm run server          # 백엔드만 실행
npm run client          # 프론트엔드만 실행
npm run install-all     # 모든 의존성 설치
```

### 🆕 도메인별 데이터 관리
```bash
# 도메인 분석
node scripts/analyze-domains.js              # 크롤링 데이터 분석
node scripts/selective-recrawl.js --analyze  # 품질 분석

# 도메인별 임베딩
node scripts/domain-embedding.js                    # 전체 도메인
node scripts/domain-embedding.js www.daejin.ac.kr   # 특정 도메인

# 선택적 재처리
node scripts/selective-recrawl.js                   # 자동 품질 기반 재처리
node scripts/selective-recrawl.js law.daejin.ac.kr  # 특정 도메인 재처리
```

### 기존 데이터 관리
```bash
npm run embed           # 기존 문서 임베딩 (시간표, 수강신청)
npm run update-timetable    # 시간표만 갱신
npm run update-announcement # 수강신청 안내만 갱신
npm run check-embedding     # 임베딩 상태 확인
npm run watch-embedding     # 실시간 모니터링
npm run embedding-logs      # 임베딩 로그 확인
npm run setup-db           # 데이터베이스 설정
```

## 🚀 Render.com 배포

### 1. GitHub 연동
1. 프로젝트를 GitHub에 푸시
2. Render.com에서 새 Web Service 생성
3. GitHub 리포지토리 연결

### 2. 빌드 설정
- **Build Command**: `npm run install-all && npm run build`
- **Start Command**: `npm start`
- **Node Version**: 18+

### 3. 환경변수 설정
Render.com 대시보드에서 다음 환경변수들을 추가:

```bash
CLAUDE_API_KEY
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
NODE_ENV=production
PORT=10000
```

### 4. 도메인 설정
- 자동 생성된 도메인 사용 또는 커스텀 도메인 연결

## 📚 API 엔드포인트

### GET /api/health
서버 상태 확인

### POST /api/chat
```json
{
  "message": "수강신청 일정이 언제야?",
  "sessionId": "optional-session-id"
}
```

### POST /api/search
문서 검색 (개발용)

### GET /api/stats
시스템 통계

## 🔍 사용법

1. **웹사이트 접속**: 배포된 URL로 접속
2. **질문 입력**: 수강신청, 시간표 등에 대해 질문
3. **빠른 액션**: 미리 준비된 질문 버튼 클릭
4. **답변 확인**: AI가 관련 문서를 기반으로 답변 생성

### 예시 질문들

#### 📚 학사정보
- "수강신청 일정이 언제야?"
- "교양필수 과목이 뭐가 있어?"
- "수강신청 학점 제한이 얼마야?"
- "재수강은 어떻게 해?"

#### 👨‍🏫 교수/시간표 정보
- "박정규 교수님이 담당하시는 강좌는?"
- "컴퓨터공학과 전공필수 시간표 알려줘"
- "김영호 교수님 연구실이 어디야?"

#### 🏛️ 학과/부서 정보
- "영화영상학과에서는 뭘 배워?"
- "전자도서관 이용 방법 알려줘"
- "기숙사 신청은 어떻게 해?"
- "법과대학 커리큘럼이 궁금해"

#### 🎯 캠퍼스/시설 정보
- "학생식당 메뉴가 뭐야?"
- "도서관 운영시간은?"
- "주차장 위치 알려줘"

## 🔄 데이터 업데이트

### 🆕 홈페이지 크롤링 데이터 추가 (권장)
```bash
# 1. 새로운 도메인/페이지 크롤링 (Python)
cd crawlingTest
python crawler.py

# 2. 새 도메인 분석
node scripts/analyze-domains.js

# 3. 새 도메인만 임베딩
node scripts/domain-embedding.js [새도메인명]

# 4. 품질 확인 및 재처리
node scripts/selective-recrawl.js --analyze
```

### 기존 데이터 업데이트
```bash
# 시간표 데이터 업데이트
npm run update-timetable

# 수강신청 안내 업데이트  
npm run update-announcement

# 전체 재임베딩
npm run embed
```

### 📊 현재 데이터 현황 (2025.07.28 - 대규모 통합 완료!)
- **총 문서**: **10,746개** 📈 (+46% 증가)
- **크롤링 페이지**: 26,026개 파일 (4개 디렉토리)
- **통합 완료**: 5,877개 웹사이트 문서
- **데이터 소스**:
  - `timetable`: 교수별 강의 정보 (4,815개)
  - `website`: 대진대 전체 홈페이지 (5,877개)
    - `enhanced_strategic_output`: 3,444개 문서 (최고품질)
    - `enhanced_output`: 2,433개 문서
  - **통합률**: 22.6% (5,877/26,026)

## 🛡️ 보안 고려사항

- API 키는 환경변수로만 관리
- Supabase RLS(Row Level Security) 적용
- CORS 설정으로 도메인 제한
- 입력 검증 및 에러 핸들링

## 🔧 문제 해결

### 🆕 도메인별 임베딩 문제
```bash
# 도메인 분석 및 상태 확인
node scripts/selective-recrawl.js --analyze
tail -f logs/domain-embedding.log

# 특정 도메인 재처리
node scripts/selective-recrawl.js [문제도메인명]

# 진행 상태 확인
cat logs/domain-embedding-status.json
```

### 임베딩 실패 시
```bash
npm run embedding-logs  # 기존 임베딩 로그
tail -f logs/domain-embedding.log  # 도메인별 임베딩 로그
npm run check-embedding # 상태 확인
```

### 검색 품질 문제
```bash
# 벡터 검색 임계값 확인 (현재: 0.1)
# server.js의 similarity_threshold 값 조정 고려

# 도메인별 문서 품질 분석
node scripts/selective-recrawl.js --analyze
```

### 서버 연결 오류 시
1. 환경변수 확인 (.env 파일)
2. Supabase 연결 상태 확인
3. API 키 유효성 검증 (OpenAI, Claude)
4. PostgreSQL pgvector 확장 활성화 확인

### 빌드 오류 시
```bash
npm run install-all     # 의존성 재설치
rm -rf node_modules client/node_modules  # 캐시 정리
npm cache clean --force
```

## 📈 향후 개발 계획

### ✅ 완료된 주요 업데이트 (2025.07.28)
- [x] **🎉 대규모 크롤링 데이터 통합** (26,026개 파일 → 5,877개 문서 통합)
- [x] **대진대학교 전체 홈페이지 크롤링** (5,118페이지, 28개 도메인)
- [x] **배치 임베딩 시스템** 구축 (대용량 처리 최적화)
- [x] **벡터 검색 품질 최적화** (임계값 0.1)
- [x] **카카오톡 스타일 UI 완성** (말풍선, 글래스모피즘)
- [x] **부분 데이터 갱신 시스템** (30-80% 비용 절약)
- [x] **통합 상태 모니터링** 시스템

### 🔄 진행 중
- [ ] **도메인별 검색 최적화**: 학과/부서별 특화 검색
- [ ] **실시간 공지사항 연동**: 대학 공식 공지사항 API

### 📋 계획 중
- [ ] **음성 입력/출력 기능**: 모바일 음성 인터페이스
- [ ] **관리자 대시보드**: 임베딩 상태, 사용 통계, 품질 관리
- [ ] **다국어 지원**: 영어/중국어 (외국인 학생 지원)
- [ ] **고급 분석 기능**:
  - 사용자 질문 패턴 분석
  - 답변 품질 피드백 시스템
  - 자동 데이터 품질 개선
- [ ] **확장 기능**:
  - 학사일정 API 연동
  - 도서관 좌석 현황
  - 학식 메뉴 실시간 업데이트

## 📞 지원 및 기여

문제나 제안사항이 있으시면 다음으로 연락해주세요:
- **GitHub Issues**: [리포지토리 URL]/issues
- **이메일**: [연락처]

### 🔄 프로젝트 재시작 가이드
다음 세션에서 작업을 계속하려면:
```bash
# 우진봇 프로젝트 재시작
cd /Users/minhyuk/Desktop/우진봇

# 현재 상태 확인
node scripts/selective-recrawl.js --analyze
cat logs/domain-embedding-status.json

# 새 크롤링/임베딩 작업 시작
node scripts/domain-embedding.js [도메인명]
```

### 🎯 핵심 시스템 아키텍처
- **크롤링**: Python (crawlingTest/) → 5,118페이지
- **임베딩**: Node.js (scripts/) → 6,976개 문서  
- **검색**: Supabase pgvector + OpenAI embedding
- **답변**: Claude 3.5 Sonnet
- **프론트엔드**: React + Material-UI

---

🎓 **대진대학교 학생들을 위한 차세대 AI 챗봇 - 우진봇 v2.0**
> *2025.07.28 도메인별 임베딩 시스템 완성*