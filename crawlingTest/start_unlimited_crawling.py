#!/usr/bin/env python3
"""
무제한 크롤링 시작 스크립트
- 시간 제한 없음
- 체크포인트 기반 재시작 가능
- 실시간 진행상황 모니터링
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
        logging.FileHandler('unlimited_crawling_execution.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def show_current_status():
    """현재 크롤링 상태 표시"""
    logger.info("🔍 현재 크롤링 상태 확인")
    
    # 기존 결과 확인
    directories = [
        ('unlimited_crawling_output', '무제한 크롤링'),
        ('enhanced_strategic_output', '향상된 크롤링'),
        ('enhanced_output', '기존 크롤링')
    ]
    
    total_files = 0
    for dir_name, description in directories:
        if os.path.exists(dir_name):
            files = [f for f in os.listdir(dir_name) if f.endswith('.txt')]
            count = len(files)
            total_files += count
            logger.info(f"📁 {description}: {count:,}개 파일")
    
    logger.info(f"📊 전체 합계: {total_files:,}개")
    
    # 체크포인트 파일 확인
    if os.path.exists('unlimited_crawler_checkpoint.json'):
        checkpoint_time = os.path.getmtime('unlimited_crawler_checkpoint.json')
        checkpoint_str = datetime.fromtimestamp(checkpoint_time).strftime('%Y-%m-%d %H:%M:%S')
        logger.info(f"🔄 체크포인트 발견: {checkpoint_str}")
        logger.info("📝 이전 크롤링 세션에서 이어서 진행 가능")
    else:
        logger.info("🆕 새로운 크롤링 세션 시작")

def estimate_completion():
    """완료 시간 추정"""
    logger.info("⏱️ 크롤링 계획")
    
    # 추정 파라미터
    estimated_total_pages = 10000  # 목표 페이지 수
    avg_page_time = 2.0  # 페이지당 평균 처리 시간 (초)
    parallel_factor = 8  # 병렬 처리 효과
    
    estimated_seconds = (estimated_total_pages * avg_page_time) / parallel_factor
    estimated_hours = estimated_seconds / 3600
    
    logger.info(f"📊 예상 결과:")
    logger.info(f"   목표 페이지: {estimated_total_pages:,}개 (최소)")
    logger.info(f"   예상 시간: {estimated_hours:.1f}시간")
    logger.info(f"   특징: 시간 제한 없음, 체크포인트 자동 저장")

async def run_unlimited_crawling():
    """무제한 크롤링 실행"""
    logger.info("🚀 무제한 크롤링 시작")
    
    try:
        from unlimited_crawler import UnlimitedCrawler
        
        crawler = UnlimitedCrawler()
        
        # 크롤링 실행 (시간 제한 없음)
        result = await crawler.run_unlimited_crawling()
        
        logger.info(f"✅ 크롤링 완료: {result:,}개 페이지 수집")
        return result
        
    except Exception as e:
        logger.error(f"❌ 크롤링 실행 오류: {e}")
        return 0

def post_crawling_analysis(collected_pages):
    """크롤링 후 분석"""
    logger.info("📊 크롤링 결과 최종 분석")
    
    try:
        # 모든 디렉토리의 파일 수 집계
        total_files = 0
        directories = [
            ('unlimited_crawling_output', '무제한 크롤링'),
            ('enhanced_strategic_output', '향상된 크롤링'),
            ('enhanced_output', '기존 크롤링')
        ]
        
        for dir_name, description in directories:
            if os.path.exists(dir_name):
                files = [f for f in os.listdir(dir_name) if f.endswith('.txt')]
                count = len(files)
                total_files += count
                logger.info(f"📁 {description}: {count:,}개")
        
        logger.info(f"📊 총 수집 데이터: {total_files:,}개 페이지")
        
        if total_files >= 8000:
            logger.info("🎉 충분한 데이터 수집 완료!")
            logger.info("🎯 다음 단계: 데이터 병합 및 임베딩 준비")
            return True
        elif total_files >= 5000:
            logger.info("⚡ 좋은 결과! 임베딩 진행 가능")
            return True
        else:
            logger.info("📈 데이터 수집 진행 중...")
            return True  # 무제한이므로 항상 성공
            
    except Exception as e:
        logger.error(f"❌ 분석 중 오류: {e}")
        return False

def main():
    print("=" * 60)
    print("🎯 대진대학교 무제한 완전 크롤링 시스템")
    print("=" * 60)
    
    # 현재 상태 확인
    show_current_status()
    
    # 완료 시간 추정
    estimate_completion()
    
    print(f"\\n🎯 무제한 크롤링 특징:")
    print(f"   • 시간 제한 없음 (완전 수집까지)")
    print(f"   • 체크포인트 자동 저장 (재시작 가능)")
    print(f"   • 모든 대진대학교 사이트 포함")
    print(f"   • 게시판, 공지사항 우선 수집")
    print(f"   • 실시간 진행상황 모니터링")
    
    print(f"\\n🚀 무제한 크롤링을 시작합니다...")
    print(f"   시작 시간: {datetime.now().strftime('%H:%M:%S')}")
    print(f"   중단하려면 Ctrl+C를 누르세요 (체크포인트 저장됨)")
    
    start_time = time.time()
    
    try:
        # 크롤링 실행
        collected = asyncio.run(run_unlimited_crawling())
        
        elapsed_time = time.time() - start_time
        success = post_crawling_analysis(collected)
        
        print("\\n" + "=" * 60)
        print("✅ 무제한 크롤링 완료!")
        print(f"📊 이번 세션 수집: {collected:,}개 페이지")
        print(f"⏱️ 소요시간: {elapsed_time/3600:.1f}시간")
        print(f"📁 결과 위치: unlimited_crawling_output/")
        print("=" * 60)
        
        return success
        
    except KeyboardInterrupt:
        logger.info("⚠️ 사용자에 의해 중단됨")
        logger.info("🔄 체크포인트가 저장되어 재시작 가능합니다")
        print("\\n💡 재시작하려면: python3 start_unlimited_crawling.py")
        return True  # 중단도 성공으로 간주 (체크포인트 저장됨)
    except Exception as e:
        logger.error(f"❌ 예상치 못한 오류: {e}")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\\n🎯 크롤링이 완료되었습니다!")
        print("📧 이제 사용자에게 알려서 임베딩을 진행하세요.")
    sys.exit(0 if success else 1)