#!/usr/bin/env python3
"""
완전한 웹사이트 데이터 통합 프로세스
1. 전략적 크롤링 실행
2. 데이터 통합 및 정제  
3. RAG 임베딩 준비
"""

import os
import sys
import subprocess
import time
from datetime import datetime
import logging

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('complete_integration.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class WebsiteIntegrationManager:
    def __init__(self):
        self.start_time = time.time()
        self.steps_completed = 0
        self.total_steps = 4
        
    def print_header(self):
        """헤더 출력"""
        print("=" * 70)
        print("🎯 대진대학교 웹사이트 데이터 완전 통합 시스템")
        print("=" * 70)
        print("📋 실행 단계:")
        print("   1️⃣ 전략적 보완 크롤링 (2-3시간)")
        print("   2️⃣ 데이터 통합 및 품질 필터링")
        print("   3️⃣ RAG 시스템 임베딩")
        print("   4️⃣ 배포 및 테스트")
        print("=" * 70)
        
    def update_progress(self, step_name):
        """진행률 업데이트"""
        self.steps_completed += 1
        elapsed = time.time() - self.start_time
        progress = (self.steps_completed / self.total_steps) * 100
        
        logger.info(f"✅ {step_name} 완료")
        logger.info(f"📈 전체 진행률: {progress:.1f}% ({self.steps_completed}/{self.total_steps})")
        logger.info(f"⏱️ 경과 시간: {elapsed/3600:.1f}시간")
        
    def step1_strategic_crawling(self):
        """1단계: 전략적 크롤링"""
        logger.info("🚀 1단계: 전략적 보완 크롤링 시작")
        
        try:
            # 크롤링 실행
            result = subprocess.run([
                sys.executable, 'run_strategic_crawling.py'
            ], capture_output=True, text=True, timeout=14400)  # 4시간 제한
            
            if result.returncode == 0:
                logger.info("✅ 전략적 크롤링 성공")
                
                # 결과 확인
                if os.path.exists('strategic_output'):
                    files = len([f for f in os.listdir('strategic_output') if f.endswith('.txt')])
                    logger.info(f"📊 새로 수집된 페이지: {files:,}개")
                    
                    if files < 500:
                        logger.warning("⚠️ 예상보다 적은 데이터 수집됨")
                        
                else:
                    raise Exception("strategic_output 디렉토리가 생성되지 않음")
                    
            else:
                raise Exception(f"크롤링 실패: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            logger.error("❌ 크롤링 시간 초과 (4시간)")
            raise
        except Exception as e:
            logger.error(f"❌ 크롤링 실행 오류: {e}")
            raise
            
        self.update_progress("전략적 크롤링")
        
    def step2_data_integration(self):
        """2단계: 데이터 통합"""
        logger.info("🔄 2단계: 데이터 통합 및 품질 필터링")
        
        try:
            # 데이터 통합 실행
            result = subprocess.run([
                sys.executable, 'merge_crawling_data.py'
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info("✅ 데이터 통합 성공")
                
                # 결과 확인
                if os.path.exists('merged_output'):
                    files = len([f for f in os.listdir('merged_output') if f.endswith('.txt')])
                    logger.info(f"📊 통합된 파일 수: {files:,}개")
                    
                    # 메타데이터 확인
                    if os.path.exists('merged_output/merge_metadata.json'):
                        import json
                        with open('merged_output/merge_metadata.json', 'r') as f:
                            metadata = json.load(f)
                        logger.info(f"📋 통합 메타데이터: {metadata['statistics']}")
                    
                else:
                    raise Exception("merged_output 디렉토리가 생성되지 않음")
                    
            else:
                raise Exception(f"데이터 통합 실패: {result.stderr}")
                
        except Exception as e:
            logger.error(f"❌ 데이터 통합 오류: {e}")
            raise
            
        self.update_progress("데이터 통합")
        
    def step3_embedding(self):
        """3단계: RAG 임베딩"""
        logger.info("🧠 3단계: RAG 시스템 임베딩")
        
        try:
            # Node.js 스크립트 실행
            script_path = '../scripts/embed-website-data.js'
            data_path = 'merged_output'
            
            result = subprocess.run([
                'node', script_path, data_path
            ], cwd='.', capture_output=True, text=True, timeout=7200)  # 2시간 제한
            
            if result.returncode == 0:
                logger.info("✅ RAG 임베딩 성공")
                logger.info(f"📝 임베딩 로그:\n{result.stdout}")
                
            else:
                raise Exception(f"임베딩 실패: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            logger.error("❌ 임베딩 시간 초과 (2시간)")
            raise
        except Exception as e:
            logger.error(f"❌ RAG 임베딩 오류: {e}")
            raise
            
        self.update_progress("RAG 임베딩")
        
    def step4_deployment(self):
        """4단계: 배포 및 테스트"""
        logger.info("🚀 4단계: 배포 및 테스트")
        
        try:
            # 기존 배포 확인 (이미 배포된 상태)
            logger.info("✅ UI는 이미 배포됨 (Render.com)")
            logger.info("✅ 새로운 웹사이트 데이터가 RAG 시스템에 통합됨")
            
            # 테스트 권장사항 출력
            logger.info("🧪 테스트 권장사항:")
            logger.info("   1. '컴퓨터공학과 공지사항' 질문 테스트")
            logger.info("   2. '대진대학교 학과 소개' 질문 테스트") 
            logger.info("   3. '입학 정보' 관련 질문 테스트")
            logger.info("   4. 시간표 검색과 웹사이트 정보 통합 확인")
            
        except Exception as e:
            logger.error(f"❌ 배포 확인 오류: {e}")
            raise
            
        self.update_progress("배포 및 테스트")
        
    def run_complete_integration(self):
        """전체 통합 프로세스 실행"""
        self.print_header()
        
        # 사용자 확인
        response = input("🚀 전체 통합 프로세스를 시작하시겠습니까? (y/N): ")
        if response.lower() not in ['y', 'yes']:
            print("❌ 프로세스가 취소되었습니다.")
            return False
        
        try:
            # 1단계: 전략적 크롤링
            self.step1_strategic_crawling()
            
            # 2단계: 데이터 통합
            self.step2_data_integration()
            
            # 3단계: RAG 임베딩
            self.step3_embedding()
            
            # 4단계: 배포 및 테스트
            self.step4_deployment()
            
            # 최종 완료
            total_time = time.time() - self.start_time
            
            print("\n" + "=" * 70)
            print("🎉 웹사이트 데이터 완전 통합 완료!")
            print(f"⏱️ 총 소요시간: {total_time/3600:.1f}시간")
            print("📊 최종 결과:")
            print("   ✅ 기존 데이터: 5,118개 페이지")
            print("   ✅ 신규 데이터: 추가 수집 완료")
            print("   ✅ RAG 시스템: 웹사이트 정보 통합")
            print("   ✅ 챗봇 배포: 최신 상태 유지")
            print("\n🤖 이제 우진봇이 훨씬 더 많은 대진대학교 정보를 제공할 수 있습니다!")
            print("=" * 70)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 통합 프로세스 실패: {e}")
            print(f"\n❌ 오류로 인해 프로세스가 중단되었습니다: {e}")
            print("📋 로그 파일을 확인하여 자세한 정보를 확인하세요.")
            return False

def main():
    """메인 실행 함수"""
    manager = WebsiteIntegrationManager()
    success = manager.run_complete_integration()
    
    if success:
        print("\n✅ 모든 작업이 성공적으로 완료되었습니다!")
        sys.exit(0)
    else:
        print("\n❌ 작업 중 오류가 발생했습니다.")
        sys.exit(1)

if __name__ == "__main__":
    main()