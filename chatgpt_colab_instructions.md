# 🤖 ChatGPT용 Google Colab 크롤링 완전 가이드

## 📋 미션 개요
대진대학교 RAG 챗봇 프로젝트를 위한 **추가 크롤링 작업**입니다. 현재 **20,231개 페이지**가 이미 크롤링되어 있으며, **완전 중복 방지**로 새로운 페이지만 수집해야 합니다.

## 🎯 목표
- **기존 데이터**: 20,231개 페이지 (unlimited_crawling_output)
- **추가 목표**: 500~1,000개 신규 페이지
- **중복 방지**: 100% 중복 제거 보장
- **결과 전송**: 압축 파일로 데이터 전송

## 📦 필요한 파일들

### 1. 크롤링 스크립트
- **파일명**: `colab_crawler_fixed.py`
- **설명**: Google Colab 최적화된 크롤링 시스템
- **특징**: 
  - 기존 20,231개 URL 완전 중복 방지
  - Google Drive 자동 저장
  - 체크포인트 기반 재시작 가능
  - 압축 파일 자동 생성

### 2. 기존 URL 목록 (필수!)
- **파일명**: `existing_urls.json`
- **용도**: 중복 방지를 위한 기존 크롤링된 URL 목록
- **크기**: 약 2MB (20,231개 URL 포함)

## 🚀 Google Colab 실행 단계

### Step 1: 환경 설정
```python
# 필수 라이브러리 설치
!pip install selenium beautifulsoup4 aiohttp requests --quiet
!apt-get update --quiet
!apt-get install -y chromium-browser chromium-chromedriver --quiet

import os
os.environ['PATH'] += ':/usr/lib/chromium-browser/'
print("✅ 환경 설정 완료")
```

### Step 2: 파일 업로드
```python
from google.colab import files

print("📁 다음 2개 파일을 업로드하세요:")
print("1. colab_crawler_fixed.py")
print("2. existing_urls.json")

uploaded = files.upload()

# 업로드 확인
required_files = ['colab_crawler_fixed.py', 'existing_urls.json']
for file in required_files:
    if file in uploaded:
        print(f"✅ {file} 업로드 완료")
    else:
        print(f"❌ {file} 누락 - 다시 업로드하세요")
```

### Step 3: 크롤링 실행
```python
print("🚀 대진대학교 추가 크롤링 시작...")
print("예상 소요시간: 1-3시간")
print("예상 수집량: 500-1,000개 신규 페이지")

# 크롤링 실행
exec(open('colab_crawler_fixed.py').read())
```

## 📊 예상 실행 결과

### 초기화 단계
```
🔗 Google Colab 환경 감지됨
📂 Google Drive 마운트 중...
✅ Google Drive 마운트 완료
📂 출력 디렉토리: /content/drive/MyDrive/daejin_crawling/new_crawling_output
🔍 기존 크롤링 URL 분석 중...
📊 기존 URL: 20,231개 로드됨
🎯 중복 방지 시스템 활성화
```

### 크롤링 진행
```
🚀 확장 크롤링 시작
🌱 새로운 시드 URL 생성: 25개
🔍 크롤링 중 (1/500): https://semice.daejin.ac.kr/
💾 신규 저장: new_page_000000.txt - 1,247자
🔗 새 링크 15개 발견

📈 진행상황 (10개마다 보고):
- 크롤링: 45개 시도
- 저장: 38개 신규 (7개 중복 제외됨)
- 도메인: {'semice.daejin.ac.kr': 12, 'id.daejin.ac.kr': 8, ...}
- 소요시간: 0:15:23
```

### 완료 및 결과
```
✅ 추가 크롤링 완료!
📊 결과 요약:
- 총 크롤링 시도: 847개
- 신규 페이지 저장: 623개
- 중복 제외됨: 224개
- 새로운 도메인: 8개
- 총 소요시간: 2:45:18

📦 압축 파일 생성: daejin_new_crawling_623pages_20250729.zip
📁 Google Drive 저장 완료
📥 자동 다운로드 시작됨
```

## 🔧 문제 해결 가이드

### Google Drive 마운트 실패
```python
from google.colab import drive
drive.mount('/content/drive', force_remount=True)
```

### 파일 업로드 실패
```python
# 파일 다시 업로드
from google.colab import files
uploaded = files.upload()
```

### 크롤링 중단 시 재시작
```python
# 체크포인트에서 자동 재시작됨
print("🔄 중단된 지점부터 재시작...")
exec(open('colab_crawler_fixed.py').read())
```

## 📁 결과 파일 구조

크롤링 완료 후 다음 구조로 저장됩니다:

```
/content/drive/MyDrive/daejin_crawling/
├── new_crawling_output/              # 신규 크롤링 페이지들
│   ├── new_page_000000.txt          # [NEW_CRAWLING] true 태그
│   ├── new_page_000001.txt
│   └── ... (500~1,000개 파일)
├── daejin_new_crawling_XXX.zip      # 압축된 결과 파일
├── crawling_report.json             # 상세 통계 리포트
└── colab_crawler_checkpoint.json    # 체크포인트 파일
```

## 💾 데이터 전송 방법

### 방법 1: 자동 다운로드 (권장)
- 크롤링 완료 시 자동으로 압축 파일 다운로드됨
- 파일명: `daejin_new_crawling_XXXpages_20250729.zip`

### 방법 2: Google Drive 수동 다운로드
```python
# Google Drive에서 파일 찾기
import os
drive_path = '/content/drive/MyDrive/daejin_crawling'
for file in os.listdir(drive_path):
    if file.endswith('.zip'):
        print(f"📦 압축 파일: {file}")
```

### 방법 3: 직접 다운로드
```python
from google.colab import files
# 압축 파일 다운로드
files.download('/content/drive/MyDrive/daejin_crawling/daejin_new_crawling_XXX.zip')
```

## 🎯 핵심 기능

### ✅ 완벽한 중복 방지
- 20,231개 기존 URL 완전 배제
- 실시간 중복 체크 시스템
- `existing_urls.json` 기반 검증

### 🚀 Colab 최적화
- Google Drive 자동 연동
- 500개 페이지 제한으로 세션 안정성
- 체크포인트 기반 재시작

### 📦 자동 결과 처리
- 압축 파일 자동 생성
- 상세 크롤링 리포트
- 도메인별 통계 제공

## 📈 기대 효과

현재 데이터베이스: **126,446개 문서**
추가 예상: **+3,000~5,000개 문서** (청크 분할 후)
최종 목표: **130,000개+ 문서**로 답변 품질 대폭 향상

## 🎉 최종 목표

1. **신규 페이지 수집**: 500~1,000개
2. **압축 파일 전송**: 자동 다운로드
3. **품질 보고서**: JSON 형태 상세 통계
4. **임베딩 준비**: 즉시 처리 가능한 형태

---

**💡 중요**: 반드시 `existing_urls.json` 파일을 함께 업로드해야 중복 방지가 작동합니다!