#!/usr/bin/env python3
"""
전략적 보완 크롤링 실행 스크립트
- 기존 5,118개 데이터 + 새로운 2,000-3,000개 추가
- 도서관 얕게, 게시판 깊게 전략
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
        logging.FileHandler('strategic_execution.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def pre_crawling_check():
    """크롤링 전 사전 검사"""
    logger.info("🔍 사전 검사 시작")
    
    # 필요한 디렉토리 확인
    required_dirs = ['enhanced_output', 'strategic_output']
    for dir_name in required_dirs:
        if not os.path.exists(dir_name):
            os.makedirs(dir_name)
            logger.info(f"📁 디렉토리 생성: {dir_name}")
    
    # 기존 데이터 확인
    existing_files = len([f for f in os.listdir('enhanced_output') if f.endswith('.txt')])
    logger.info(f"📊 기존 데이터: {existing_files:,}개 파일")
    
    # 시스템 리소스 확인 (간소화)
    import os
    import shutil
    
    # CPU 코어 수 확인
    try:
        cpu_count = os.cpu_count() or 4
    except:
        cpu_count = 4
    
    # 디스크 공간 확인
    try:
        total, used, free = shutil.disk_usage('.')
        free_gb = free // (1024**3)
    except:
        free_gb = 10  # 기본값
    
    logger.info(f"💻 시스템 리소스:")
    logger.info(f"   CPU: {cpu_count}코어")
    logger.info(f"   디스크: {free_gb:.1f}GB 사용 가능")
    
    # 최소 요구사항 확인 (디스크만)
    if free_gb < 2:  # 2GB
        logger.warning("⚠️ 디스크 공간 부족: 최소 2GB 필요")
        return False
    
    logger.info("✅ 사전 검사 완료")
    return True

def estimate_crawling_time():
    """크롤링 시간 추정"""
    logger.info("⏱️ 크롤링 시간 추정")
    
    # 추정 파라미터
    target_pages = 3000
    avg_page_time = 2.5  # 페이지당 평균 처리 시간 (초)
    parallel_factor = 3  # 병렬 처리 효과
    
    estimated_seconds = (target_pages * avg_page_time) / parallel_factor
    estimated_hours = estimated_seconds / 3600
    
    logger.info(f"📊 추정 결과:")
    logger.info(f"   목표 페이지: {target_pages:,}개")
    logger.info(f"   예상 시간: {estimated_hours:.1f}시간")
    logger.info(f"   완료 예정: {datetime.now().strftime('%H:%M')} + {estimated_hours:.1f}h")
    
    return estimated_hours

async def run_strategic_crawling():
    """전략적 크롤링 실행"""
    logger.info("🚀 전략적 보완 크롤링 시작")
    
    try:
        # 크롤러 import 및 실행
        from strategic_crawler import StrategicCrawler
        
        crawler = StrategicCrawler()
        
        # 크롤링 실행 (최대 3000페이지)
        await crawler.run_strategic_crawling(max_pages=3000)
        
        logger.info("✅ 전략적 크롤링 완료")
        return True
        
    except Exception as e:
        logger.error(f"❌ 크롤링 실행 오류: {e}")
        return False

def post_crawling_analysis():
    """크롤링 후 분석"""
    logger.info("📊 크롤링 결과 분석")
    
    try:
        # 새로 수집된 파일 수 확인
        if os.path.exists('strategic_output'):
            new_files = len([f for f in os.listdir('strategic_output') if f.endswith('.txt')])
            logger.info(f"🆕 새로 수집된 페이지: {new_files:,}개")
        
        # 기존 + 신규 총합
        existing_files = len([f for f in os.listdir('enhanced_output') if f.endswith('.txt')])
        total_files = existing_files + new_files
        
        logger.info(f"📊 총 데이터량:")
        logger.info(f"   기존: {existing_files:,}개")
        logger.info(f"   신규: {new_files:,}개")
        logger.info(f"   총합: {total_files:,}개")
        
        # 권장사항
        if total_files >= 8000:
            logger.info("✅ 충분한 데이터 수집 완료 - RAG 임베딩 진행 가능")
        elif total_files >= 6000:
            logger.info("⚠️ 추가 크롤링 권장 - 목표치의 75% 수집")
        else:
            logger.info("❌ 추가 크롤링 필요 - 목표치 미달")
        
        return new_files
        
    except Exception as e:
        logger.error(f"❌ 결과 분석 오류: {e}")
        return 0

def main():
    """메인 실행 함수"""
    print("=" * 60)
    print("🎯 대진대학교 전략적 보완 크롤링 시스템")
    print("=" * 60)
    
    # 사전 검사
    if not pre_crawling_check():
        logger.error("❌ 사전 검사 실패 - 크롤링 중단")
        return False
    
    # 시간 추정
    estimated_time = estimate_crawling_time()
    
    # 사용자 확인
    print(f"\n⏱️ 예상 소요시간: {estimated_time:.1f}시간")
    print("📋 크롤링 전략:")
    print("   • 기존 5,118개 데이터 유지")
    print("   • 게시판 게시글 집중 수집")
    print("   • 도서관 페이지 최소 수집")
    print("   • 전자책 검색 페이지 제외")
    
    # 실행 확인 (자동 실행)
    print(f"\n🚀 크롤링을 자동으로 시작합니다...")
    print("   중단하려면 Ctrl+C를 누르세요.")
    
    # 크롤링 실행
    start_time = time.time()
    
    try:
        success = asyncio.run(run_strategic_crawling())
        
        if success:
            # 결과 분석
            new_files = post_crawling_analysis()
            
            elapsed_time = time.time() - start_time
            logger.info(f"⏱️ 총 소요시간: {elapsed_time/3600:.1f}시간")
            
            print("\n" + "=" * 60)
            print("✅ 전략적 크롤링 완료!")
            print(f"📊 새로 수집된 페이지: {new_files:,}개")
            print(f"⏱️ 소요시간: {elapsed_time/3600:.1f}시간")
            print("📁 결과 위치: strategic_output/")
            print("=" * 60)
            
            return True
        else:
            logger.error("❌ 크롤링 실행 실패")
            return False
            
    except KeyboardInterrupt:
        logger.info("⚠️ 사용자에 의해 중단됨")
        return False
    except Exception as e:
        logger.error(f"❌ 예상치 못한 오류: {e}")
        return False

if __name__ == "__main__":
    main()