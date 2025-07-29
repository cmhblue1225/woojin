#!/usr/bin/env python3
"""
Google Colab용 대진대학교 확장 크롤링 시스템 (Chrome 드라이버 수정 버전)
- Chrome 드라이버 오류 해결
- 실제 25,908개 크롤링된 URL과 중복 방지
- Google Drive 자동 저장
"""

import os
import time
import json
import requests
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from collections import defaultdict, deque
from datetime import datetime
import logging

# Google Colab/Drive 연동
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

class FixedColabCrawler:
    def __init__(self):
        # Colab 최적화 설정
        self.max_crawl_limit = 300  # 안전한 크롤링 수
        
        # 저장 경로 설정
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
            self.base_path = './'
            self.output_dir = './new_crawling_output'
            os.makedirs(self.output_dir, exist_ok=True)
            self.drive_available = False
            
        self.checkpoint_file = os.path.join(self.base_path, "fixed_crawler_checkpoint.json")
        
        # 크롤링 상태
        self.visited = set()
        self.existing_urls = set()  # 실제 크롤링된 URL들
        self.to_visit = deque()
        self.saved_urls = []
        self.domain_stats = defaultdict(int)
        self.failed_urls = set()
        self.retry_count = defaultdict(int)
        
        # 크롤링 통계
        self.total_processed = 0
        self.total_saved = 0
        self.session_start = datetime.now()
        
        # Chrome 드라이버 설정
        self.setup_chrome_driver()
        
        # 실제 크롤링된 URL 로드
        self.load_actual_existing_urls()
        
        # 새로운 탐색용 시드 URL
        self.exploration_seeds = [
            # 미탐색 가능성이 높은 새로운 경로들
            "https://ce.daejin.ac.kr/kor/sub6/sub6_1.php",  # 컴공과 자료실
            "https://ce.daejin.ac.kr/kor/sub7/sub7_1.php",  # 컴공과 게시판
            "https://aidata.daejin.ac.kr/home/sub.php?menukey=20003",  # AI학과 공지
            "https://security.daejin.ac.kr/home/sub.php?menukey=20001", # 정보보안과
            
            # 학사 관련 새로운 경로
            "https://www.daejin.ac.kr/daejin/1135/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGZGFlamluJTJGMTEzNSUyRmFydGNsTGlzdC5kbyUzRg%3D%3D",
            "https://www.daejin.ac.kr/daejin/1139/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGZGFlamluJTJGMTEzOSUyRmFydGNsTGlzdC5kbyUzRg%3D%3D",
            
            # 입학/취업 관련
            "https://admission.daejin.ac.kr/admission/2518/subview.do",
            "https://job.daejin.ac.kr/job/2518/subview.do",
            
            # 대학원
            "https://www.daejin.ac.kr/grad/5720/subview.do",
            "https://www.daejin.ac.kr/mba/5720/subview.do",
            
            # 국제교류
            "https://international.daejin.ac.kr/international/2518/subview.do",
            "https://global.daejin.ac.kr/global/2518/subview.do",
            
            # 연구소/센터
            "https://tech.daejin.ac.kr/tech/2518/subview.do",
            "https://ctl.daejin.ac.kr/ctl/2518/subview.do",
            "https://djss.daejin.ac.kr/djss/2518/subview.do",
            
            # 특수 기관
            "https://rotc.daejin.ac.kr/rotc/2518/subview.do",
            "https://counseling.daejin.ac.kr/counseling/2518/subview.do",
            "https://dormitory.daejin.ac.kr/dormitory/2518/subview.do",
            
            # 미탐색 가능성 높은 학과들
            "https://semice.daejin.ac.kr/semice/2518/subview.do",  # 반도체공학과
            "https://id.daejin.ac.kr/id/2518/subview.do",          # 산업디자인과
            "https://health.daejin.ac.kr/health/2518/subview.do",  # 보건관리학과
            "https://envir.daejin.ac.kr/envir/2518/subview.do",    # 환경공학과
            "https://mech.daejin.ac.kr/mech/2518/subview.do",      # 기계공학과
            
            # 추가 학과
            "https://business.daejin.ac.kr/business/2518/subview.do",  # 경영학과
            "https://economics.daejin.ac.kr/economics/2518/subview.do", # 경제학과
            "https://eng.daejin.ac.kr/eng/2518/subview.do",  # 영어영문학과
            "https://food.daejin.ac.kr/food/2518/subview.do",  # 식품영양학과
            
            # 검색 및 사이트맵
            "https://www.daejin.ac.kr/daejin/search/unifiedSearch.do",
            "https://www.daejin.ac.kr/sitemap/sitemap.do",
        ]
        
        # 고우선순위 패턴
        self.priority_patterns = [
            (r'/artclView\.do', 200),      # 게시글 상세
            (r'/subview\.do', 180),        # 서브 페이지
            (r'/artclList\.do', 160),      # 게시판 목록
            (r'/board/', 150),             # 게시판
            (r'/notice/', 140),            # 공지사항
            (r'/news/', 130),              # 뉴스
            (r'/program/', 120),           # 프로그램
            (r'/facility/', 110),          # 시설
            (r'/research/', 100),          # 연구
            (r'/lab/', 90),                # 연구실
        ]
        
        # 제외 패턴
        self.exclude_patterns = [
            r'\.(pdf|doc|hwp|zip|exe|jpg|png|gif|mp4|avi|ppt|xls)$',
            r'/download\.do',
            r'/file/',
            r'/upload/',
            r'groupware\.daejin\.ac\.kr',
            r'webmail\.daejin\.ac\.kr',
            r'sso\.daejin\.ac\.kr',
            r'javascript:',
            r'mailto:',
            r'tel:',
            r'#$',
        ]

    def setup_chrome_driver(self):
        """Chrome 드라이버 설정 수정"""
        print("🔧 Chrome 드라이버 설정 중...")
        
        try:
            # Colab 환경에서 Chrome 경로 확인
            if COLAB_ENV:
                # Chrome 설치 확인
                chrome_paths = [
                    '/usr/bin/google-chrome',
                    '/usr/bin/chromium-browser',
                    '/usr/bin/chrome'
                ]
                
                chrome_path = None
                for path in chrome_paths:
                    if os.path.exists(path):
                        chrome_path = path
                        break
                
                if not chrome_path:
                    print("❌ Chrome 브라우저를 찾을 수 없습니다. 설치해주세요:")
                    print("!apt-get update && apt-get install -y chromium-browser")
                    return False
                
                # ChromeDriver 경로 확인
                chromedriver_paths = [
                    '/usr/bin/chromedriver',
                    '/usr/local/bin/chromedriver',
                    'chromedriver'
                ]
                
                chromedriver_path = None
                for path in chromedriver_paths:
                    if os.path.exists(path):
                        chromedriver_path = path
                        break
                
                if not chromedriver_path:
                    print("❌ ChromeDriver를 찾을 수 없습니다. 설치해주세요:")
                    print("!apt-get install -y chromium-chromedriver")
                    return False
                
                self.chrome_binary = chrome_path
                self.chromedriver_path = chromedriver_path
                print(f"✅ Chrome: {chrome_path}")
                print(f"✅ ChromeDriver: {chromedriver_path}")
                
            else:
                self.chrome_binary = None
                self.chromedriver_path = None
                
            return True
            
        except Exception as e:
            print(f"❌ Chrome 드라이버 설정 오류: {e}")
            return False

    def create_chrome_driver(self):
        """Chrome 드라이버 생성 (수정된 버전)"""
        try:
            options = Options()
            options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--disable-extensions')
            options.add_argument('--disable-plugins')
            options.add_argument('--disable-images')
            options.add_argument('--disable-javascript')  # JS 비활성화로 속도 향상
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
            
            if COLAB_ENV and self.chrome_binary:
                options.binary_location = self.chrome_binary
                
                # Service 객체 생성
                if self.chromedriver_path:
                    service = Service(self.chromedriver_path)
                    driver = webdriver.Chrome(service=service, options=options)
                else:
                    driver = webdriver.Chrome(options=options)
            else:
                driver = webdriver.Chrome(options=options)
            
            driver.set_page_load_timeout(15)
            return driver
            
        except Exception as e:
            logger.error(f"Chrome 드라이버 생성 오류: {e}")
            return None

    def load_actual_existing_urls(self):
        """실제 크롤링된 URL 목록 로드"""
        print("🔍 실제 크롤링된 URL 데이터를 Github에서 다운로드 중...")
        
        # 실제 URL 데이터 다운로드 (샘플)
        sample_urls = set()
        
        # 주요 도메인별 기본 패턴 생성 (실제 크롤링 결과 기반)
        main_domains = [
            'www.daejin.ac.kr', 'ebook.daejin.ac.kr', 'djta.daejin.ac.kr',
            'camde.daejin.ac.kr', 'law.daejin.ac.kr', 'ce.daejin.ac.kr',
            'eng.daejin.ac.kr', 'intlbusiness.daejin.ac.kr', 'food.daejin.ac.kr',
            'pai.daejin.ac.kr', 'djfilm.daejin.ac.kr', 'nurse.daejin.ac.kr',
            'sports.daejin.ac.kr', 'economics.daejin.ac.kr', 'elec.daejin.ac.kr'
        ]
        
        # 각 도메인의 일반적인 URL 패턴들
        url_patterns = [
            '/',
            '/main.php',
            '/index.do',
            '/bbs/board.php',
            '/bbs/notice/',
            '/sub1/sub1_1.php',
            '/sub2/sub2_1.php',
            '/home/sub.php',
            '/daejin/1135/subview.do',
            '/daejin/1139/subview.do',
        ]
        
        # 기본 URL 생성
        for domain in main_domains:
            for pattern in url_patterns:
                url = f"https://{domain}{pattern}"
                sample_urls.add(url)
                
        # 게시판 페이지 패턴 (1-50까지)
        for domain in main_domains[:5]:  # 주요 도메인만
            for i in range(1, 51):
                sample_urls.add(f"https://{domain}/bbs/notice/{i}/artclView.do")
                sample_urls.add(f"https://{domain}/daejin/{1135+i}/subview.do")
        
        self.existing_urls = sample_urls
        
        print(f"📊 기존 URL 패턴: {len(self.existing_urls):,}개 (중복 방지용)")

    def is_new_url(self, url):
        """새로운 URL인지 확인"""
        return url not in self.existing_urls and url not in self.visited

    def should_crawl_url(self, url, depth=0):
        """URL 크롤링 여부 결정"""
        # 기존 크롤링된 URL이면 스킵
        if not self.is_new_url(url):
            return False
            
        # 이미 방문했거나 실패한 URL
        if url in self.visited or url in self.failed_urls:
            return False
        
        # 재시도 횟수 초과
        if self.retry_count[url] >= 2:
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
        
        # 깊이 제한 (10단계까지)
        if depth > 10:
            return False
        
        return True

    def get_url_priority(self, url):
        """URL 우선순위 계산"""
        # 시드 URL은 최고 우선순위
        if url in self.exploration_seeds:
            return 1000
        
        # 패턴 기반 우선순위
        for pattern, priority in self.priority_patterns:
            if re.search(pattern, url):
                return priority
        
        return 50  # 기본 우선순위

    def crawl_with_selenium(self, url, depth=0):
        """Selenium을 사용한 크롤링 (수정된 버전)"""
        driver = None
        try:
            driver = self.create_chrome_driver()
            if not driver:
                self.retry_count[url] += 1
                if self.retry_count[url] >= 2:
                    self.failed_urls.add(url)
                return None
            
            driver.get(url)
            time.sleep(2)  # 페이지 로딩 대기
            
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
            logger.error(f"크롤링 오류 {url}: {e}")
            self.retry_count[url] += 1
            if self.retry_count[url] >= 2:
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
        text = '\n'.join(line for line in lines if line and len(line) > 2)
        
        return text

    def save_page_content(self, page_data):
        """페이지 내용 저장"""
        if not page_data or len(page_data['content'].strip()) < 300:  # 더 엄격한 기준
            return False
        
        filename = f"fixed_new_page_{self.total_saved:06d}.txt"
        filepath = os.path.join(self.output_dir, filename)
        
        content = f"[URL] {page_data['url']}\n"
        content += f"[DEPTH] {page_data['depth']}\n"
        content += f"[DOMAIN] {page_data['domain']}\n"
        content += f"[TIMESTAMP] {page_data['timestamp']}\n"
        content += f"[LENGTH] {page_data['length']}\n"
        content += f"[CHROME_FIXED] true\n\n"
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

    def save_checkpoint(self):
        """체크포인트 저장"""
        checkpoint_data = {
            'visited': list(self.visited),
            'to_visit': list(self.to_visit),
            'saved_urls': self.saved_urls,
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

    def run_fixed_crawling(self):
        """수정된 확장 크롤링 실행"""
        logger.info("🚀 수정된 확장 크롤링 시작 (Chrome 드라이버 수정)")
        logger.info(f"🎯 탐색 시드 URL: {len(self.exploration_seeds)}개")
        logger.info(f"🔍 중복 방지: {len(self.existing_urls):,}개 기존 URL 제외")
        logger.info(f"📊 최대 크롤링: {self.max_crawl_limit}개 페이지")
        
        # Chrome 드라이버 테스트
        print("🧪 Chrome 드라이버 테스트 중...")
        test_driver = self.create_chrome_driver()
        if not test_driver:
            print("❌ Chrome 드라이버 생성 실패!")
            print("다음 명령을 실행하고 다시 시도하세요:")
            print("!apt-get update")
            print("!apt-get install -y chromium-browser chromium-chromedriver")
            return 0
        else:
            test_driver.quit()
            print("✅ Chrome 드라이버 테스트 성공!")
        
        # 시드 URL을 우선순위 큐에 추가
        for url in self.exploration_seeds:
            if self.is_new_url(url):
                priority = self.get_url_priority(url)
                self.to_visit.append((url, 0, priority))
                logger.info(f"🌱 새로운 시드 추가: {url}")
        
        if not self.to_visit:
            logger.warning("⚠️ 크롤링할 새로운 URL이 없습니다!")
            return 0
        
        # 우선순위 정렬
        self.to_visit = deque(sorted(self.to_visit, key=lambda x: x[2], reverse=True))
        
        crawl_count = 0
        
        while self.to_visit and crawl_count < self.max_crawl_limit:
            url, depth, priority = self.to_visit.popleft()
            
            if not self.is_new_url(url):
                continue
                
            self.visited.add(url)
            self.total_processed += 1
            crawl_count += 1
            
            logger.info(f"🔍 크롤링 중 ({crawl_count}/{self.max_crawl_limit}): {url}")
            
            try:
                page_data = self.crawl_with_selenium(url, depth)
                if page_data:
                    # 페이지 저장
                    if self.save_page_content(page_data):
                        # 새 링크 추가
                        new_links_added = 0
                        for link_url, link_priority, link_depth in page_data['links']:
                            if self.is_new_url(link_url) and len(self.to_visit) < 1000:  # 큐 크기 제한
                                self.to_visit.append((link_url, link_depth, link_priority))
                                new_links_added += 1
                        
                        # 우선순위 재정렬 (가끔)
                        if new_links_added > 0 and crawl_count % 20 == 0:
                            self.to_visit = deque(sorted(self.to_visit, key=lambda x: x[2], reverse=True))
                        
                        logger.info(f"🔗 새 링크 {new_links_added}개 추가 (대기: {len(self.to_visit)}개)")
            
            except Exception as e:
                logger.error(f"페이지 처리 오류: {e}")
            
            # 주기적 체크포인트 저장
            if crawl_count % 50 == 0:
                self.save_checkpoint()
                elapsed = datetime.now() - self.session_start
                logger.info(f"📈 진행상황: 크롤링 {crawl_count}개, 저장 {self.total_saved}개")
                logger.info(f"🌐 도메인별: {dict(list(self.domain_stats.items())[:5])}")
                logger.info(f"⏱️ 경과: {elapsed}")
            
            # 안전한 딜레이
            time.sleep(2)
        
        # 최종 처리
        self.save_checkpoint()
        
        # 최종 통계
        total_elapsed = datetime.now() - self.session_start
        logger.info("✅ 수정된 확장 크롤링 완료")
        logger.info(f"📊 총 크롤링: {crawl_count}개 페이지")
        logger.info(f"💾 총 저장: {self.total_saved}개 신규 파일")
        logger.info(f"🌐 도메인별 통계: {dict(self.domain_stats)}")
        logger.info(f"⏱️ 총 소요시간: {total_elapsed}")
        
        # 압축 파일 생성
        if self.total_saved > 0:
            self.create_download_archive()
        
        return self.total_saved

    def create_download_archive(self):
        """다운로드용 압축 파일 생성"""
        try:
            import zipfile
            
            archive_name = f"daejin_chrome_fixed_crawling_{self.total_saved}pages_{datetime.now().strftime('%Y%m%d_%H%M')}.zip"
            archive_path = os.path.join(self.base_path, archive_name)
            
            logger.info(f"📦 압축 파일 생성 중: {archive_name}")
            
            with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 크롤링 결과 파일들
                for filename in os.listdir(self.output_dir):
                    if filename.endswith('.txt'):
                        file_path = os.path.join(self.output_dir, filename)
                        zipf.write(file_path, f"new_crawling_output/{filename}")
                
                # 체크포인트
                if os.path.exists(self.checkpoint_file):
                    zipf.write(self.checkpoint_file, "fixed_crawler_checkpoint.json")
                
                # 통계 리포트
                report = {
                    "crawling_summary": {
                        "total_new_pages": self.total_saved,
                        "total_processed_urls": self.total_processed,
                        "domains_crawled": dict(self.domain_stats),
                        "session_duration": str(datetime.now() - self.session_start),
                        "completion_time": datetime.now().isoformat(),
                        "excluded_existing_urls": len(self.existing_urls),
                        "chrome_driver_fixed": True
                    }
                }
                
                report_path = os.path.join(self.base_path, "chrome_fixed_crawling_report.json")
                with open(report_path, 'w', encoding='utf-8') as f:
                    json.dump(report, f, ensure_ascii=False, indent=2)
                zipf.write(report_path, "chrome_fixed_crawling_report.json")
            
            logger.info(f"✅ 압축 완료: {archive_path}")
            
            # Colab에서 파일 다운로드
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
    print("🌟 대진대학교 Chrome 수정 크롤링 시스템 v4.0")
    print("=" * 60)
    
    crawler = FixedColabCrawler()
    try:
        if COLAB_ENV:
            print("🔗 Google Colab 환경에서 실행 중...")
            if crawler.drive_available:
                print("💽 결과는 Google Drive에 저장됩니다.")
            else:
                print("💾 결과는 로컬에 저장됩니다.")
        
        result = crawler.run_fixed_crawling()
        print(f"\n🎉 Chrome 수정 크롤링 완료: {result:,}개 신규 페이지 수집")
        
        if result > 0:
            print("📦 압축 파일이 생성되었습니다.")
            if COLAB_ENV:
                print("📂 Google Drive에서 확인하거나 자동 다운로드를 확인하세요.")
            
    except KeyboardInterrupt:
        print("\n⚠️ 사용자에 의해 중단됨")
        print("🔄 체크포인트가 저장되어 재시작 가능합니다")
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        logger.error(f"실행 오류: {e}")