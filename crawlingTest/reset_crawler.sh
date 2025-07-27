#!/bin/bash

# 대진대학교 전체 크롤링을 위한 초기화 스크립트

echo "🧹 크롤링 데이터 초기화 중..."

# 기존 상태 파일 백업
if [ -f "enhanced_crawler_state.json" ]; then
    echo "📦 기존 상태 파일 백업..."
    cp enhanced_crawler_state.json "backup_state_$(date +%Y%m%d_%H%M%S).json"
fi

# 기존 출력 디렉토리 백업
if [ -d "enhanced_output" ]; then
    echo "📦 기존 출력 디렉토리 백업..."
    mv enhanced_output "backup_output_$(date +%Y%m%d_%H%M%S)"
fi

# 새 출력 디렉토리 생성
mkdir -p enhanced_output

# 로그 파일 초기화
echo "📋 로그 파일 초기화..."
> crawler.log

echo "✅ 초기화 완료! 이제 새로운 크롤링을 시작할 수 있습니다."
echo "🚀 실행 명령: python enhanced_crawler.py"