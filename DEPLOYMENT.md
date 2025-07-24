# 🚀 배포 가이드

이 가이드는 대진대학교 RAG 챗봇을 Render.com에 배포하는 방법을 설명합니다.

## 📋 배포 전 체크리스트

### 1. 필수 준비 사항
- [ ] GitHub 계정
- [ ] Render.com 계정
- [ ] Supabase 프로젝트 생성
- [ ] OpenAI API 키
- [ ] Claude API 키 (Anthropic)

### 2. 환경변수 준비
다음 환경변수들이 준비되어 있는지 확인:
```
CLAUDE_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔧 단계별 배포 과정

### 1단계: Supabase 설정

1. **Supabase 프로젝트 생성**
   - [Supabase](https://supabase.com) 접속
   - 새 프로젝트 생성
   - 프로젝트 URL과 anon key 복사

2. **데이터베이스 스키마 설정**
   ```sql
   -- Supabase SQL Editor에서 다음 명령 실행
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   
   - `scripts/schema.sql` 파일 내용을 Supabase SQL Editor에 붙여넣기
   - 실행하여 테이블과 함수 생성

### 2단계: GitHub 리포지토리 설정

1. **리포지토리 생성**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: 대진대학교 RAG 챗봇"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/daejin-chatbot.git
   git push -u origin main
   ```

2. **환경변수 파일 확인**
   - `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
   - 실제 API 키들이 커밋되지 않았는지 확인

### 3단계: Render.com 배포

1. **Render.com 계정 생성**
   - [Render.com](https://render.com) 접속
   - GitHub로 로그인

2. **새 Web Service 생성**
   - Dashboard → "New" → "Web Service"
   - GitHub 리포지토리 연결
   - 리포지토리 선택: `daejin-chatbot`

3. **빌드 설정**
   ```
   Name: daejin-chatbot
   Environment: Node
   Region: Oregon (US West) 또는 가장 가까운 지역
   Branch: main
   Build Command: npm run install-all && npm run build
   Start Command: npm start
   ```

4. **환경변수 설정**
   Environment 탭에서 다음 변수들 추가:
   ```
   NODE_ENV=production
   PORT=10000
   CLAUDE_API_KEY=your_actual_claude_key
   OPENAI_API_KEY=your_actual_openai_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   EMBEDDING_MODEL=text-embedding-3-small
   CLAUDE_MODEL=claude-3-sonnet-20240229
   MAX_TOKENS=2000
   CHUNK_SIZE=1000
   CHUNK_OVERLAP=200
   BATCH_SIZE=50
   ```

5. **배포 시작**
   - "Create Web Service" 클릭
   - 빌드 로그 확인하며 대기 (5-10분 소요)

### 4단계: 데이터 임베딩

배포가 완료된 후, 로컬에서 데이터를 임베딩해야 합니다:

1. **로컬 환경 설정**
   ```bash
   # .env 파일에 프로덕션 Supabase 정보 설정
   cp .env.example .env
   # .env 파일 편집하여 실제 값 입력
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **임베딩 실행**
   ```bash
   npm run embed
   ```

4. **임베딩 상태 확인**
   ```bash
   npm run check-embedding
   ```

## 🔍 배포 후 확인사항

### 1. 서비스 상태 확인
- Render.com 대시보드에서 서비스 상태가 "Live"인지 확인
- 제공된 URL로 접속하여 웹사이트 로드 확인

### 2. API 엔드포인트 테스트
```bash
# 헬스 체크
curl https://your-app-name.onrender.com/api/health

# 채팅 테스트
curl -X POST https://your-app-name.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "수강신청 일정이 언제야?"}'
```

### 3. 기능 테스트
- [ ] 웹페이지 정상 로드
- [ ] 채팅 인터페이스 작동
- [ ] 질문에 대한 응답 생성
- [ ] 빠른 액션 버튼 작동
- [ ] 컨텍스트 출처 표시

## 🛠️ 배포 후 관리

### 로그 확인
- Render.com 대시보드 → Logs 탭
- 실시간 로그 모니터링 가능

### 환경변수 수정
- Environment 탭에서 언제든 수정 가능
- 수정 후 자동 재배포됨

### 코드 업데이트
- GitHub에 새 커밋 푸시하면 자동 재배포
- 수동 재배포도 가능

### 도메인 설정
- Settings → Custom Domain
- 원하는 도메인 연결 가능

## 🔧 문제 해결

### 빌드 실패 시
1. **의존성 문제**
   ```bash
   # package.json 확인
   # Node.js 버전 호환성 확인
   ```

2. **메모리 부족**
   - 무료 플랜의 메모리 제한 (512MB) 확인
   - 불필요한 의존성 제거

3. **환경변수 누락**
   - 모든 필수 환경변수가 설정되어 있는지 확인

### 런타임 오류 시
1. **로그 확인**
   - Render.com 로그에서 오류 메시지 확인

2. **데이터베이스 연결**
   - Supabase URL과 키가 올바른지 확인
   - 네트워크 접근 권한 확인

3. **API 키 유효성**
   - OpenAI, Claude API 키가 유효한지 확인
   - 사용량 제한에 걸리지 않았는지 확인

### 성능 최적화
1. **Free Tier 제한**
   - 15분 비활성 후 슬립 모드
   - 첫 요청 시 웜업 시간 필요

2. **업그레이드 고려**
   - Starter 플랜: $7/월, 슬립 없음
   - 더 많은 메모리와 CPU 제공

## 📊 모니터링

### 기본 모니터링
- Render.com에서 제공하는 기본 메트릭스
- CPU, 메모리, 네트워크 사용량 확인

### 사용자 분석
- Google Analytics 추가 고려
- 채팅 로그 분석을 통한 성능 개선

## 🔄 지속적 개선

### 데이터 업데이트
1. 새로운 학습 데이터 추가
2. 로컬에서 재임베딩 실행
3. 서비스 성능 모니터링

### 기능 추가
1. 새 기능 개발 후 스테이징 환경에서 테스트
2. 프로덕션 배포 전 충분한 검증

---

🎉 **축하합니다! 대진대학교 RAG 챗봇이 성공적으로 배포되었습니다!**

추가 질문이나 문제가 있으시면 언제든 연락해주세요.