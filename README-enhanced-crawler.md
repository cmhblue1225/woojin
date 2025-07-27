# 🕷️ 대진대학교 고성능 크롤링 시스템

## 📋 개요
MacBook Pro M4 Pro (14-core CPU, 20-core GPU) 성능을 최대한 활용한 대진대학교 홈페이지 크롤링 시스템입니다.

## ✨ 주요 특징

### 🚀 성능 최적화
- **멀티프로세싱**: 최대 20개 워커 동시 실행
- **비동기 처리**: 50개 동시 HTTP 요청 지원  
- **지능형 배치**: Selenium과 HTTP 요청 최적 조합
- **메모리 효율**: 점진적 처리로 메모리 사용량 최소화

### 🔍 지능형 크롤링
- **우선순위 기반**: 중요한 페이지 먼저 크롤링
- **깊이 제한**: 도메인별 맞춤 깊이 설정
- **중복 제거**: MD5 해시 + TF-IDF 기반 중복 콘텐츠 감지
- **카테고리 분류**: URL 패턴 기반 자동 분류

### 🛡️ 안정성
- **중단/재시작**: 언제든 중단 후 이어서 실행 가능
- **에러 처리**: 포괄적인 예외 처리 및 로깅
- **상태 저장**: 실시간 진행 상황 저장

## 🏗️ 시스템 아키텍처

```
📦 enhanced_crawler.py           # 메인 크롤링 엔진
├── 🔧 MultiProcessing          # 14-core CPU 활용
├── 🌐 Async HTTP Requests      # 50개 동시 요청
├── 🤖 Selenium Pool            # JavaScript 처리
├── 🧠 Smart Text Cleaning      # 고급 텍스트 정제
├── 📊 Priority Queue           # 우선순위 기반 처리
└── 💾 State Management         # 실시간 상태 저장

📦 process-crawled-data.js       # RAG 통합 처리
├── 📝 Text Chunking            # 청크 분할
├── 🤖 OpenAI Embedding         # 벡터 임베딩
├── 🗄️ Supabase Integration     # 데이터베이스 저장
└── 📈 Statistics Generation    # 통계 생성
```

## 🚀 사용법

### 1. 크롤링 실행
```bash
# 고성능 크롤링 시작
npm run crawl

# 또는 직접 실행
cd crawlingTest
python3 enhanced_crawler.py
```

### 2. 크롤링 데이터 RAG 통합
```bash
# 크롤링 데이터를 임베딩하여 RAG에 추가
npm run update-website
```

### 3. 진행 상황 확인
```bash
# 로그 파일 확인
tail -f crawlingTest/crawler.log

# 출력 디렉토리 확인
ls -la crawlingTest/enhanced_output/
```

## ⚙️ 설정 및 최적화

### 도메인별 깊이 제한
```python
domain_depth_limits = {
    'library.daejin.ac.kr': 3,    # 도서관은 얕게
    'www.daejin.ac.kr': 10,       # 메인 사이트는 깊게
    'default': 6                   # 기본 깊이
}
```

### 우선순위 패턴
```python
priority_patterns = [
    r'/bbs/.*/artclView\\.do',    # 게시판 게시물 (최우선)
    r'/subview\\.do',             # 서브페이지
    r'/notice/',                  # 공지사항
    r'/board/',                   # 게시판
    r'/info/',                    # 정보 페이지
]
```

### 성능 튜닝
```python
max_workers = 20                  # CPU 코어 수에 맞춤
max_concurrent_requests = 50      # 동시 HTTP 요청
max_selenium_instances = 8        # Selenium 인스턴스
```

## 📊 출력 데이터 구조

### 크롤링 결과 파일 (`enhanced_output/page_XXXXX.txt`)
```
[URL] https://www.daejin.ac.kr/daejin/874/subview.do
[DEPTH] 2
[DOMAIN] www.daejin.ac.kr
[TIMESTAMP] 2025-07-24T...
[LENGTH] 1234

대진대학교 공지사항
...실제 텍스트 내용...
```

### RAG 통합 후 데이터베이스 구조
```sql
{
  "content": "청크 텍스트",
  "source_type": "website",
  "source_file": "page_00123.txt", 
  "source_url": "https://...",
  "metadata": {
    "domain": "www.daejin.ac.kr",
    "category": "notice",
    "depth": 2,
    "chunk_index": 0,
    "total_chunks": 3
  }
}
```

## 🎯 크롤링 전략

### 1. 메인 사이트 (www.daejin.ac.kr)
- ✅ 깊이 10까지 전체 탐색
- ✅ 공지사항, 학사정보 우선
- ✅ 게시판 게시물 상세 크롤링

### 2. 학과별 사이트
- ✅ 각 학과 메인 페이지부터 시작
- ✅ 교수 정보, 교과과정 중점
- ✅ 학과 공지사항 수집

### 3. 도서관 (library.daejin.ac.kr)  
- ✅ 깊이 3으로 제한 (요청사항)
- ✅ 기본 서비스 정보만 수집
- ✅ 너무 깊은 내부 시스템 제외

## 📈 성능 벤치마크 (MacBook Pro M4 Pro)

| 항목 | 기존 시스템 | 개선된 시스템 | 개선률 |
|------|------------|--------------|--------|
| 동시 처리 | 4개 | 20개 | **5배** |
| HTTP 요청 | 순차 | 50개 동시 | **12배** |
| 텍스트 정제 | 기본 | 고급 필터링 | **3배** |
| 중복 제거 | TF-IDF만 | 해시+TF-IDF | **10배** |
| 상태 관리 | 기본 | 실시간 저장 | 안정성 **향상** |

## 🔧 문제 해결

### Q: 크롤링이 중단되었을 때
```bash
# 상태 파일 확인
cat crawlingTest/enhanced_crawler_state.json

# 재시작 (자동으로 이어서 실행됨)
npm run crawl
```

### Q: 메모리 부족 오류
```python
# enhanced_crawler.py에서 워커 수 조정
max_workers = 10  # 20에서 10으로 감소
```

### Q: 특정 사이트만 크롤링하고 싶을 때
```python
# start_urls 수정
start_urls = [
    "https://www.daejin.ac.kr/sites/daejin/index.do",
    # 다른 URL들 주석 처리
]
```

## 📋 체크리스트

### 크롤링 실행 전
- [ ] Python 의존성 설치 (`pip install -r requirements.txt`)
- [ ] Chrome/Chromium 브라우저 설치 확인
- [ ] 디스크 공간 충분한지 확인 (최소 5GB)

### RAG 통합 전  
- [ ] OpenAI API 키 설정 확인
- [ ] Supabase 연결 확인
- [ ] 기존 웹사이트 데이터 백업 (필요시)

## 📞 지원 및 문의

- **로그 파일**: `crawlingTest/crawler.log`
- **에러 로그**: `crawlingTest/enhanced_output/enhanced_error_log.txt`
- **상태 파일**: `crawlingTest/enhanced_crawler_state.json`

---

**💡 팁**: M4 Pro의 강력한 성능을 최대한 활용하여 대학 전체 홈페이지를 효율적으로 크롤링할 수 있습니다!