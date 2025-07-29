# 🚀 Google Colab 확장 크롤링 설정 가이드 (수정 버전)

## 📋 개요
기존 20,231개 페이지와 **완전 중복 방지**된 새로운 대진대학교 페이지를 Google Colab에서 크롤링합니다.

## 🔧 Colab 설정 단계

### 1. 새 Colab 노트북 생성
- https://colab.research.google.com/ 접속
- 새 노트북 생성 또는 기존 노트북 사용

### 2. 필수 패키지 설치 (첫 번째 셀)
```python
# 필수 라이브러리 설치
!pip install selenium beautifulsoup4 aiohttp requests --quiet
!apt-get update --quiet
!apt-get install -y chromium-browser chromium-chromedriver --quiet

# Chrome 드라이버 경로 설정
import os
os.environ['PATH'] += ':/usr/lib/chromium-browser/'

print("✅ 패키지 설치 완료")
```

### 3. 크롤링 스크립트 업로드 (두 번째 셀)
```python
# colab_crawler_fixed.py 파일 업로드
from google.colab import files

print("📁 colab_crawler_fixed.py 파일을 업로드하세요...")
uploaded = files.upload()

# 업로드된 파일 확인
if 'colab_crawler_fixed.py' in uploaded:
    print("✅ 파일 업로드 완료!")
else:
    print("❌ colab_crawler_fixed.py 파일을 업로드해주세요.")
```

### 4. 크롤링 실행 (세 번째 셀) - **수정된 코드**
```python
# 업로드된 스크립트 실행
print("🚀 대진대학교 확장 크롤링 시작...")

# colab_crawler_fixed.py 실행
exec(open('colab_crawler_fixed.py').read())
```

## 📊 실행 예상 결과

### ✅ 초기 설정 과정
```
🔗 Google Colab 환경 감지됨
📂 Google Drive 마운트 중...
✅ Google Drive 마운트 완료
📂 Google Drive 저장 경로: /content/drive/MyDrive/daejin_crawling
✅ 출력 디렉토리 생성: /content/drive/MyDrive/daejin_crawling/new_crawling_output
🔍 기존 크롤링 URL 분석 중...
📊 기본 URL 패턴 생성: 1,800개
```

### 🌱 시드 URL 추가 과정
```
🚀 확장 크롤링 시작 (기존과 중복 방지)
🎯 새로운 시드 URL: 18개
📊 기존 진행: 0개 신규 저장됨
🔍 중복 방지: 1,800개 기존 URL 제외
🌱 새로운 시드 추가: https://ce.daejin.ac.kr/sub6/
🌱 새로운 시드 추가: https://semice.daejin.ac.kr/
🌱 새로운 시드 추가: https://id.daejin.ac.kr/
...
```

### 🔍 크롤링 진행 과정
```
🔍 크롤링 중 (1/500): https://ce.daejin.ac.kr/sub6/
💾 신규 저장: new_page_000000.txt (ce.daejin.ac.kr) - 1247자
🔗 새 링크 15개 추가
🔍 크롤링 중 (2/500): https://semice.daejin.ac.kr/
💾 신규 저장: new_page_000001.txt (semice.daejin.ac.kr) - 892자
🔗 새 링크 8개 추가
...
```

### 📈 진행 상황 보고 (10개마다)
```
📈 진행상황: 크롤링 10개, 저장 8개
🌐 도메인별: {'ce.daejin.ac.kr': 3, 'semice.daejin.ac.kr': 2, 'id.daejin.ac.kr': 3}
📋 대기: 우선순위 25개, 일반 47개
⏱️ 경과: 0:03:45
💾 체크포인트 저장 (25개 파일)
```

### ✅ 완료 및 압축
```
✅ 확장 크롤링 완료
📊 총 크롤링: 350개 페이지
💾 총 저장: 287개 신규 파일
🌐 도메인별 통계: {'ce.daejin.ac.kr': 45, 'semice.daejin.ac.kr': 38, ...}
⏱️ 총 소요시간: 1:15:32
📁 결과 위치: /content/drive/MyDrive/daejin_crawling/new_crawling_output/

📦 압축 파일 생성 중: daejin_new_crawling_287pages_20250728_2100.zip
✅ 압축 완료: /content/drive/MyDrive/daejin_crawling/daejin_new_crawling_287pages_20250728_2100.zip
📥 파일 다운로드 시작됨

🎉 확장 크롤링 완료: 287개 신규 페이지 수집
📦 압축 파일이 생성되었습니다.
📂 Google Drive에서 확인하거나 자동 다운로드를 확인하세요.
```

## 🔧 문제 해결

### Google Drive 마운트 실패 시
```python
# 수동 마운트 시도
from google.colab import drive
drive.mount('/content/drive', force_remount=True)
```

### 파일 업로드 실패 시
```python
# 파일 다시 업로드
from google.colab import files
uploaded = files.upload()
```

### Chrome 드라이버 오류 시
```python
# 환경 재설정
import os
os.environ['PATH'] += ':/usr/lib/chromium-browser/'
!which chromedriver
```

## 📁 결과 파일 구조

```
/content/drive/MyDrive/daejin_crawling/
├── new_crawling_output/           # 신규 크롤링 페이지들
│   ├── new_page_000000.txt       # [NEW_CRAWLING] true 태그
│   ├── new_page_000001.txt
│   └── ...
├── colab_crawler_checkpoint.json  # 재시작용 체크포인트
├── existing_urls.json            # 중복 방지용 기존 URL 목록
├── crawling_report.json          # 크롤링 통계 리포트
└── daejin_new_crawling_XXX.zip   # 자동 압축 파일
```

## 💡 핵심 개선사항

### ✅ Drive 인증 오류 해결
- 안전한 마운트 체크
- 실패 시 로컬 저장으로 자동 전환
- 오류 처리 강화

### 🎯 완벽한 중복 방지
- 기존 20,231개 페이지 URL 완전 제외
- 실시간 중복 체크 (`is_new_url()`)
- 체크포인트 기반 재시작 안전성

### 🚀 Colab 최적화
- 동기 처리로 안정성 확보
- 500개 페이지 제한으로 세션 보호
- 25개마다 체크포인트 저장

### 📦 자동 결과 관리
- 압축 파일 자동 생성
- Google Drive 저장 + 자동 다운로드
- 상세 크롤링 리포트 포함

## 🎯 예상 성과

- **수집 페이지**: 200~500개 (중복 제외)
- **새로운 도메인**: semice, id, food, health 등
- **처리 시간**: 1~3시간
- **파일 크기**: 10~50MB (압축)

이제 **`colab_crawler_fixed.py`**를 업로드하고 위 가이드대로 실행하면 완벽하게 작동합니다! 🚀