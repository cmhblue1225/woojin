#!/usr/bin/env python3
"""
크롤링 상태 리셋 후 대규모 크롤링 실행
"""

import os
import shutil
import asyncio
import sys
from datetime import datetime

def reset_crawling_state():
    """크롤링 상태 완전 리셋"""
    print("🔄 크롤링 상태 리셋 중...")
    
    # 백업 생성
    if os.path.exists('strategic_output'):
        backup_name = f"strategic_output_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.move('strategic_output', backup_name)
        print(f"📁 기존 결과 백업: {backup_name}")
    
    # 상태 파일 백업 및 삭제
    state_files = [
        'strategic_crawler_state.json',
        'strategic_crawler.log',
        'strategic_execution.log'
    ]
    
    for state_file in state_files:
        if os.path.exists(state_file):
            backup_name = f"{state_file}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            shutil.copy2(state_file, backup_name)
            os.remove(state_file)
            print(f"📝 상태 파일 리셋: {state_file}")
    
    # 새 디렉토리 생성
    os.makedirs('strategic_output', exist_ok=True)
    print("✅ 크롤링 상태 리셋 완료")

def main():
    print("=" * 60)
    print("🎯 대진대학교 대규모 웹사이트 크롤링")
    print("=" * 60)
    
    # 기존 데이터 확인
    existing_files = 0
    if os.path.exists('enhanced_output'):
        existing_files = len([f for f in os.listdir('enhanced_output') if f.endswith('.txt')])
    
    print(f"📊 현재 상태:")
    print(f"   기존 데이터: {existing_files:,}개")
    print(f"   목표 신규: 5,000-10,000개")
    print(f"   전체 목표: 10,000-15,000개")
    
    print(f"\n🔧 새로운 크롤링 설정:")
    print(f"   • 우선순위 URL: 50+ 개 학과/기관")
    print(f"   • 최대 깊이: 30단계 (컴공과)")
    print(f"   • 동시 처리: 8개 Selenium 인스턴스")
    print(f"   • 필터링: 최소화")
    print(f"   • 예상 시간: 3-5시간")
    
    # 확인
    response = input(f"\n🚀 대규모 크롤링을 시작하시겠습니까? (y/N): ")
    if response.lower() not in ['y', 'yes']:
        print("❌ 크롤링이 취소되었습니다.")
        return False
    
    # 상태 리셋
    reset_crawling_state()
    
    try:
        print(f"\n🚀 대규모 크롤링 시작...")
        print(f"   시작 시간: {datetime.now().strftime('%H:%M:%S')}")
        print(f"   중단하려면 Ctrl+C를 누르세요.")
        
        # 크롤러 import 및 실행
        from strategic_crawler import StrategicCrawler
        
        crawler = StrategicCrawler()
        
        # 대규모 크롤링 실행
        result = asyncio.run(crawler.run_strategic_crawling(max_pages=10000))
        
        print("\n✅ 대규모 크롤링 완료!")
        
        # 결과 확인
        if os.path.exists('strategic_output'):
            new_files = len([f for f in os.listdir('strategic_output') if f.endswith('.txt')])
            print(f"📊 새로 수집된 페이지: {new_files:,}개")
            
            if new_files >= 1000:
                print(f"🎉 목표 달성! 충분한 데이터가 수집되었습니다.")
                print(f"📁 결과 위치: strategic_output/")
                print(f"🎯 다음 단계: python3 merge_crawling_data.py")
                return True
            else:
                print(f"⚠️ 목표치보다 적게 수집됨. 설정 재조정이 필요할 수 있습니다.")
                return False
        else:
            print("❌ strategic_output 디렉토리가 생성되지 않았습니다.")
            return False
            
    except KeyboardInterrupt:
        print("\n⚠️ 사용자에 의해 중단되었습니다.")
        print("🔄 상태가 저장되었으므로 재시작 가능합니다.")
        return False
        
    except Exception as e:
        print(f"❌ 크롤링 중 오류 발생: {e}")
        print(f"📋 자세한 로그: strategic_crawler.log")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)