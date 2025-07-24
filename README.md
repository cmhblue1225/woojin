# 🎓 대진대학교 RAG 챗봇

대진대학교 학생들을 위한 RAG(Retrieval-Augmented Generation) 기반 AI 챗봇입니다. 수강신청, 시간표, 학사정보 등에 대한 질문에 실시간으로 답변합니다.

## 🚀 주요 기능

- **🤖 지능형 챗봇**: Claude API 기반 자연스러운 한국어 대화
- **📚 RAG 시스템**: OpenAI 임베딩 + Supabase 벡터 검색
- **⚡ 실시간 응답**: 관련 문서 검색 후 정확한 답변 생성
- **📱 반응형 UI**: Material-UI 기반 모바일 친화적 인터페이스
- **🔍 컨텍스트 표시**: 답변 생성에 사용된 문서 출처 표시

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
├── client/                 # React 프론트엔드
│   ├── src/
│   │   ├── components/    # React 컴포넌트
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   └── QuickActions.tsx
│   │   ├── App.tsx
│   │   └── App.css
│   ├── package.json
│   └── public/
├── scripts/               # 유틸리티 스크립트
│   ├── embed-documents.js # 문서 임베딩 스크립트
│   ├── check-embedding.js # 임베딩 상태 확인
│   ├── schema.sql         # 데이터베이스 스키마
│   └── setup-database.js  # DB 초기화
├── data/                  # 학습 데이터
│   ├── timetable.txt      # 시간표 데이터
│   └── 종합강의 시간표 안내.txt
├── logs/                  # 로그 파일
├── server.js             # Express 서버
├── package.json
├── .env.example          # 환경변수 예시
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

```bash
# 문서를 벡터 데이터베이스에 임베딩
npm run embed

# 임베딩 상태 확인
npm run check-embedding

# 실시간 모니터링
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

```bash
npm run dev              # 개발 서버 실행
npm run build           # 프로덕션 빌드
npm run start           # 프로덕션 서버 실행
npm run embed           # 문서 임베딩 실행
npm run check-embedding # 임베딩 상태 확인
npm run watch-embedding # 실시간 임베딩 모니터링
npm run embedding-logs  # 임베딩 로그 확인
npm run setup-db       # 데이터베이스 설정
npm run install-all    # 모든 의존성 설치
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
- "수강신청 일정이 언제야?"
- "교양필수 과목이 뭐가 있어?"
- "컴퓨터공학과 전공필수 시간표 알려줘"
- "수강신청 학점 제한이 얼마야?"
- "재수강은 어떻게 해?"

## 🔄 데이터 업데이트

새로운 학습 데이터를 추가하려면:

1. `data/` 폴더에 새 파일 추가
2. `scripts/embed-documents.js`에서 데이터 처리 로직 추가
3. `npm run embed` 실행하여 재임베딩
4. 서버 재시작

## 🛡️ 보안 고려사항

- API 키는 환경변수로만 관리
- Supabase RLS(Row Level Security) 적용
- CORS 설정으로 도메인 제한
- 입력 검증 및 에러 핸들링

## 🔧 문제 해결

### 임베딩 실패 시
```bash
npm run embedding-logs  # 로그 확인
npm run check-embedding # 상태 확인
```

### 서버 연결 오류 시
1. 환경변수 확인
2. Supabase 연결 상태 확인
3. API 키 유효성 검증

### 빌드 오류 시
```bash
npm run install-all     # 의존성 재설치
rm -rf node_modules     # 캐시 정리
npm cache clean --force
```

## 📈 향후 개발 계획

- [ ] 학교 홈페이지 크롤링 데이터 추가
- [ ] 음성 입력/출력 기능
- [ ] 관리자 대시보드
- [ ] 다국어 지원
- [ ] 챗봇 성능 분석 및 개선

## 📞 지원

문제나 제안사항이 있으시면 다음으로 연락해주세요:
- 이메일: [연락처]
- GitHub Issues: [리포지토리 URL]/issues

---

🎓 **대진대학교 학생들의 학습을 돕는 AI 챗봇입니다!**