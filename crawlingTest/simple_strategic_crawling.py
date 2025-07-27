#!/usr/bin/env python3
"""
간단한 전략적 크롤링 실행 스크립트
의존성 최소화 버전
"""

import asyncio
import sys
import os
from datetime import datetime

def main():
    print("=" * 60)
    print("🎯 대진대학교 전략적 보완 크롤링 시스템")
    print("=" * 60)
    
    # 기본 확인
    if not os.path.exists('enhanced_output'):
        print("❌ enhanced_output 디렉토리가 없습니다.")
        print("   기존 크롤링 데이터가 필요합니다.")
        return False
    
    existing_files = len([f for f in os.listdir('enhanced_output') if f.endswith('.txt')])
    print(f"📊 기존 데이터: {existing_files:,}개 파일")
    
    if existing_files == 0:
        print("❌ 기존 크롤링 데이터가 없습니다.")
        return False
    
    print(f"\n🎯 크롤링 목표:")
    print(f"   • 기존: {existing_files:,}개 유지")
    print(f"   • 신규: 2,000-3,000개 추가 수집")
    print(f"   • 전략: 도서관 얕게, 게시판 깊게")
    print(f"   • 예상 시간: 2-3시간")
    
    print(f"\n🚀 크롤링을 시작합니다...")
    print(f"   시작 시간: {datetime.now().strftime('%H:%M:%S')}")
    print(f"   중단하려면 Ctrl+C를 누르세요.")
    
    try:
        # 크롤러 import 및 실행
        from strategic_crawler import StrategicCrawler
        
        crawler = StrategicCrawler()
        
        # 비동기 실행 (목표 페이지 수 대폭 증가)
        result = asyncio.run(crawler.run_strategic_crawling(max_pages=10000))
        
        print("\n✅ 전략적 크롤링 완료!")
        
        # 결과 확인
        if os.path.exists('strategic_output'):
            new_files = len([f for f in os.listdir('strategic_output') if f.endswith('.txt')])
            print(f"📊 새로 수집된 페이지: {new_files:,}개")
            
            if new_files > 0:
                print(f"📁 결과 위치: strategic_output/")
                print(f"🎯 다음 단계: python3 merge_crawling_data.py")
                return True
            else:
                print("⚠️ 새로운 페이지가 수집되지 않았습니다.")
                return False
        else:
            print("❌ strategic_output 디렉토리가 생성되지 않았습니다.")
            return False
            
    except KeyboardInterrupt:
        print("\n⚠️ 사용자에 의해 중단되었습니다.")
        print("🔄 상태가 저장되었으므로 재시작 가능합니다.")
        return False
        
    except ImportError as e:
        print(f"❌ 모듈 import 오류: {e}")
        print("💡 필요한 패키지를 설치해주세요:")
        print("   pip3 install selenium aiohttp beautifulsoup4 requests")
        return False
        
    except Exception as e:
        print(f"❌ 크롤링 중 오류 발생: {e}")
        print(f"📋 자세한 로그: strategic_crawler.log")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)