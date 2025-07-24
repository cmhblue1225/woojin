# 🔄 부분 데이터 갱신 가이드

## 📋 개요
기존 전체 데이터 재임베딩 방식 대신, 변경된 데이터만 선택적으로 갱신할 수 있는 시스템입니다.

## 🚀 사용법

### 1. 시간표 데이터만 갱신
```bash
npm run update-timetable
```
- `data/timetable.txt` 파일 변경 시 사용
- 기존 시간표 데이터만 삭제 후 새로 임베딩
- 수강신청 안내 데이터는 그대로 유지

### 2. 수강신청 안내 데이터만 갱신
```bash
npm run update-announcement
```
- `data/종합강의 시간표 안내.txt` 파일 변경 시 사용
- 기존 안내 데이터만 삭제 후 새로 임베딩
- 시간표 데이터는 그대로 유지

### 3. 특정 파일만 갱신
```bash
# 시간표 파일 갱신
node scripts/partial-update.js --file=timetable.txt

# 안내 파일 갱신
node scripts/partial-update.js --file=종합강의\ 시간표\ 안내.txt
```

## 🔧 주요 기능

### ✅ 자동 백업 & 롤백
- 갱신 전 기존 데이터 자동 백업
- 실패 시 자동 롤백으로 데이터 무결성 보장
- 백업 파일: `backups/backup-{timestamp}.json`

### ⚡ 빠른 갱신
- 전체 1921개 → 일부만 갱신 (시간표: ~100개, 안내: ~1800개)
- OpenAI API 비용 절약
- 갱신 시간 단축

### 📊 상세 로깅
- 실시간 진행상황 표시
- 로그 파일: `logs/partial-update.log`
- 백업/복원 과정 모두 기록

## 📁 지원 파일 목록
- `timetable.txt` - 과목 시간표 정보
- `종합강의 시간표 안내.txt` - 수강신청 안내

## ⚠️ 주의사항

### 1. 백업 확인
- 갱신 전 중요한 데이터는 별도 백업 권장
- 백업 파일은 자동으로 `backups/` 폴더에 저장

### 2. 환경변수 설정
- `.env` 파일의 다음 변수들이 설정되어 있어야 함:
  ```
  OPENAI_API_KEY=your_openai_key
  SUPABASE_URL=your_supabase_url
  SUPABASE_ANON_KEY=your_supabase_key
  ```

### 3. 롤백 기능
- 갱신 실패 시 자동 롤백
- 수동 롤백은 현재 지원하지 않음

## 🆚 기존 방식과 비교

| 구분 | 기존 방식 (`npm run embed`) | 새로운 방식 |
|------|---------------------------|------------|
| 갱신 대상 | 전체 1921개 문서 | 변경된 타입/파일만 |
| 소요 시간 | ~10-15분 | ~2-5분 |
| API 비용 | 전체 비용 | 30-80% 절약 |
| 다운타임 | 전체 갱신 중 검색 불가 | 일부만 영향 |
| 백업/롤백 | ❌ | ✅ |

## 🔍 예시 사용 시나리오

### 시나리오 1: 새 학기 시간표 업데이트
```bash
# 1. timetable.txt 파일 수정
# 2. 시간표만 갱신
npm run update-timetable
```

### 시나리오 2: 수강신청 안내 문서 수정
```bash
# 1. 종합강의 시간표 안내.txt 수정
# 2. 안내 문서만 갱신
npm run update-announcement
```

## 🐛 문제 해결

### 갱신 실패 시
1. 로그 파일 확인: `logs/partial-update.log`
2. 자동 롤백 확인
3. 환경변수 및 파일 경로 확인

### 백업 파일 위치
- `backups/backup-{timestamp}.json`
- 각 갱신마다 새로운 백업 파일 생성

---
**💡 팁**: 작은 변경사항은 부분 갱신을, 대규모 데이터 재구성은 전체 갱신(`npm run embed`)을 사용하세요!