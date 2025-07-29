# 🚀 Google Colab 확장 크롤링 설정 가이드

## 📋 개요
기존 20,231개 페이지와 **중복되지 않는** 새로운 대진대학교 페이지를 Google Colab에서 크롤링합니다.

## 🔧 Colab 설정 단계

### 1. 새 Colab 노트북 생성
- https://colab.research.google.com/ 접속
- 새 노트북 생성

### 2. 런타임 설정
```python
# 첫 번째 셀: 런타임 타입 확인 및 GPU 사용 설정
!nvidia-smi  # GPU 확인 (선택사항)
```

### 3. 필수 패키지 설치
```python
# 두 번째 셀: 필수 라이브러리 설치
!pip install selenium beautifulsoup4 aiohttp requests
!apt-get update
!apt-get install -y chromium-browser chromium-chromedriver
```

### 4. Chrome 드라이버 설정
```python
# 세 번째 셀: Chrome 드라이버 경로 설정
import os
os.environ['PATH'] += ':/usr/lib/chromium-browser/'
```

### 5. 크롤링 스크립트 업로드
```python
# 네 번째 셀: 파일 업로드
from google.colab import files

# colab_crawler.py 파일 업로드
uploaded = files.upload()
```

### 6. 크롤링 실행
```python
# 다섯 번째 셀: 크롤링 실행
import asyncio
import importlib.util

# 업로드된 스크립트 실행
spec = importlib.util.spec_from_file_location("colab_crawler", "colab_crawler.py")
crawler_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(crawler_module)

# 크롤링 시작
crawler = crawler_module.ColabAdvancedCrawler()
result = asyncio.run(crawler.run_extended_crawling())
print(f"🎉 크롤링 완료: {result:,}개 신규 페이지 수집")
```

## 📊 크롤링 특징

### ✅ 중복 방지 시스템
- **기존 20,231개 페이지** URL 자동 인식
- **완전 새로운 페이지만** 크롤링
- 체크포인트 시스템으로 중단 후 재시작 가능

### 🎯 새로운 탐색 영역
- **미탐색 도메인 우선**: semice, id, food, health, envir, mech 등
- **깊은 메뉴 탐색**: 프로그램, 시설, 연구실, 세미나 등
- **특수 페이지**: 사이트맵, 검색결과, RSS, API 엔드포인트

### 📁 자동 저장 시스템
- **Google Drive 연동**: /content/drive/MyDrive/daejin_crawling/
- **자동 압축**: 완료 시 ZIP 파일 생성
- **자동 다운로드**: Colab에서 로컬로 자동 다운로드

## 🔍 모니터링 방법

### 실시간 진행상황
```python
# 별도 셀에서 진행상황 확인
import json
import os

checkpoint_path = "/content/drive/MyDrive/daejin_crawling/colab_crawler_checkpoint.json"
if os.path.exists(checkpoint_path):
    with open(checkpoint_path, 'r') as f:
        data = json.load(f)
    print(f"📊 처리된 URL: {data['total_processed']:,}개")
    print(f"💾 저장된 페이지: {data['total_saved']:,}개")
    print(f"🌐 도메인별 통계: {data['domain_stats']}")
```

### 로그 확인
```python
# 로그 파일 확인
!tail -20 colab_crawler.log
```

## 📦 결과 파일 구조

### 크롤링 결과
```
/content/drive/MyDrive/daejin_crawling/
├── new_crawling_output/          # 새로 크롤링된 페이지들
│   ├── new_page_000000.txt
│   ├── new_page_000001.txt
│   └── ...
├── colab_crawler_checkpoint.json # 체크포인트
├── existing_urls.json           # 기존 URL 목록
├── crawling_report.json         # 크롤링 리포트
└── daejin_new_crawling_[날짜].zip # 압축 파일
```

### 페이지 파일 형식
```
[URL] https://example.daejin.ac.kr/new/page
[DEPTH] 2
[DOMAIN] example.daejin.ac.kr
[TIMESTAMP] 2025-07-28T19:00:00.000Z
[LENGTH] 1500
[NEW_CRAWLING] true

실제 페이지 내용...
```

## ⚠️ 주의사항

### 1. 실행 제한
- Colab 세션은 **12시간** 제한
- 중단 시 체크포인트에서 재시작 가능

### 2. 저장 공간
- Google Drive **15GB** 무료 한도 고려
- 예상 크롤링 결과: **500MB ~ 2GB**

### 3. 네트워크 제한
- Colab에서 외부 사이트 접근 시 간헐적 제한 가능
- 재시도 로직으로 자동 복구

## 🚀 실행 예시

```python
# 전체 실행 코드 (하나의 셀에서)
!pip install selenium beautifulsoup4 aiohttp requests > /dev/null 2>&1
!apt-get update > /dev/null 2>&1
!apt-get install -y chromium-browser chromium-chromedriver > /dev/null 2>&1

import os
os.environ['PATH'] += ':/usr/lib/chromium-browser/'

# 크롤링 실행
exec(open('colab_crawler.py').read())
```

## 📈 예상 결과

### 수집 목표
- **신규 페이지**: 5,000 ~ 15,000개
- **미탐색 도메인**: 10+ 개
- **새로운 콘텐츠**: 연구실, 프로그램, 시설 정보 등

### 처리 시간
- **예상 소요시간**: 2-6시간
- **체크포인트 간격**: 50개 페이지마다
- **자동 재시작**: 오류 시 3회 재시도

## 💡 팁

### 효율적 실행
1. **야간 실행 추천**: 네트워크 안정성
2. **GPU 런타임 사용**: 처리 속도 향상
3. **체크포인트 확인**: 정기적 진행상황 모니터링

### 문제 해결
- **Chrome 드라이버 오류**: 셀 재실행
- **메모리 부족**: 런타임 재시작
- **네트워크 오류**: 자동 재시도 대기

이제 Colab에서 `colab_crawler.py`를 업로드하고 실행하면 **기존 20,231개와 중복되지 않는 새로운 페이지**들을 자동으로 크롤링할 수 있습니다! 🎉