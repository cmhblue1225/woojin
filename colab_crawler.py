#!/usr/bin/env python3
"""
Google Colab용 대진대학교 확장 크롤링 시스템
- 기존 20,231개 페이지와 중복 방지
- Google Drive 자동 저장
- 중단 후 재시작 가능한 체크포인트 시스템
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

# Google Colab/Drive 연동
try:
    from google.colab import drive, files
    COLAB_ENV = True
    print("🔗 Google Colab 환경 감지됨")
except ImportError:
    COLAB_ENV = False
    print("💻 로컬 환경에서 실행 중")

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('colab_crawler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ColabAdvancedCrawler:
    def __init__(self):
        # Colab 최적화 설정
        self.max_workers = 8 if COLAB_ENV else 4
        self.max_concurrent_requests = 30 if COLAB_ENV else 15
        self.max_selenium_instances = 4 if COLAB_ENV else 2
        
        # 저장 경로 설정
        if COLAB_ENV:
            # Google Drive 마운트
            drive.mount('/content/drive')
            self.base_path = '/content/drive/MyDrive/daejin_crawling'
            os.makedirs(self.base_path, exist_ok=True)
        else:
            self.base_path = './colab_crawling_output'
            
        self.output_dir = os.path.join(self.base_path, "new_crawling_output")
        self.checkpoint_file = os.path.join(self.base_path, "colab_crawler_checkpoint.json")
        self.visited_urls_file = os.path.join(self.base_path, "existing_urls.json")
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 크롤링 상태
        self.visited = set()
        self.existing_urls = set()  # 기존 크롤링된 URL들
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
        self.checkpoint_interval = 50  # 50개마다 체크포인트 저장
        
        # 신호 처리 설정
        if not COLAB_ENV:
            signal.signal(signal.SIGINT, self.signal_handler)
            signal.signal(signal.SIGTERM, self.signal_handler)
        
        # 기존 URL 로드 (중복 방지)
        self.load_existing_urls()
        
        # 확장된 시드 URL (기존과 다른 새로운 경로 중심)
        self.new_exploration_seeds = [
            # 깊은 탐색용 새로운 시드
            "https://www.daejin.ac.kr/sitemap/sitemap.do",  # 사이트맵
            "https://www.daejin.ac.kr/daejin/search/unifiedSearch.do",  # 통합검색
            
            # 각 학과의 깊은 메뉴들
            "https://ce.daejin.ac.kr/sub6/sub6_1.php",  # 컴공과 자료실
            "https://ce.daejin.ac.kr/sub7/sub7_1.php",  # 컴공과 커뮤니티
            "https://aidata.daejin.ac.kr/board/list",    # AI데이터사이언스과 게시판
            "https://security.daejin.ac.kr/board/list",  # 정보보안과 게시판
            
            # 영어 버전 사이트들
            "https://eng.daejin.ac.kr/sub/sub6_1.php",
            "https://history.daejin.ac.kr/sub/sub5_1.php",
            "https://literature.daejin.ac.kr/sub/sub4_1.php",
            
            # 대학원 및 특수 과정
            "https://www.daejin.ac.kr/grad/index.do",
            "https://www.daejin.ac.kr/mba/index.do",
            "https://www.daejin.ac.kr/special/index.do",
            
            # 연구기관
            "https://www.daejin.ac.kr/research/index.do",
            "https://tech.daejin.ac.kr/tech/index.do",
            
            # 부설기관들의 깊은 메뉴
            "https://admission.daejin.ac.kr/admission/notice/list.do",
            "https://job.daejin.ac.kr/job/notice/list.do",
            "https://ctl.daejin.ac.kr/ctl/notice/list.do",
            "https://international.daejin.ac.kr/international/notice/list.do",
            
            # 모바일 버전 (다른 정보 제공 가능)
            "https://m.daejin.ac.kr/",
            
            # RSS 및 API 엔드포인트들
            "https://www.daejin.ac.kr/daejin/rss.do",
            
            # 특별 프로그램들
            "https://rotc.daejin.ac.kr/rotc/program/list.do",
            "https://counseling.daejin.ac.kr/counseling/program/list.do",
            
            # 도서관의 깊은 메뉴들
            "https://library.daejin.ac.kr/search/search.mir",
            "https://library.daejin.ac.kr/info/info.mir",
            
            # 기숙사 상세 정보
            "https://dormitory.daejin.ac.kr/dormitory/facility/list.do",
            "https://dormitory.daejin.ac.kr/dormitory/notice/list.do",
        ]
        
        # 새로운 탐색 전략 (기존과 겹치지 않는 영역 집중)
        self.new_exploration_strategies = {
            # 메인 사이트의 미탐색 영역 집중
            'www.daejin.ac.kr': {'max_depth': 60, 'priority': 1000},
            
            # 기존에 상대적으로 적게 크롤링된 도메인들 우선
            'semice.daejin.ac.kr': {'max_depth': 50, 'priority': 950},  # 반도체공학과
            'id.daejin.ac.kr': {'max_depth': 50, 'priority': 940},      # 산업디자인과
            'food.daejin.ac.kr': {'max_depth': 45, 'priority': 930},    # 식품영양학과
            'health.daejin.ac.kr': {'max_depth': 45, 'priority': 920},  # 보건관리학과
            'envir.daejin.ac.kr': {'max_depth': 45, 'priority': 910},   # 환경공학과
            'mech.daejin.ac.kr': {'max_depth': 45, 'priority': 900},    # 기계공학과
            'child.daejin.ac.kr': {'max_depth': 40, 'priority': 890},   # 아동학과
            'welfare.daejin.ac.kr': {'max_depth': 40, 'priority': 880}, # 사회복지학과
            'camde.daejin.ac.kr': {'max_depth': 40, 'priority': 870},   # 문화콘텐츠학과
            'korean.daejin.ac.kr': {'max_depth': 40, 'priority': 860},  # 한국어교육과
            
            # 새로운 패턴 탐색
            'default': {'max_depth': 35, 'priority': 500},
            
            # 도서관은 여전히 제한
            'library.daejin.ac.kr': {'max_depth': 8, 'priority': 200},
        }
        
        # 새로운 고우선순위 패턴 (기존과 다른 패턴 추가)
        self.new_priority_patterns = [
            (r'/program/', 200),                        # 프로그램 정보
            (r'/facility/', 190),                       # 시설 정보
            (r'/equipment/', 180),                      # 장비/시설
            (r'/lab/', 170),                           # 연구실 정보
            (r'/research/', 160),                      # 연구 관련
            (r'/publication/', 150),                   # 출판물/논문
            (r'/seminar/', 140),                       # 세미나/특강
            (r'/conference/', 135),                    # 학술대회
            (r'/workshop/', 130),                      # 워크샵
            (r'/competition/', 125),                   # 경진대회
            (r'/award/', 120),                         # 수상내역
            (r'/achievement/', 115),                   # 성과/업적
            (r'/alumni/', 110),                        # 동문/졸업생
            (r'/industry/', 105),                      # 산학협력
            (r'/cooperation/', 100),                   # 협력사업
            (r'/exchange/', 95),                       # 교환/교류
            (r'/international/', 90),                  # 국제화
            (r'/global/', 85),                         # 글로벌
            (r'/partnership/', 80),                    # 파트너십
            (r'/mou/', 75),                           # 업무협약
        ]
        
        # 기존 제외 패턴에 새로운 패턴 추가
        self.exclude_patterns = [
            r'\\.(pdf|doc|hwp|zip|exe|jpg|png|gif|mp4|avi|ppt|xls)$',
            r'/download\\.do',
            r'/file/',
            r'/upload/',
            r'groupware\\.daejin\\.ac\\.kr',
            r'webmail\\.daejin\\.ac\\.kr',
            r'sso\\.daejin\\.ac\\.kr/login',
            r'#none$',
            r'#this$',
            r'javascript:',
            r'mailto:',
            r'tel:',
            r'/admin/',           # 관리자 페이지
            r'/private/',         # 비공개 페이지
            r'/temp/',           # 임시 페이지
            r'/test/',           # 테스트 페이지
        ]
        
        # 기존 상태 로드 시도
        self.load_checkpoint()

    def load_existing_urls(self):
        """기존 크롤링된 URL 목록 로드하여 중복 방지"""
        logger.info("🔍 기존 크롤링 URL 분석 중...")
        
        # 기존 크롤링 결과에서 URL 추출 (로컬에서 생성한 파일이 있는 경우)
        existing_crawling_paths = [
            "/Users/minhyuk/Desktop/우진봇/crawlingTest/unlimited_crawling_output",
            "/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_output",
            "/Users/minhyuk/Desktop/우진봇/crawlingTest/enhanced_strategic_output"
        ]
        
        url_count = 0
        for path in existing_crawling_paths:
            if os.path.exists(path):
                try:
                    for filename in os.listdir(path):
                        if filename.endswith('.txt'):
                            filepath = os.path.join(path, filename)
                            with open(filepath, 'r', encoding='utf-8') as f:
                                lines = f.readlines()
                                if lines and lines[0].startswith('[URL]'):
                                    url = lines[0].replace('[URL]', '').strip()
                                    self.existing_urls.add(url)
                                    url_count += 1
                except Exception as e:
                    logger.warning(f"기존 URL 로드 오류 {path}: {e}")
        
        # 체크포인트에서 visited URL 로드
        if os.path.exists(self.visited_urls_file):
            try:
                with open(self.visited_urls_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    additional_urls = set(data.get('urls', []))
                    self.existing_urls.update(additional_urls)
                    url_count += len(additional_urls)
            except Exception as e:
                logger.warning(f"기존 URL 파일 로드 오류: {e}")
        
        logger.info(f"📊 기존 크롤링 URL: {url_count:,}개 (중복 제거 후: {len(self.existing_urls):,}개)")
        
        # 기존 URL을 파일로 저장 (백업 및 공유용)
        try:
            with open(self.visited_urls_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'total_count': len(self.existing_urls),
                    'last_updated': datetime.now().isoformat(),
                    'urls': list(self.existing_urls)
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"기존 URL 저장 오류: {e}")

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
            'checkpoint_time': datetime.now().isoformat(),
            'existing_urls_count': len(self.existing_urls)
        }
        
        try:
            with open(self.checkpoint_file, 'w', encoding='utf-8') as f:
                json.dump(checkpoint_data, f, ensure_ascii=False, indent=2)
            logger.info(f"💾 체크포인트 저장: {self.total_saved}개 신규 파일")
        except Exception as e:
            logger.error(f"❌ 체크포인트 저장 오류: {e}")

    def load_checkpoint(self):
        """체크포인트 로드"""
        if not os.path.exists(self.checkpoint_file):
            logger.info("🆕 새로운 확장 크롤링 세션 시작")
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
            
            logger.info(f"🔄 체크포인트 로드: {self.total_saved}개 신규 파일, {len(self.visited)}개 방문")
            
        except Exception as e:
            logger.error(f"❌ 체크포인트 로드 오류: {e}")
            logger.info("🆕 새로운 세션으로 시작")

    def is_new_url(self, url):
        """새로운 URL인지 확인 (기존 크롤링과 중복 방지)"""
        return url not in self.existing_urls and url not in self.visited

    def should_crawl_url(self, url, depth):
        """URL 크롤링 여부 결정 (기존 로직 + 중복 방지)"""
        # 기존 크롤링된 URL이면 스킵
        if not self.is_new_url(url):
            return False
            
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
        strategy = self.new_exploration_strategies.get(domain, self.new_exploration_strategies['default'])
        if depth > strategy['max_depth']:
            return False
        
        return True

    def get_url_priority(self, url):
        """URL 우선순위 계산"""
        # 시드 URL은 최고 우선순위
        if url in self.new_exploration_seeds:
            return 2000
        
        # 새로운 패턴 기반 우선순위
        for pattern, priority in self.new_priority_patterns:
            if re.search(pattern, url):
                return priority + 1000  # 베이스 우선순위 추가
        
        # 도메인 기반 우선순위
        parsed = urlparse(url)
        domain = parsed.netloc
        strategy = self.new_exploration_strategies.get(domain, self.new_exploration_strategies['default'])
        
        return strategy['priority']

    async def crawl_with_selenium(self, url, depth=0):
        """Selenium을 사용한 크롤링 (Colab 최적화)"""
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
            options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')
            
            # Colab 환경에서는 Chrome 경로 명시
            if COLAB_ENV:
                options.binary_location = '/usr/bin/google-chrome'
                
            driver = webdriver.Chrome(options=options)
            driver.set_page_load_timeout(25)
            
            driver.get(url)
            time.sleep(2)  # 로딩 대기
            
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
        if not page_data or len(page_data['content'].strip()) < 200:  # 더 엄격한 기준
            return False
        
        filename = f"new_page_{self.total_saved:06d}.txt"
        filepath = os.path.join(self.output_dir, filename)
        
        content = f"[URL] {page_data['url']}\\n"
        content += f"[DEPTH] {page_data['depth']}\\n"
        content += f"[DOMAIN] {page_data['domain']}\\n"
        content += f"[TIMESTAMP] {page_data['timestamp']}\\n"
        content += f"[LENGTH] {page_data['length']}\\n"
        content += f"[NEW_CRAWLING] true\\n\\n"  # 신규 크롤링 표시
        content += page_data['content']
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            self.saved_urls.append(page_data['url'])
            self.domain_stats[page_data['domain']] += 1
            self.total_saved += 1
            
            logger.info(f"💾 신규 저장: {filename} ({page_data['domain']}) - {page_data['length']}자")
            return True
            
        except Exception as e:
            logger.error(f"파일 저장 오류: {e}")
            return False

    async def run_extended_crawling(self):
        """확장 크롤링 실행 (기존과 중복되지 않는 새로운 페이지만)"""
        logger.info("🚀 확장 크롤링 시작 (기존 20,231개 페이지와 중복 방지)")
        logger.info(f"🎯 새로운 시드 URL: {len(self.new_exploration_seeds)}개")
        logger.info(f"📊 기존 진행: {self.total_saved}개 신규 저장됨")
        logger.info(f"🔍 중복 방지: {len(self.existing_urls):,}개 기존 URL 제외")
        
        # 새로운 시드 URL 추가 (아직 방문하지 않은 것만)
        for url in self.new_exploration_seeds:
            if self.is_new_url(url):
                priority = self.get_url_priority(url)
                self.priority_queue.append((url, 0, priority))
                logger.info(f"🌱 새로운 시드 추가: {url}")
        
        with ThreadPoolExecutor(max_workers=self.max_selenium_instances) as executor:
            while not self.should_stop and (self.priority_queue or self.to_visit):
                # 우선순위 큐에서 처리할 URL 선택
                current_batch = []
                
                # 우선순위 큐 우선 처리
                while self.priority_queue and len(current_batch) < self.max_selenium_instances:
                    url, depth, priority = self.priority_queue.popleft()
                    if self.is_new_url(url):
                        current_batch.append((url, depth, priority))
                
                # 일반 큐에서 추가
                while self.to_visit and len(current_batch) < self.max_selenium_instances:
                    url, depth, priority = self.to_visit.popleft()
                    if self.is_new_url(url):
                        current_batch.append((url, depth, priority))
                
                if not current_batch:
                    logger.info("📝 모든 신규 URL 처리 완료")
                    break
                
                # 병렬 처리
                futures = []
                for url, depth, priority in current_batch:
                    if self.is_new_url(url):
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
                            
                            # 새 링크를 우선순위에 따라 분류 (신규만)
                            for link_url, link_priority, link_depth in page_data['links']:
                                if self.is_new_url(link_url) and link_url not in self.failed_urls:
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
                if self.total_processed % 25 == 0:
                    elapsed = datetime.now() - self.session_start
                    logger.info(f"📈 진행상황: 처리 {self.total_processed:,}개, 신규 저장 {self.total_saved:,}개")
                    logger.info(f"🌐 도메인별 신규: {dict(list(self.domain_stats.items())[:5])}...")
                    logger.info(f"📋 대기 중: 우선순위 {len(self.priority_queue)}개, 일반 {len(self.to_visit)}개")
                    logger.info(f"⏱️ 경과 시간: {elapsed}")
                
                # 속도 조절
                await asyncio.sleep(0.5)  # Colab에서는 더 안전하게
        
        # 최종 체크포인트 저장
        self.save_checkpoint()
        
        # 최종 통계
        total_elapsed = datetime.now() - self.session_start
        logger.info("✅ 확장 크롤링 완료")
        logger.info(f"📊 총 처리: {self.total_processed:,}개 신규 URL")
        logger.info(f"💾 총 저장: {self.total_saved:,}개 신규 페이지")
        logger.info(f"🌐 도메인별 통계: {dict(self.domain_stats)}")
        logger.info(f"⏱️ 총 소요시간: {total_elapsed}")
        logger.info(f"📁 결과 위치: {self.output_dir}/")
        
        # Colab에서는 압축 파일 생성
        if COLAB_ENV and self.total_saved > 0:
            self.create_download_archive()
        
        return self.total_saved

    def create_download_archive(self):
        """Colab에서 다운로드용 압축 파일 생성"""
        try:
            import zipfile
            import shutil
            
            archive_name = f"daejin_new_crawling_{self.total_saved}pages_{datetime.now().strftime('%Y%m%d_%H%M')}.zip"
            archive_path = os.path.join(self.base_path, archive_name)
            
            logger.info(f"📦 압축 파일 생성 중: {archive_name}")
            
            with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 크롤링 결과 파일들
                for filename in os.listdir(self.output_dir):
                    if filename.endswith('.txt'):
                        file_path = os.path.join(self.output_dir, filename)
                        zipf.write(file_path, f"new_crawling_output/{filename}")
                
                # 체크포인트 및 메타데이터
                zipf.write(self.checkpoint_file, "colab_crawler_checkpoint.json")
                zipf.write(self.visited_urls_file, "existing_urls.json")
                
                # 통계 리포트 생성
                report = {
                    "crawling_summary": {
                        "total_new_pages": self.total_saved,
                        "total_processed_urls": self.total_processed,
                        "domains_crawled": dict(self.domain_stats),
                        "session_duration": str(datetime.now() - self.session_start),
                        "completion_time": datetime.now().isoformat()
                    }
                }
                
                report_path = os.path.join(self.base_path, "crawling_report.json")
                with open(report_path, 'w', encoding='utf-8') as f:
                    json.dump(report, f, ensure_ascii=False, indent=2)
                zipf.write(report_path, "crawling_report.json")
            
            logger.info(f"✅ 압축 완료: {archive_path}")
            
            # Colab에서 파일 다운로드
            if COLAB_ENV:
                files.download(archive_path)
                logger.info("📥 파일 다운로드 시작됨")
                
        except Exception as e:
            logger.error(f"❌ 압축 파일 생성 오류: {e}")

if __name__ == "__main__":
    print("🌟 대진대학교 확장 크롤링 시스템 v2.0")
    print("=" * 60)
    
    crawler = ColabAdvancedCrawler()
    try:
        if COLAB_ENV:
            print("🔗 Google Colab 환경에서 실행 중...")
            print("💽 결과는 Google Drive에 자동 저장됩니다.")
        
        result = asyncio.run(crawler.run_extended_crawling())
        print(f"\\n🎉 확장 크롤링 완료: {result:,}개 신규 페이지 수집")
        
        if COLAB_ENV:
            print("📦 압축 파일이 자동으로 다운로드됩니다.")
            print("📂 Google Drive에서도 확인할 수 있습니다.")
            
    except KeyboardInterrupt:
        print("\\n⚠️ 사용자에 의해 중단됨")
        print("🔄 체크포인트가 저장되어 재시작 가능합니다")
    except Exception as e:
        print(f"\\n❌ 오류 발생: {e}")
        logger.error(f"실행 오류: {e}")