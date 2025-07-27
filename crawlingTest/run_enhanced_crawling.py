#!/usr/bin/env python3
"""
향상된 전략적 크롤링 실행 스크립트
- 기존 데이터와 무관하게 완전 새로운 크롤링
- 5,000개 목표
"""

import os
import sys
import asyncio
import time
from datetime import datetime
import logging

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('enhanced_crawling_execution.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def pre_check():
    """크롤링 전 검사"""
    logger.info("🔍 크롤링 전 검사")
    
    # 필요한 디렉토리 생성
    os.makedirs('enhanced_strategic_output', exist_ok=True)
    
    # 기존 결과 확인
    existing_files = 0
    if os.path.exists('enhanced_strategic_output'):
        existing_files = len([f for f in os.listdir('enhanced_strategic_output') if f.endswith('.txt')])
    
    logger.info(f"📊 기존 결과: {existing_files}개 파일")
    
    if existing_files > 0:
        response = input(f"\\n⚠️ 기존 결과 {existing_files}개가 있습니다. 계속하시겠습니까? (y/N): ")
        if response.lower() not in ['y', 'yes']:
            logger.info("❌ 사용자가 취소했습니다.")
            return False
    
    return True

async def run_enhanced_crawling():
    """향상된 크롤링 실행"""
    logger.info("🚀 향상된 전략적 크롤링 시작")
    
    try:
        from enhanced_strategic_crawler import EnhancedStrategicCrawler
        
        crawler = EnhancedStrategicCrawler()
        
        # 크롤링 실행 (목표: 5000페이지)
        result = await crawler.run_enhanced_crawling(max_pages=5000)
        
        logger.info(f"✅ 크롤링 완료: {result}개 페이지 수집")
        return result
        
    except Exception as e:
        logger.error(f"❌ 크롤링 실행 오류: {e}")
        return 0

def post_analysis(collected_pages):
    """크롤링 후 분석"""
    logger.info("📊 크롤링 결과 분석")
    
    try:
        if os.path.exists('enhanced_strategic_output'):
            files = [f for f in os.listdir('enhanced_strategic_output') if f.endswith('.txt')]
            actual_files = len(files)
            
            logger.info(f"📊 수집 결과:")
            logger.info(f"   보고된 페이지: {collected_pages:,}개")
            logger.info(f"   실제 파일: {actual_files:,}개")
            
            if actual_files >= 2000:
                logger.info("🎉 충분한 데이터 수집 완료!")
                logger.info("📁 결과 위치: enhanced_strategic_output/")
                logger.info("🎯 다음 단계: 데이터 병합 및 임베딩")
                return True
            elif actual_files >= 1000:
                logger.info("⚡ 괜찮은 결과! 추가 크롤링 권장")
                return True
            else:
                logger.info("⚠️ 목표치 미달. 설정 재조정 필요")
                return False
        else:
            logger.error("❌ 결과 디렉토리가 없습니다.")
            return False
            
    except Exception as e:
        logger.error(f"❌ 분석 중 오류: {e}")
        return False

def main():
    print("=" * 60)
    print("🎯 대진대학교 향상된 전략적 크롤링 시스템")
    print("=" * 60)
    
    # 사전 검사
    if not pre_check():
        return False
    
    print(f"\\n🎯 크롤링 계획:")
    print(f"   • 기존 데이터 무시하고 완전 새로운 크롤링")
    print(f"   • 목표: 5,000개 페이지")
    print(f"   • 전략: 게시판 중심 깊이 우선 탐색")
    print(f"   • 예상 시간: 4-6시간")
    
    print(f"\\n🚀 크롤링을 시작합니다...")
    print(f"   시작 시간: {datetime.now().strftime('%H:%M:%S')}")
    print(f"   중단하려면 Ctrl+C를 누르세요.")
    
    start_time = time.time()
    
    try:
        # 크롤링 실행
        collected = asyncio.run(run_enhanced_crawling())
        
        elapsed_time = time.time() - start_time
        success = post_analysis(collected)
        
        print("\\n" + "=" * 60)
        print("✅ 향상된 전략적 크롤링 완료!")
        print(f"📊 수집된 페이지: {collected:,}개")
        print(f"⏱️ 소요시간: {elapsed_time/3600:.1f}시간")
        print(f"📁 결과 위치: enhanced_strategic_output/")
        print("=" * 60)
        
        return success
        
    except KeyboardInterrupt:
        logger.info("⚠️ 사용자에 의해 중단됨")
        return False
    except Exception as e:
        logger.error(f"❌ 예상치 못한 오류: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)