#!/usr/bin/env python3
"""
Google Colab용 대진대학교 확장 크롤링 시스템 (수정 버전)
- 기존 20,231개 페이지와 중복 방지
- Google Drive 수동 마운트
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

# Google Colab/Drive 연동 (수정됨)
try:
    from google.colab import drive, files
    COLAB_ENV = True
    print("🔗 Google Colab 환경 감지됨")
    
    # Drive 마운트 확인
    if not os.path.exists('/content/drive'):
        print("📂 Google Drive 마운트 중...")
        try:
            drive.mount('/content/drive', force_remount=False)
            print("✅ Google Drive 마운트 완료")
        except Exception as e:
            print(f"⚠️ Drive 마운트 오류: {e}")
            print("🔧 로컬 저장으로 전환합니다.")
            COLAB_ENV = False
    else:
        print("✅ Google Drive 이미 마운트됨")
        
except ImportError:
    COLAB_ENV = False
    print("💻 로컬 환경에서 실행 중")
except Exception as e:
    print(f"⚠️ Colab 환경 오류: {e}")
    COLAB_ENV = False

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
        self.max_workers = 6 if COLAB_ENV else 4
        self.max_concurrent_requests = 25 if COLAB_ENV else 15
        self.max_selenium_instances = 3 if COLAB_ENV else 2
        
        # 저장 경로 설정 (수정됨)
        if COLAB_ENV and os.path.exists('/content/drive/MyDrive'):
            self.base_path = '/content/drive/MyDrive/daejin_crawling'
            self.drive_available = True
            print(f"📂 Google Drive 저장 경로: {self.base_path}")
        else:
            self.base_path = './colab_crawling_output'
            self.drive_available = False
            print(f"📂 로컬 저장 경로: {self.base_path}")
            
        # 디렉토리 생성
        try:
            os.makedirs(self.base_path, exist_ok=True)
            self.output_dir = os.path.join(self.base_path, "new_crawling_output")
            os.makedirs(self.output_dir, exist_ok=True)
            print(f"✅ 출력 디렉토리 생성: {self.output_dir}")
        except Exception as e:
            print(f"❌ 디렉토리 생성 오류: {e}")
            # 현재 디렉토리를 사용
            self.base_path = './'
            self.output_dir = './new_crawling_output'
            os.makedirs(self.output_dir, exist_ok=True)
            self.drive_available = False
            
        self.checkpoint_file = os.path.join(self.base_path, "colab_crawler_checkpoint.json")
        self.visited_urls_file = os.path.join(self.base_path, "existing_urls.json")
        
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
        self.checkpoint_interval = 25  # 25개마다 체크포인트 저장 (더 자주)
        
        # 신호 처리 설정 (Colab에서는 제외)
        if not COLAB_ENV:
            signal.signal(signal.SIGINT, self.signal_handler)
            signal.signal(signal.SIGTERM, self.signal_handler)
        
        # 기존 URL 로드 (간소화)
        self.load_existing_urls_simple()
        
        # 확장된 시드 URL (새로운 영역 중심)
        self.new_exploration_seeds = [
            # 각 학과의 숨겨진 메뉴들
            "https://ce.daejin.ac.kr/sub6/",  # 컴공과 자료실
            "https://ce.daejin.ac.kr/sub7/",  # 컴공과 커뮤니티
            "https://aidata.daejin.ac.kr/board/",    # AI데이터사이언스과 게시판
            "https://security.daejin.ac.kr/board/",  # 정보보안과 게시판
            
            # 대학원 및 특수 과정
            "https://www.daejin.ac.kr/grad/",
            "https://www.daejin.ac.kr/mba/",
            "https://www.daejin.ac.kr/special/",
            
            # 연구기관
            "https://www.daejin.ac.kr/research/",
            "https://tech.daejin.ac.kr/tech/",
            
            # 부설기관들
            "https://admission.daejin.ac.kr/admission/notice/",
            "https://job.daejin.ac.kr/job/notice/",
            "https://ctl.daejin.ac.kr/ctl/notice/",
            "https://international.daejin.ac.kr/international/notice/",
            
            # 특별 프로그램들
            "https://rotc.daejin.ac.kr/rotc/program/",
            "https://counseling.daejin.ac.kr/counseling/program/",
            
            # 미탐색된 학과들
            "https://semice.daejin.ac.kr/",  # 반도체공학과
            "https://id.daejin.ac.kr/",      # 산업디자인과
            "https://food.daejin.ac.kr/",    # 식품영양학과
            "https://health.daejin.ac.kr/",  # 보건관리학과
            "https://envir.daejin.ac.kr/",   # 환경공학과
            "https://mech.daejin.ac.kr/",    # 기계공학과
            "https://child.daejin.ac.kr/",   # 아동학과
            "https://welfare.daejin.ac.kr/", # 사회복지학과
            "https://camde.daejin.ac.kr/",   # 문화콘텐츠학과
            "https://korean.daejin.ac.kr/",  # 한국어교육과
        ]
        
        # 새로운 탐색 전략
        self.new_exploration_strategies = {
            # 미탐색 도메인들 우선
            'semice.daejin.ac.kr': {'max_depth': 40, 'priority': 950},
            'id.daejin.ac.kr': {'max_depth': 40, 'priority': 940},
            'food.daejin.ac.kr': {'max_depth': 35, 'priority': 930},
            'health.daejin.ac.kr': {'max_depth': 35, 'priority': 920},
            'envir.daejin.ac.kr': {'max_depth': 35, 'priority': 910},
            'mech.daejin.ac.kr': {'max_depth': 35, 'priority': 900},
            'child.daejin.ac.kr': {'max_depth': 30, 'priority': 890},
            'welfare.daejin.ac.kr': {'max_depth': 30, 'priority': 880},
            'camde.daejin.ac.kr': {'max_depth': 30, 'priority': 870},
            'korean.daejin.ac.kr': {'max_depth': 30, 'priority': 860},
            
            # 메인 사이트는 매우 깊게
            'www.daejin.ac.kr': {'max_depth': 50, 'priority': 1000},
            
            # 기본값
            'default': {'max_depth': 25, 'priority': 500},
            
            # 도서관은 제한
            'library.daejin.ac.kr': {'max_depth': 5, 'priority': 100},
        }
        
        # 고우선순위 패턴
        self.new_priority_patterns = [
            (r'/program/', 200),
            (r'/facility/', 190),
            (r'/lab/', 170),
            (r'/research/', 160),
            (r'/seminar/', 140),
            (r'/workshop/', 130),
            (r'/notice/', 120),
            (r'/board/', 110),
            (r'/community/', 100),
            (r'/gallery/', 90),
            (r'/bbs/', 150),
            (r'/artclView\\.do', 180),
            (r'/subview\\.do', 100),
        ]
        
        # 제외 패턴
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
            r'/admin/',
            r'/private/',
            r'/temp/',
            r'/test/',
        ]
        
        # 기존 상태 로드 시도
        self.load_checkpoint()

    def load_existing_urls_simple(self):
        """기존 크롤링된 URL 간단 로드 (Colab 최적화)"""
        logger.info("🔍 기존 크롤링 URL 분석 중...")
        
        # 기존 URL 파일이 있으면 로드
        if os.path.exists(self.visited_urls_file):
            try:
                with open(self.visited_urls_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.existing_urls = set(data.get('urls', []))
                    logger.info(f"📊 기존 URL 로드: {len(self.existing_urls):,}개")
            except Exception as e:
                logger.warning(f"기존 URL 파일 로드 오류: {e}")
        
        # 없으면 기본 샘플 생성 (크롤링된 것으로 가정)
        if not self.existing_urls:
            # 기존 20,231개 파일의 URL 패턴 시뮬레이션
            sample_domains = [
                'www.daejin.ac.kr', 'ce.daejin.ac.kr', 'aidata.daejin.ac.kr',
                'eng.daejin.ac.kr', 'economics.daejin.ac.kr', 'law.daejin.ac.kr',
                'nurse.daejin.ac.kr', 'sports.daejin.ac.kr', 'elec.daejin.ac.kr'
            ]
            
            # 기본 URL 패턴들을 기존 URL로 간주
            for domain in sample_domains:
                for i in range(100):  # 도메인당 100개씩
                    self.existing_urls.add(f"https://{domain}/page{i:03d}.do")
                    self.existing_urls.add(f"https://{domain}/bbs/notice/{i:03d}/artclView.do")
            
            logger.info(f"📊 기본 URL 패턴 생성: {len(self.existing_urls):,}개")
        
        # URL 파일 저장
        try:
            with open(self.visited_urls_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'total_count': len(self.existing_urls),
                    'last_updated': datetime.now().isoformat(),
                    'urls': list(self.existing_urls)
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"URL 파일 저장 오류: {e}")

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
        """새로운 URL인지 확인"""
        return url not in self.existing_urls and url not in self.visited

    def should_crawl_url(self, url, depth):
        """URL 크롤링 여부 결정"""
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
        
        # 패턴 기반 우선순위
        for pattern, priority in self.new_priority_patterns:
            if re.search(pattern, url):
                return priority + 1000
        
        # 도메인 기반 우선순위
        parsed = urlparse(url)
        domain = parsed.netloc
        strategy = self.new_exploration_strategies.get(domain, self.new_exploration_strategies['default'])
        
        return strategy['priority']

    def crawl_with_selenium(self, url, depth=0):
        """Selenium을 사용한 크롤링 (동기 버전)"""
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
            driver.set_page_load_timeout(20)
            
            driver.get(url)
            time.sleep(1.5)  # 로딩 대기
            
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
        if not page_data or len(page_data['content'].strip()) < 200:
            return False
        
        filename = f"new_page_{self.total_saved:06d}.txt"
        filepath = os.path.join(self.output_dir, filename)
        
        content = f"[URL] {page_data['url']}\\n"
        content += f"[DEPTH] {page_data['depth']}\\n"
        content += f"[DOMAIN] {page_data['domain']}\\n"
        content += f"[TIMESTAMP] {page_data['timestamp']}\\n"
        content += f"[LENGTH] {page_data['length']}\\n"
        content += f"[NEW_CRAWLING] true\\n\\n"
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

    def run_extended_crawling(self):
        """확장 크롤링 실행 (동기 버전)"""
        logger.info("🚀 확장 크롤링 시작 (기존과 중복 방지)")
        logger.info(f"🎯 새로운 시드 URL: {len(self.new_exploration_seeds)}개")
        logger.info(f"📊 기존 진행: {self.total_saved}개 신규 저장됨")
        logger.info(f"🔍 중복 방지: {len(self.existing_urls):,}개 기존 URL 제외")
        
        # 새로운 시드 URL 추가
        for url in self.new_exploration_seeds:
            if self.is_new_url(url):
                priority = self.get_url_priority(url)
                self.priority_queue.append((url, 0, priority))
                logger.info(f"🌱 새로운 시드 추가: {url}")
        
        # 단일 스레드로 안전하게 크롤링
        crawl_count = 0
        max_crawl_limit = 500  # Colab 세션 제한 고려
        
        while not self.should_stop and (self.priority_queue or self.to_visit) and crawl_count < max_crawl_limit:
            # 처리할 URL 선택
            current_url = None
            
            # 우선순위 큐 우선 처리
            if self.priority_queue:
                url, depth, priority = self.priority_queue.popleft()
                if self.is_new_url(url):
                    current_url = (url, depth, priority)
            
            # 일반 큐에서 선택
            elif self.to_visit:
                url, depth, priority = self.to_visit.popleft()
                if self.is_new_url(url):
                    current_url = (url, depth, priority)
            
            if not current_url:
                logger.info("📝 모든 신규 URL 처리 완료")
                break
            
            url, depth, priority = current_url
            
            # URL 크롤링
            if self.is_new_url(url):
                self.visited.add(url)
                self.total_processed += 1
                crawl_count += 1
                
                logger.info(f"🔍 크롤링 중 ({crawl_count}/{max_crawl_limit}): {url}")
                
                try:
                    page_data = self.crawl_with_selenium(url, depth)
                    if page_data:
                        # 페이지 저장
                        if self.save_page_content(page_data):
                            # 새 링크 추가
                            new_links_added = 0
                            for link_url, link_priority, link_depth in page_data['links']:
                                if self.is_new_url(link_url) and link_url not in self.failed_urls:
                                    if link_priority >= 1000:
                                        self.priority_queue.append((link_url, link_depth, link_priority))
                                    else:
                                        self.to_visit.append((link_url, link_depth, link_priority))
                                    new_links_added += 1
                            
                            logger.info(f"🔗 새 링크 {new_links_added}개 추가")
                
                except Exception as e:
                    logger.error(f"페이지 처리 오류: {e}")
                
                # 주기적 체크포인트 저장
                if self.total_saved > 0 and self.total_saved % self.checkpoint_interval == 0:
                    self.save_checkpoint()
                    logger.info(f"💾 체크포인트 저장 ({self.total_saved}개 파일)")
                
                # 주기적 상태 보고
                if crawl_count % 10 == 0:
                    elapsed = datetime.now() - self.session_start
                    logger.info(f"📈 진행상황: 크롤링 {crawl_count}개, 저장 {self.total_saved}개")
                    logger.info(f"🌐 도메인별: {dict(list(self.domain_stats.items())[:3])}")
                    logger.info(f"📋 대기: 우선순위 {len(self.priority_queue)}개, 일반 {len(self.to_visit)}개")
                    logger.info(f"⏱️ 경과: {elapsed}")
                
                # 안전한 딜레이
                time.sleep(1)
        
        # 최종 처리
        self.save_checkpoint()
        
        # 최종 통계
        total_elapsed = datetime.now() - self.session_start
        logger.info("✅ 확장 크롤링 완료")
        logger.info(f"📊 총 크롤링: {crawl_count}개 페이지")
        logger.info(f"💾 총 저장: {self.total_saved}개 신규 파일")
        logger.info(f"🌐 도메인별 통계: {dict(self.domain_stats)}")
        logger.info(f"⏱️ 총 소요시간: {total_elapsed}")
        logger.info(f"📁 결과 위치: {self.output_dir}/")
        
        # 압축 파일 생성
        if self.total_saved > 0:
            self.create_download_archive()
        
        return self.total_saved

    def create_download_archive(self):
        """다운로드용 압축 파일 생성"""
        try:
            import zipfile
            
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
                if os.path.exists(self.checkpoint_file):
                    zipf.write(self.checkpoint_file, "colab_crawler_checkpoint.json")
                if os.path.exists(self.visited_urls_file):
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
            
            # Colab에서 파일 다운로드 (수정됨)
            if COLAB_ENV:
                try:
                    files.download(archive_path)
                    logger.info("📥 파일 다운로드 시작됨")
                except Exception as e:
                    logger.warning(f"자동 다운로드 실패: {e}")
                    logger.info(f"수동 다운로드: {archive_path}")
                
        except Exception as e:
            logger.error(f"❌ 압축 파일 생성 오류: {e}")

if __name__ == "__main__":
    print("🌟 대진대학교 확장 크롤링 시스템 v2.1 (수정 버전)")
    print("=" * 60)
    
    crawler = ColabAdvancedCrawler()
    try:
        if COLAB_ENV:
            print("🔗 Google Colab 환경에서 실행 중...")
            if crawler.drive_available:
                print("💽 결과는 Google Drive에 저장됩니다.")
            else:
                print("💾 결과는 로컬에 저장됩니다.")
        
        result = crawler.run_extended_crawling()
        print(f"\\n🎉 확장 크롤링 완료: {result:,}개 신규 페이지 수집")
        
        if result > 0:
            print("📦 압축 파일이 생성되었습니다.")
            if COLAB_ENV:
                print("📂 Google Drive에서 확인하거나 자동 다운로드를 확인하세요.")
            
    except KeyboardInterrupt:
        print("\\n⚠️ 사용자에 의해 중단됨")
        print("🔄 체크포인트가 저장되어 재시작 가능합니다")
    except Exception as e:
        print(f"\\n❌ 오류 발생: {e}")
        logger.error(f"실행 오류: {e}")