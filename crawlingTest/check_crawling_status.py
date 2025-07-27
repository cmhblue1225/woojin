#!/usr/bin/env python3
"""
크롤링 상태 실시간 체크 스크립트
"""

import os
import time
import json
from datetime import datetime
from collections import defaultdict

def check_crawling_status():
    print("🔍 크롤링 상태 체크")
    print("=" * 60)
    
    # 결과 디렉토리들 확인
    directories = [
        ('enhanced_strategic_output', '향상된 전략적 크롤링'),
        ('strategic_output', '기본 전략적 크롤링'),
        ('enhanced_output', '기존 크롤링 데이터')
    ]
    
    total_files = 0
    
    for dir_name, description in directories:
        if os.path.exists(dir_name):
            files = [f for f in os.listdir(dir_name) if f.endswith('.txt')]
            file_count = len(files)
            total_files += file_count
            
            print(f"📁 {description}")
            print(f"   위치: {dir_name}/")
            print(f"   파일 수: {file_count:,}개")
            
            if file_count > 0:
                # 최신 파일 확인
                latest_file = max(files, key=lambda f: os.path.getmtime(os.path.join(dir_name, f)))
                latest_time = os.path.getmtime(os.path.join(dir_name, latest_file))
                latest_datetime = datetime.fromtimestamp(latest_time)
                
                print(f"   최신 파일: {latest_file}")
                print(f"   마지막 갱신: {latest_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
                
                # 도메인별 통계 (최근 100개 파일)
                recent_files = sorted(files, key=lambda f: os.path.getmtime(os.path.join(dir_name, f)))[-100:]
                domain_stats = defaultdict(int)
                
                for file in recent_files:
                    filepath = os.path.join(dir_name, file)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            first_lines = [f.readline() for _ in range(5)]
                            for line in first_lines:
                                if line.startswith('[DOMAIN]'):
                                    domain = line.split()[1]
                                    domain_stats[domain] += 1
                                    break
                    except:
                        pass
                
                if domain_stats:
                    print("   최근 도메인 분포:")
                    for domain, count in sorted(domain_stats.items(), key=lambda x: x[1], reverse=True):
                        print(f"     {domain}: {count}개")
            
            print()
    
    print(f"📊 전체 합계: {total_files:,}개 파일")
    
    # 로그 파일 확인
    log_files = [
        'enhanced_strategic_crawler.log',
        'enhanced_crawling_execution.log',
        'strategic_crawler.log'
    ]
    
    print("\n📋 로그 파일 상태:")
    print("-" * 40)
    
    for log_file in log_files:
        if os.path.exists(log_file):
            size = os.path.getsize(log_file)
            mtime = os.path.getmtime(log_file)
            mtime_str = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
            
            print(f"📄 {log_file}")
            print(f"   크기: {size:,} bytes")
            print(f"   수정: {mtime_str}")
            
            # 마지막 몇 줄 확인
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    if lines:
                        print(f"   마지막 로그: {lines[-1].strip()}")
            except:
                pass
            print()

def watch_crawling_progress(interval=30):
    """크롤링 진행상황 실시간 모니터링"""
    print("👀 크롤링 진행상황 실시간 모니터링")
    print("💡 Ctrl+C로 모니터링을 중단할 수 있습니다.\n")
    
    try:
        while True:
            # 화면 지우기 (macOS/Linux)
            os.system('clear')
            
            print("🔄 실시간 크롤링 모니터링")
            print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 60)
            
            check_crawling_status()
            
            print(f"\n⏱️ {interval}초 후 갱신...")
            time.sleep(interval)
            
    except KeyboardInterrupt:
        print("\n👋 모니터링을 중단했습니다.")

def show_recent_logs(log_file='enhanced_crawling_execution.log', lines=20):
    """최근 로그 표시"""
    print(f"📋 최근 로그 ({log_file}) - 마지막 {lines}줄")
    print("=" * 60)
    
    if not os.path.exists(log_file):
        print(f"❌ 로그 파일을 찾을 수 없습니다: {log_file}")
        return
    
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            
            for line in recent_lines:
                print(line.rstrip())
                
    except Exception as e:
        print(f"❌ 로그 읽기 오류: {e}")

def main():
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == '--watch' or command == '-w':
            interval = 30
            if len(sys.argv) > 2:
                try:
                    interval = int(sys.argv[2])
                except:
                    pass
            watch_crawling_progress(interval)
            
        elif command == '--logs' or command == '-l':
            lines = 20
            if len(sys.argv) > 2:
                try:
                    lines = int(sys.argv[2])
                except:
                    pass
            show_recent_logs(lines=lines)
            
        elif command == '--help' or command == '-h':
            print("🛠️ 크롤링 상태 체크 도구")
            print()
            print("사용법:")
            print("  python3 check_crawling_status.py           # 현재 상태 체크")
            print("  python3 check_crawling_status.py -w [초]   # 실시간 모니터링")
            print("  python3 check_crawling_status.py -l [줄]   # 최근 로그 보기")
            print()
            print("예시:")
            print("  python3 check_crawling_status.py -w 10     # 10초마다 갱신")
            print("  python3 check_crawling_status.py -l 50     # 최근 50줄 로그")
        else:
            print(f"❌ 알 수 없는 명령어: {command}")
            print("도움말을 보려면: python3 check_crawling_status.py --help")
    else:
        check_crawling_status()

if __name__ == "__main__":
    main()