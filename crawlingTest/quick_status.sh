#!/bin/bash
# 크롤링 상태 빠른 체크 스크립트

echo "🔍 크롤링 상태 빠른 체크"
echo "=========================="

# 현재 시간
echo "📅 현재 시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo

# 결과 파일 수 체크
echo "📊 수집된 데이터:"
for dir in enhanced_strategic_output strategic_output enhanced_output; do
    if [ -d "$dir" ]; then
        count=$(find "$dir" -name "*.txt" | wc -l | tr -d ' ')
        latest=$(find "$dir" -name "*.txt" -exec stat -f "%m %N" {} \; 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- | xargs basename 2>/dev/null)
        if [ ! -z "$latest" ]; then
            latest_time=$(stat -f "%Sm" -t "%H:%M:%S" "$dir/$latest" 2>/dev/null)
            echo "  📁 $dir: $count개 (최신: $latest - $latest_time)"
        else
            echo "  📁 $dir: $count개"
        fi
    fi
done
echo

# 프로세스 확인
echo "🔄 실행 중인 크롤링 프로세스:"
ps aux | grep -E "(python.*crawl|enhanced_crawling)" | grep -v grep | while read line; do
    echo "  ⚡ $line"
done

pids=$(ps aux | grep -E "(python.*crawl|enhanced_crawling)" | grep -v grep | awk '{print $2}')
if [ -z "$pids" ]; then
    echo "  ❌ 실행 중인 크롤링 프로세스 없음"
else
    echo "  ✅ 크롤링 진행 중"
fi
echo

# 최근 로그 확인
echo "📋 최근 로그 (마지막 3줄):"
for log in enhanced_crawling_execution.log enhanced_strategic_crawler.log strategic_crawler.log; do
    if [ -f "$log" ]; then
        echo "  📄 $log:"
        tail -3 "$log" | sed 's/^/    /'
        echo
    fi
done

# 빠른 통계
echo "📈 빠른 통계:"
total_files=0
for dir in enhanced_strategic_output strategic_output enhanced_output; do
    if [ -d "$dir" ]; then
        count=$(find "$dir" -name "*.txt" | wc -l | tr -d ' ')
        total_files=$((total_files + count))
    fi
done
echo "  전체 파일: $total_files개"

# 최근 1분간 생성된 파일
recent_files=$(find . -name "*.txt" -newermt "1 minute ago" 2>/dev/null | wc -l | tr -d ' ')
echo "  최근 1분 생성: $recent_files개"

echo
echo "💡 더 자세한 정보:"
echo "   python3 check_crawling_status.py           # 상세 상태"
echo "   python3 check_crawling_status.py -w        # 실시간 모니터링"
echo "   python3 check_crawling_status.py -l 50     # 최근 50줄 로그"