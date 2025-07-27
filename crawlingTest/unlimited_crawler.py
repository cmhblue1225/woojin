#!/usr/bin/env python3
"""
시간 제한 없는 완전 크롤링 시스템
- 모든 대진대학교 웹사이트 완벽 수집
- 재시작 가능한 체크포인트 시스템
- 실시간 진행상황 저장
"""

import os
import time
import json
import asyncio
import aiohttp
import requests
from urllib.parse import urlparse, urljoin, parse_qs
from bs4 import BeautifulSoup
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict, deque
import hashlib
from datetime import datetime
import logging
import signal
import sys

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('unlimited_crawler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class UnlimitedCrawler:
    def __init__(self):
        # 고성능 설정 (M4 Pro 최대 활용)
        self.max_workers = 16
        self.max_concurrent_requests = 60
        self.max_selenium_instances = 8
        
        # 디렉토리 설정
        self.output_dir = "unlimited_crawling_output"
        self.checkpoint_file = "unlimited_crawler_checkpoint.json"
        self.state_file = "unlimited_crawler_state.json"
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 크롤링 상태
        self.visited = set()
        self.to_visit = deque()
        self.priority_queue = deque()
        self.saved_texts = []
        self.saved_urls = []
        self.url_depths = {}
        self.domain_stats = defaultdict(int)
        self.failed_urls = set()
        self.retry_count = defaultdict(int)
        
        # 크롤링 통계
        self.start_time = datetime.now()
        self.total_processed = 0
        self.total_saved = 0
        self.session_start = datetime.now()
        
        # 상태 저장 플래그
        self.should_stop = False
        self.checkpoint_interval = 100  # 100개마다 체크포인트 저장
        
        # 신호 처리 설정
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        # 대진대학교 모든 사이트 포함 (대폭 확장)
        self.comprehensive_seed_urls = [
            # 메인 대진대학교 사이트
            "https://www.daejin.ac.kr/",
            "https://www.daejin.ac.kr/sites/daejin/index.do",
            "https://www.daejin.ac.kr/daejin/index.do",
            
            # 대학 공지 및 뉴스
            "https://www.daejin.ac.kr/daejin/1135/subview.do",  # 공지사항
            "https://www.daejin.ac.kr/daejin/1139/subview.do",  # 일반소식
            "https://www.daejin.ac.kr/daejin/1140/subview.do",  # 학사공지
            "https://www.daejin.ac.kr/daejin/1141/subview.do",  # 행사안내
            "https://www.daejin.ac.kr/daejin/1142/subview.do",  # 채용정보
            
            # 대학 구조 페이지
            "https://www.daejin.ac.kr/daejin/877/subview.do",  # 상생교양대학
            "https://www.daejin.ac.kr/daejin/869/subview.do",  # 대순종학대학
            "https://www.daejin.ac.kr/daejin/870/subview.do",  # 인문예술대학
            "https://www.daejin.ac.kr/daejin/871/subview.do",  # 글로벌산업통상대학
            "https://www.daejin.ac.kr/daejin/872/subview.do",  # 공공인재대학
            "https://www.daejin.ac.kr/daejin/873/subview.do",  # 보건과학대학
            "https://www.daejin.ac.kr/daejin/874/subview.do",  # AI융합대학
            "https://www.daejin.ac.kr/daejin/875/subview.do",  # 공과대학
            "https://www.daejin.ac.kr/daejin/5566/subview.do", # 국제협력대학
            "https://www.daejin.ac.kr/daejin/876/subview.do",  # 미래평생교육융합대학
            
            # AI융합대학 (최우선)
            "https://ce.daejin.ac.kr/",
            "https://ce.daejin.ac.kr/main.php",
            "https://ce.daejin.ac.kr/bbs/board.php?bo_table=notice",
            "https://ce.daejin.ac.kr/bbs/board.php?bo_table=job",
            "https://ce.daejin.ac.kr/bbs/board.php?bo_table=community",
            "https://ce.daejin.ac.kr/bbs/board.php?bo_table=gallery",
            "https://ce.daejin.ac.kr/sub1/sub1_1.php",  # 학과소개
            "https://ce.daejin.ac.kr/sub1/sub1_2.php",  # 학과연혁
            "https://ce.daejin.ac.kr/sub2/sub2_1.php",  # 교수소개
            "https://ce.daejin.ac.kr/sub3/sub3_1.php",  # 교육과정
            "https://ce.daejin.ac.kr/sub4/sub4_1.php",  # 학생활동
            "https://ce.daejin.ac.kr/sub5/sub5_1.php",  # 취업현황
            "https://aidata.daejin.ac.kr/",
            "https://security.daejin.ac.kr/",
            
            # 인문예술대학
            "https://eng.daejin.ac.kr/",
            "https://history.daejin.ac.kr/",
            "https://literature.daejin.ac.kr/",
            "https://arte.daejin.ac.kr/",
            "https://design.daejin.ac.kr/",
            "https://djfilm.daejin.ac.kr/",
            "https://acting.daejin.ac.kr/",
            "https://music.daejin.ac.kr/",
            
            # 글로벌산업통상대학
            "https://economics.daejin.ac.kr/",
            "https://sm.daejin.ac.kr/",
            "https://intlbusiness.daejin.ac.kr/",
            "https://camde.daejin.ac.kr/",
            
            # 공공인재대학
            "https://law.daejin.ac.kr/",
            "https://pai.daejin.ac.kr/",
            "https://welfare.daejin.ac.kr/",
            "https://child.daejin.ac.kr/",
            "https://media.daejin.ac.kr/",
            
            # 보건과학대학
            "https://medical.daejin.ac.kr/",
            "https://nurse.daejin.ac.kr/",
            "https://sports.daejin.ac.kr/",
            "https://food.daejin.ac.kr/",
            "https://health.daejin.ac.kr/",
            
            # 공과대학
            "https://elec.daejin.ac.kr/",
            "https://cpe.daejin.ac.kr/",
            "https://arch.daejin.ac.kr/",
            "https://envir.daejin.ac.kr/",
            "https://ie.daejin.ac.kr/",
            "https://mech.daejin.ac.kr/",
            
            # 국제협력대학
            "https://korean.daejin.ac.kr/",
            
            # 중요 기관
            "https://admission.daejin.ac.kr/",
            "https://job.daejin.ac.kr/",
            "https://ctl.daejin.ac.kr/",
            "https://liberal.daejin.ac.kr/",
            "https://international.daejin.ac.kr/",
            "https://dormitory.daejin.ac.kr/",
            "https://rotc.daejin.ac.kr/",
            "https://counseling.daejin.ac.kr/",
            "https://tech.daejin.ac.kr/",  # 산학협력단
            "https://djss.daejin.ac.kr/",  # 대진지역상생센터
            "https://hcc.daejin.ac.kr/",   # 공동기기센터
            
            # 도서관 (제한적)
            "https://library.daejin.ac.kr/",
            "https://library.daejin.ac.kr/main_main.mir",
        ]
        
        # 도메인별 무제한 크롤링 전략
        self.unlimited_domain_strategies = {
            # 메인 사이트 - 매우 깊게
            'www.daejin.ac.kr': {'max_depth': 50, 'priority': 1000},
            
            # AI융합대학 - 최우선
            'ce.daejin.ac.kr': {'max_depth': 50, 'priority': 950},
            'aidata.daejin.ac.kr': {'max_depth': 40, 'priority': 900},
            'security.daejin.ac.kr': {'max_depth': 40, 'priority': 900},
            
            # 주요 학과 - 깊게
            'economics.daejin.ac.kr': {'max_depth': 35, 'priority': 800},
            'sm.daejin.ac.kr': {'max_depth': 35, 'priority': 800},
            'law.daejin.ac.kr': {'max_depth': 35, 'priority': 800},
            'media.daejin.ac.kr': {'max_depth': 35, 'priority': 800},
            'medical.daejin.ac.kr': {'max_depth': 35, 'priority': 800},
            'nurse.daejin.ac.kr': {'max_depth': 35, 'priority': 800},
            'eng.daejin.ac.kr': {'max_depth': 30, 'priority': 750},
            'history.daejin.ac.kr': {'max_depth': 30, 'priority': 750},
            'design.daejin.ac.kr': {'max_depth': 30, 'priority': 750},
            'elec.daejin.ac.kr': {'max_depth': 30, 'priority': 750},
            'arch.daejin.ac.kr': {'max_depth': 30, 'priority': 750},
            
            # 기타 학과 - 중간 깊이
            'default': {'max_depth': 25, 'priority': 500},
            
            # 도서관만 제한
            'library.daejin.ac.kr': {'max_depth': 5, 'priority': 100},
        }
        
        # 최고 우선순위 패턴
        self.ultra_high_priority_patterns = [
            (r'/bbs/.*/artclView\\.do', 200),      # 게시판 게시물
            (r'/ce/2518/subview\\.do\\?enc=', 195), # 컴공과 게시글
            (r'/bbs/.*/', 150),                     # 게시판 목록
            (r'/board/.*/', 140),                   # 게시판 관련
            (r'/notice/', 130),                     # 공지사항
            (r'/news/', 120),                       # 뉴스
            (r'/subview\\.do', 100),                # 서브페이지
            (r'/curriculum/', 90),                  # 교육과정
            (r'/professor/', 90),                   # 교수진
            (r'/faculty/', 90),                     # 교수진
            (r'/student/', 80),                     # 학생 관련
            (r'/admission/', 70),                   # 입학 관련
            (r'/employment/', 70),                  # 취업 관련
            (r'/research/', 60),                    # 연구 관련
        ]
        
        # 제외 패턴 (최소화)
        self.exclude_patterns = [
            r'\\.(pdf|doc|hwp|zip|exe|jpg|png|gif|mp4|avi)$',
            r'/download\\.do',
            r'groupware\\.daejin\\.ac\\.kr',
            r'webmail\\.daejin\\.ac\\.kr',
            r'sso\\.daejin\\.ac\\.kr/login',
            r'#none$',
            r'#this$',
            r'javascript:',
            r'mailto:',
            r'tel:',
        ]
        
        # 기존 상태 로드 시도
        self.load_checkpoint()

    def signal_handler(self, signum, frame):
        """신호 처리 (Ctrl+C 등)"""
        logger.info(f"\\n⚠️ 신호 {signum} 수신. 안전하게 종료 중...")
        self.should_stop = True
        self.save_checkpoint()

    def save_checkpoint(self):
        """체크포인트 저장"""
        checkpoint_data = {
            'visited': list(self.visited),
            'to_visit': list(self.to_visit),
            'priority_queue': list(self.priority_queue),
            'saved_urls': self.saved_urls,
            'url_depths': self.url_depths,
            'domain_stats': dict(self.domain_stats),
            'failed_urls': list(self.failed_urls),
            'retry_count': dict(self.retry_count),
            'total_processed': self.total_processed,
            'total_saved': self.total_saved,
            'session_start': self.session_start.isoformat(),
            'checkpoint_time': datetime.now().isoformat()
        }
        
        try:
            with open(self.checkpoint_file, 'w', encoding='utf-8') as f:
                json.dump(checkpoint_data, f, ensure_ascii=False, indent=2)
            logger.info(f"💾 체크포인트 저장: {self.total_saved}개 파일")
        except Exception as e:
            logger.error(f"❌ 체크포인트 저장 오류: {e}")

    def load_checkpoint(self):
        """체크포인트 로드"""
        if not os.path.exists(self.checkpoint_file):
            logger.info("🆕 새로운 크롤링 세션 시작")
            return
        
        try:
            with open(self.checkpoint_file, 'r', encoding='utf-8') as f:
                checkpoint_data = json.load(f)
            
            self.visited = set(checkpoint_data.get('visited', []))
            self.to_visit = deque(checkpoint_data.get('to_visit', []))
            self.priority_queue = deque(checkpoint_data.get('priority_queue', []))
            self.saved_urls = checkpoint_data.get('saved_urls', [])
            self.url_depths = checkpoint_data.get('url_depths', {})
            self.domain_stats = defaultdict(int, checkpoint_data.get('domain_stats', {}))
            self.failed_urls = set(checkpoint_data.get('failed_urls', []))
            self.retry_count = defaultdict(int, checkpoint_data.get('retry_count', {}))
            self.total_processed = checkpoint_data.get('total_processed', 0)
            self.total_saved = checkpoint_data.get('total_saved', 0)
            
            if 'session_start' in checkpoint_data:
                self.session_start = datetime.fromisoformat(checkpoint_data['session_start'])
            
            logger.info(f"🔄 체크포인트 로드: {self.total_saved}개 파일, {len(self.visited)}개 방문")
            
        except Exception as e:
            logger.error(f"❌ 체크포인트 로드 오류: {e}")
            logger.info("🆕 새로운 세션으로 시작")

    def should_crawl_url(self, url, depth):
        """URL 크롤링 여부 결정"""
        # 이미 방문했거나 실패한 URL
        if url in self.visited or url in self.failed_urls:
            return False
        
        # 재시도 횟수 초과
        if self.retry_count[url] >= 3:
            return False
        
        # 제외 패턴
        for pattern in self.exclude_patterns:
            if re.search(pattern, url, re.IGNORECASE):
                return False
        
        # 도메인 확인
        parsed = urlparse(url)
        domain = parsed.netloc
        
        # 대진대학교 도메인만 허용
        if 'daejin.ac.kr' not in domain:
            return False
        
        # 도메인별 깊이 제한
        strategy = self.unlimited_domain_strategies.get(domain, self.unlimited_domain_strategies['default'])
        if depth > strategy['max_depth']:
            return False
        
        return True

    def get_url_priority(self, url):
        """URL 우선순위 계산"""
        # 시드 URL은 최고 우선순위
        if url in self.comprehensive_seed_urls:
            return 2000
        
        # 패턴 기반 우선순위
        for pattern, priority in self.ultra_high_priority_patterns:
            if re.search(pattern, url):
                return priority + 1000  # 베이스 우선순위 추가
        
        # 도메인 기반 우선순위
        parsed = urlparse(url)
        domain = parsed.netloc
        strategy = self.unlimited_domain_strategies.get(domain, self.unlimited_domain_strategies['default'])
        
        return strategy['priority']

    async def crawl_with_selenium(self, url, depth=0):
        """Selenium을 사용한 크롤링 (안정성 강화)"""
        driver = None
        try:
            options = Options()
            options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--disable-extensions')
            options.add_argument('--disable-plugins')
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
            
            driver = webdriver.Chrome(options=options)
            driver.set_page_load_timeout(30)  # 타임아웃 증가
            
            driver.get(url)
            time.sleep(3)  # 로딩 대기 시간 증가
            
            # 페이지 내용 추출
            content = driver.page_source
            soup = BeautifulSoup(content, 'html.parser')
            
            # 텍스트 정제
            text_content = self.extract_clean_text(soup)
            
            # 링크 추출
            links = []
            for link in soup.find_all('a', href=True):
                href = link['href']
                full_url = urljoin(url, href)
                if self.should_crawl_url(full_url, depth + 1):
                    priority = self.get_url_priority(full_url)
                    links.append((full_url, priority, depth + 1))
            
            driver.quit()
            
            return {
                'url': url,
                'content': text_content,
                'links': links,
                'depth': depth,
                'domain': urlparse(url).netloc,
                'length': len(text_content),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Selenium 크롤링 오류 {url}: {e}")
            self.retry_count[url] += 1
            if self.retry_count[url] >= 3:
                self.failed_urls.add(url)
            
            if driver:
                try:
                    driver.quit()
                except:
                    pass
            return None

    def extract_clean_text(self, soup):
        """깔끔한 텍스트 추출"""
        # 불필요한 태그 제거
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
            tag.decompose()
        
        # 텍스트 추출 및 정제
        text = soup.get_text()
        lines = [line.strip() for line in text.splitlines()]
        text = '\\n'.join(line for line in lines if line and len(line) > 2)
        
        return text

    def save_page_content(self, page_data):
        """페이지 내용 저장"""
        if not page_data or len(page_data['content'].strip()) < 150:
            return False
        
        filename = f"unlimited_page_{self.total_saved:06d}.txt"
        filepath = os.path.join(self.output_dir, filename)
        
        content = f"[URL] {page_data['url']}\\n"
        content += f"[DEPTH] {page_data['depth']}\\n"
        content += f"[DOMAIN] {page_data['domain']}\\n"
        content += f"[TIMESTAMP] {page_data['timestamp']}\\n"
        content += f"[LENGTH] {page_data['length']}\\n\\n"
        content += page_data['content']
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            self.saved_urls.append(page_data['url'])
            self.domain_stats[page_data['domain']] += 1
            self.total_saved += 1
            
            logger.info(f"💾 저장: {filename} ({page_data['domain']}) - {page_data['length']}자")
            return True
            
        except Exception as e:
            logger.error(f"파일 저장 오류: {e}")
            return False

    async def run_unlimited_crawling(self):
        """무제한 크롤링 실행"""
        logger.info("🚀 무제한 완전 크롤링 시작")
        logger.info(f"🎯 시드 URL: {len(self.comprehensive_seed_urls)}개")
        logger.info(f"📊 기존 진행: {self.total_saved}개 저장됨")
        
        # 시드 URL 추가 (아직 방문하지 않은 것만)
        for url in self.comprehensive_seed_urls:
            if url not in self.visited:
                priority = self.get_url_priority(url)
                self.priority_queue.append((url, 0, priority))
        
        with ThreadPoolExecutor(max_workers=self.max_selenium_instances) as executor:
            while not self.should_stop and (self.priority_queue or self.to_visit):
                # 우선순위 큐에서 처리할 URL 선택
                current_batch = []
                
                # 우선순위 큐 우선 처리
                while self.priority_queue and len(current_batch) < self.max_selenium_instances:
                    url, depth, priority = self.priority_queue.popleft()
                    if url not in self.visited:
                        current_batch.append((url, depth, priority))
                
                # 일반 큐에서 추가
                while self.to_visit and len(current_batch) < self.max_selenium_instances:
                    url, depth, priority = self.to_visit.popleft()
                    if url not in self.visited:
                        current_batch.append((url, depth, priority))
                
                if not current_batch:
                    logger.info("📝 모든 URL 처리 완료")
                    break
                
                # 병렬 처리
                futures = []
                for url, depth, priority in current_batch:
                    if url not in self.visited:
                        future = executor.submit(asyncio.run, self.crawl_with_selenium(url, depth))
                        futures.append(future)
                        self.visited.add(url)
                        self.total_processed += 1
                
                # 결과 처리
                for future in as_completed(futures):
                    try:
                        page_data = future.result()
                        if page_data:
                            # 페이지 저장
                            self.save_page_content(page_data)
                            
                            # 새 링크를 우선순위에 따라 분류
                            for link_url, link_priority, link_depth in page_data['links']:
                                if link_url not in self.visited and link_url not in self.failed_urls:
                                    if link_priority >= 1000:  # 높은 우선순위
                                        self.priority_queue.append((link_url, link_depth, link_priority))
                                    else:  # 일반 우선순위
                                        self.to_visit.append((link_url, link_depth, link_priority))
                    
                    except Exception as e:
                        logger.error(f"페이지 처리 오류: {e}")
                
                # 주기적 체크포인트 저장
                if self.total_saved % self.checkpoint_interval == 0 and self.total_saved > 0:
                    self.save_checkpoint()
                    
                # 주기적 상태 보고
                if self.total_processed % 50 == 0:
                    elapsed = datetime.now() - self.session_start
                    logger.info(f"📈 진행상황: 처리 {self.total_processed:,}개, 저장 {self.total_saved:,}개")
                    logger.info(f"🌐 도메인별 수집: {dict(list(self.domain_stats.items())[:5])}...")
                    logger.info(f"📋 대기 중: 우선순위 {len(self.priority_queue)}개, 일반 {len(self.to_visit)}개")
                    logger.info(f"⏱️ 경과 시간: {elapsed}")
                
                # 속도 조절
                await asyncio.sleep(0.3)
        
        # 최종 체크포인트 저장
        self.save_checkpoint()
        
        # 최종 통계
        total_elapsed = datetime.now() - self.session_start
        logger.info("✅ 무제한 크롤링 완료")
        logger.info(f"📊 총 처리: {self.total_processed:,}개 URL")
        logger.info(f"💾 총 저장: {self.total_saved:,}개 페이지")
        logger.info(f"🌐 도메인별 통계: {dict(self.domain_stats)}")
        logger.info(f"⏱️ 총 소요시간: {total_elapsed}")
        logger.info(f"📁 결과 위치: {self.output_dir}/")
        
        return self.total_saved

if __name__ == "__main__":
    crawler = UnlimitedCrawler()
    try:
        result = asyncio.run(crawler.run_unlimited_crawling())
        print(f"\\n🎉 크롤링 완료: {result:,}개 페이지 수집")
    except KeyboardInterrupt:
        print("\\n⚠️ 사용자에 의해 중단됨")
        print("🔄 체크포인트가 저장되어 재시작 가능합니다")