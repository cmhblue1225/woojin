#!/usr/bin/env python3
"""
대진대학교 홈페이지 고성능 크롤링 시스템
- MacBook Pro M4 Pro 최적화 (14-core CPU, 20-core GPU)
- 중단/재시작 지원
- 불필요한 네비게이션 데이터 제거
- 깊이 제한 및 도메인별 전략
- RAG 통합 준비
"""

import os
import time
import json
import asyncio
import aiohttp
import requests
from urllib.parse import urlparse, urljoin, parse_qs
from bs4 import BeautifulSoup
import pdfplumber
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import multiprocessing as mp
from collections import defaultdict
import hashlib
from datetime import datetime
import logging

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('crawler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class EnhancedCrawler:
    def __init__(self):
        # M4 Pro 성능 최적화 설정 (대량 크롤링 최적화)
        self.max_workers = min(12, mp.cpu_count())  # 워커 수 증가 (8→12)
        self.max_concurrent_requests = 30  # 동시 HTTP 요청 수 증가 (20→30)
        self.max_selenium_instances = 4    # Selenium 인스턴스 수 증가 (3→4)
        
        # 디렉토리 설정
        self.output_dir = "enhanced_output"
        self.state_file = "enhanced_crawler_state.json"
        self.error_log = os.path.join(self.output_dir, "enhanced_error_log.txt")
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 크롤링 상태
        self.visited = set()
        self.to_visit = set()
        self.saved_texts = []
        self.saved_urls = []
        self.url_depths = {}  # URL별 깊이 추적
        self.domain_stats = defaultdict(int)  # 도메인별 통계
        
        # 우선순위 URL 패턴 (게시판 최적화)
        self.priority_patterns = [
            r'/bbs/.*/artclView\.do',      # 게시판 게시물 (최고 우선순위)
            r'/bbs/.*/',                   # 게시판 목록
            r'/board/.*/',                 # 게시판 관련
            r'/notice/',                   # 공지사항
            r'/subview\.do',               # 서브페이지
            r'/info/',                     # 정보 페이지
            r'/curriculum/',               # 교육과정
            r'/professor/',                # 교수진
            r'/faculty/',                  # 교수진
            r'/student/',                  # 학생 관련
            r'/admission/',                # 입학 관련
            r'/scholarship/',              # 장학 관련
            r'/employment/',               # 취업 관련
            r'/research/',                 # 연구 관련
        ]
        
        # 도메인별 깊이 제한 (대폭 확대)
        self.domain_depth_limits = {
            'library.daejin.ac.kr': 0,    # 도서관 완전 제외
            'www.daejin.ac.kr': 15,       # 메인 사이트 더 깊게
            'ce.daejin.ac.kr': 12,        # 컴퓨터공학과
            'law.daejin.ac.kr': 12,       # 법학과
            'eng.daejin.ac.kr': 12,       # 영어영문학과
            'sm.daejin.ac.kr': 12,        # 경영학과
            'admission.daejin.ac.kr': 10, # 입학처
            'job.daejin.ac.kr': 10,       # 취업진로처
            'default': 10                 # 기본 깊이 대폭 확대
        }
        
        # 모든 대진대학교 학과 및 기관 시작 URL
        self.start_urls = [
            # 메인 사이트
            "https://www.daejin.ac.kr/sites/daejin/index.do",
            "https://www.daejin.ac.kr/daejin/874/subview.do",  # 학사정보
            "https://www.daejin.ac.kr/daejin/873/subview.do",  # 입학정보
            "https://www.daejin.ac.kr/daejin/970/subview.do",  # 공지사항
            
            # 공과대학
            "https://ce.daejin.ac.kr/ce/index.do",           # 컴퓨터공학과
            "https://ee.daejin.ac.kr/ee/index.do",           # 전자전기공학부
            "https://ie.daejin.ac.kr/ie/index.do",           # 산업경영공학과
            "https://chemeng.daejin.ac.kr/chemeng/index.do", # 화학공학과
            "https://civil.daejin.ac.kr/civil/index.do",     # 건설시스템공학과
            "https://envir.daejin.ac.kr/envir/index.do",     # 환경공학과
            "https://arcon.daejin.ac.kr/arcon/index.do",     # 건축공학과
            "https://architecture.daejin.ac.kr/architecture/index.do", # 건축학과
            
            # 경상대학
            "https://sm.daejin.ac.kr/sm/index.do",           # 경영학과
            "https://economics.daejin.ac.kr/economics/index.do", # 경제학과
            "https://trade.daejin.ac.kr/trade/index.do",     # 국제통상학과
            "https://intlbusiness.daejin.ac.kr/intlbusiness/index.do", # 글로벌경영학과
            "https://business.daejin.ac.kr/business/index.do", # 경영정보학과
            
            # 인문대학
            "https://eng.daejin.ac.kr/eng/index.do",         # 영어영문학과
            "https://china.daejin.ac.kr/china/index.do",     # 중국학과
            "https://japan.daejin.ac.kr/japan/index.do",     # 일본학과
            "https://korea.daejin.ac.kr/korea/index.do",     # 국어국문학과
            "https://koreanstudies.daejin.ac.kr/koreanstudies/index.do", # 한국사학과
            "https://creativewriting.daejin.ac.kr/creativewriting/index.do", # 문예창작학과
            
            # 법정대학
            "https://law.daejin.ac.kr/law/index.do",         # 공공인재법학과
            "https://pai.daejin.ac.kr/pai/index.do",         # 행정학과
            
            # 사회과학대학
            "https://unification.daejin.ac.kr/unification/index.do", # 통일학과
            "https://media.daejin.ac.kr/media/index.do",     # 미디어커뮤니케이션학과
            "https://djss.daejin.ac.kr/djss/index.do",       # 사회복지학과
            
            # 예술대학
            "https://music.daejin.ac.kr/music/index.do",     # 음악학과
            "https://arte.daejin.ac.kr/arte/index.do",       # 회화과
            "https://design.daejin.ac.kr/design/index.do",   # 산업디자인학과
            "https://djfilm.daejin.ac.kr/djfilm/index.do",   # 영화영상학과
            
            # 생명보건대학
            "https://food.daejin.ac.kr/food/index.do",       # 식품영양학과
            "https://sports.daejin.ac.kr/sports/index.do",   # 스포츠과학과
            "https://nurse.daejin.ac.kr/nurse/index.do",     # 간호학과
            "https://health.daejin.ac.kr/health/index.do",   # 보건관리학과
            "https://bms.daejin.ac.kr/bms/index.do",         # 의생명분자과학과
            
            # 교양대학
            "https://liberal.daejin.ac.kr/liberal/index.do", # 교양대학
            "https://personality.daejin.ac.kr/personality/index.do", # 인성교육센터
            
            # 대학원
            "https://grad.daejin.ac.kr/grad/index.do",       # 일반대학원
            "https://dmz.daejin.ac.kr/dmz/index.do",         # DMZ국제대학원
            
            # 특수기관
            "https://daesoon.daejin.ac.kr/daesoon/index.do", # 대순종학과
            "https://rotc.daejin.ac.kr/rotc/index.do",       # 학군단
            "https://aidata.daejin.ac.kr/aidata/index.do",   # AI데이터사이언스학과
            "https://swcg.daejin.ac.kr/swcg/index.do",       # SW융합대학
            
            # 부속기관
            "https://admission.daejin.ac.kr/admission/index.do", # 입학처
            "https://job.daejin.ac.kr/job/index.do",         # 취업진로처
            "https://counseling.daejin.ac.kr/counseling/index.do", # 학생상담센터
            "https://dormitory.daejin.ac.kr/dormitory/index.do", # 생활관
            "https://global.daejin.ac.kr/global/index.do",   # 국제교류원
            "https://ctl.daejin.ac.kr/ctl/index.do",         # 교수학습지원센터
            "https://cce.daejin.ac.kr/cce/index.do",         # 평생교육원
        ]
        
        self.load_state()

    def load_state(self):
        """이전 크롤링 상태 로드"""
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, "r", encoding="utf-8") as f:
                    state = json.load(f)
                    self.visited.update(state.get("visited", []))
                    self.to_visit.update(state.get("to_visit", []))
                    self.saved_texts.extend(state.get("saved_texts", []))
                    self.saved_urls.extend(state.get("saved_urls", []))
                    self.url_depths.update(state.get("url_depths", {}))
                    
                logger.info(f"🔄 상태 복원: 방문 {len(self.visited)}개, 대기 {len(self.to_visit)}개")
            except Exception as e:
                logger.error(f"상태 로드 실패: {e}")
        
        # 시작 URL 추가 (아직 방문하지 않은 것만)
        new_start_urls = set(self.start_urls) - self.visited
        self.to_visit.update(new_start_urls)
        
        # 시작 URL 깊이 설정
        for url in self.start_urls:
            if url not in self.url_depths:
                self.url_depths[url] = 0

    def save_state(self):
        """현재 크롤링 상태 저장"""
        state = {
            "visited": list(self.visited),
            "to_visit": list(self.to_visit),
            "saved_texts": self.saved_texts,
            "saved_urls": self.saved_urls,
            "url_depths": self.url_depths,
            "last_saved": datetime.now().isoformat(),
            "stats": dict(self.domain_stats)
        }
        
        try:
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
            logger.info(f"💾 상태 저장: 방문 {len(self.visited)}개, 대기 {len(self.to_visit)}개")
        except Exception as e:
            logger.error(f"상태 저장 실패: {e}")

    def create_selenium_driver(self):
        """최적화된 Selenium 드라이버 생성"""
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-web-security")
        options.add_argument("--disable-features=VizDisplayCompositor")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-plugins")
        options.add_argument("--disable-images")  # 이미지 로드 안함
        options.add_argument("--disable-javascript")  # JS 실행 안함 (필요시 제거)
        options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        
        # 성능 최적화
        prefs = {
            "profile.managed_default_content_settings.images": 2,  # 이미지 차단
            "profile.default_content_setting_values.notifications": 2,  # 알림 차단
        }
        options.add_experimental_option("prefs", prefs)
        
        return webdriver.Chrome(options=options)

    def is_valid_url(self, url, current_depth=0):
        """URL 유효성 및 크롤링 조건 검사"""
        try:
            parsed = urlparse(url)
            
            # 기본 필터링
            if not parsed.scheme in ("http", "https"):
                return False
            if not "daejin.ac.kr" in parsed.netloc:
                return False
            if re.search(r'\\.(pdf|jpg|png|gif|doc|docx|zip|mp4|avi)$', url, re.IGNORECASE):
                return False
            if url in self.visited:
                return False
                
            # 깊이 제한 확인
            domain = parsed.netloc
            max_depth = self.domain_depth_limits.get(domain, self.domain_depth_limits['default'])
            if current_depth > max_depth:
                return False
                
            # 불필요한 URL 패턴 제외 (도서관 추가)
            exclude_patterns = [
                r'#',  # 앵커 링크
                r'javascript:',  # JavaScript 링크
                r'mailto:',  # 이메일 링크
                r'/login',  # 로그인 페이지
                r'/admin',  # 관리자 페이지
                r'/popup',  # 팝업 페이지
                r'\\.(css|js)$',  # CSS, JS 파일
                r'library\.daejin\.ac\.kr',  # 도서관 완전 제외
            ]
            
            for pattern in exclude_patterns:
                if re.search(pattern, url, re.IGNORECASE):
                    return False
            
            return True
            
        except Exception:
            return False

    def get_url_priority(self, url):
        """URL 우선순위 계산 (높을수록 우선)"""
        priority = 0
        
        # 우선순위 패턴 매칭
        for i, pattern in enumerate(self.priority_patterns):
            if re.search(pattern, url, re.IGNORECASE):
                priority += (len(self.priority_patterns) - i) * 10
                break
        
        # 깊이 기반 우선순위 (얕을수록 높음)
        depth = self.url_depths.get(url, 0)
        priority += max(0, 10 - depth)
        
        # 특정 키워드 포함 시 우선순위 증가 (확장)
        important_keywords = [
            '공지', 'notice', '학사', '수강', '입학', '졸업', '장학',
            '교수', 'professor', '교육과정', 'curriculum', '연구',
            '학생', 'student', '취업', 'employment', 'job',
            '실습', '프로젝트', 'project', '세미나', 'seminar',
            '학회', 'conference', '워크샵', 'workshop'
        ]
        for keyword in important_keywords:
            if keyword in url.lower():
                priority += 5
        
        return priority

    def clean_text_advanced(self, html, url):
        """향상된 텍스트 정제"""
        if url.lower().endswith('.pdf'):
            return self.extract_pdf_text(html)
        
        try:
            soup = BeautifulSoup(html, "html.parser")
            
            # 불필요한 요소 제거 (확장된 목록)
            remove_selectors = [
                "header", "nav", "footer", "aside",
                ".navigation", ".nav", ".menu", ".sidebar",
                ".header", ".footer", ".top-menu", ".breadcrumb",
                ".sitemap", ".quickmenu", ".quick-menu",
                ".popup", ".modal", ".overlay",
                ".advertisement", ".banner", ".ad",
                ".social", ".share", ".sns",
                "script", "style", "noscript", "meta", "link",
                ".hidden", ".invisible", "[style*='display: none']",
                ".pagination", ".paging",
                ".button", ".btn", "input", "form",
                ".fnctId", ".imageSlide",  # 대진대 특정 요소들
            ]
            
            for selector in remove_selectors:
                for element in soup.select(selector):
                    element.extract()
            
            # 클래스명으로 불필요한 요소 제거
            remove_class_patterns = [
                r'menu', r'nav', r'header', r'footer', r'sidebar',
                r'popup', r'modal', r'overlay', r'banner', r'ad',
                r'social', r'share', r'btn', r'button', r'pagination'
            ]
            
            for tag in soup.find_all(True):
                if tag.get('class'):
                    class_str = ' '.join(tag.get('class')).lower()
                    for pattern in remove_class_patterns:
                        if re.search(pattern, class_str):
                            tag.extract()
                            break
            
            # 텍스트 추출
            text = soup.get_text(separator="\\n", strip=True)
            
            # 텍스트 정제
            lines = text.split('\\n')
            cleaned_lines = []
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # 불필요한 라인 패턴 제거
                skip_patterns = [
                    r'^\\d+$',  # 숫자만 있는 라인
                    r'^\\s*[\\d\\.]+\\s*$',  # 페이지 번호
                    r'fnctId=',  # 대진대 특정 함수 ID
                    r'imageSlide',  # 이미지 슬라이드 관련
                    r'^(이전|다음|처음|마지막)$',  # 네비게이션 텍스트
                    r'^(HOME|home|메뉴|MENU)$',  # 메뉴 관련
                    r'^\\s*(로그인|LOGIN|회원가입)\\s*$',  # 로그인 관련
                ]
                
                skip_line = False
                for pattern in skip_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        skip_line = True
                        break
                
                if not skip_line and len(line) > 2:  # 너무 짧은 라인 제외
                    cleaned_lines.append(line)
            
            # 중복 라인 제거
            unique_lines = []
            seen = set()
            for line in cleaned_lines:
                if line not in seen:
                    unique_lines.append(line)
                    seen.add(line)
            
            final_text = '\\n'.join(unique_lines)
            
            # 최소 텍스트 길이 확인 (기준 완화)
            if len(final_text.strip()) < 30:
                return ""
                
            return final_text.strip()
            
        except Exception as e:
            logger.error(f"텍스트 정제 실패 {url}: {e}")
            return ""

    def extract_pdf_text(self, content):
        """PDF 텍스트 추출"""
        try:
            # content가 bytes인 경우 임시 파일로 저장 후 처리
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            
            text = ""
            with pdfplumber.open(tmp_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\\n"
            
            os.unlink(tmp_path)  # 임시 파일 삭제
            return text.strip()
            
        except Exception as e:
            logger.error(f"PDF 처리 실패: {e}")
            return ""

    def is_duplicate_content(self, text):
        """고급 중복 콘텐츠 감지"""
        if not self.saved_texts or len(text) < 100:
            return False
        
        try:
            # 텍스트 해시 기반 빠른 검사
            text_hash = hashlib.md5(text.encode()).hexdigest()
            text_hashes = [hashlib.md5(t.encode()).hexdigest() for t in self.saved_texts[-100:]]  # 최근 100개만 비교
            
            if text_hash in text_hashes:
                return True
            
            # TF-IDF 기반 유사도 검사 (샘플링)
            sample_texts = self.saved_texts[-50:] if len(self.saved_texts) > 50 else self.saved_texts
            if sample_texts:
                try:
                    vectorizer = TfidfVectorizer(max_features=1000).fit_transform([text] + sample_texts)
                    similarities = cosine_similarity(vectorizer[0:1], vectorizer[1:])[0]
                    return any(similarity > 0.90 for similarity in similarities)
                except:
                    return False
            
            return False
            
        except Exception as e:
            logger.error(f"중복 검사 실패: {e}")
            return False

    def extract_links(self, soup, base_url, current_depth):
        """링크 추출 및 우선순위 정렬"""
        links = set()
        
        for tag in soup.find_all("a", href=True):
            href = tag["href"]
            absolute_url = urljoin(base_url, href)
            
            if self.is_valid_url(absolute_url, current_depth + 1):
                links.add(absolute_url)
                self.url_depths[absolute_url] = current_depth + 1
        
        # 우선순위 기반 정렬
        prioritized_links = sorted(links, key=self.get_url_priority, reverse=True)
        return set(prioritized_links[:200])  # 상위 200개로 확대

    async def crawl_page_async(self, session, url):
        """비동기 페이지 크롤링 (HTTP 요청용)"""
        try:
            timeout = aiohttp.ClientTimeout(total=30)
            async with session.get(url, timeout=timeout) as response:
                if response.status == 200:
                    content = await response.text()
                    return content
                else:
                    logger.warning(f"HTTP {response.status}: {url}")
                    return None
        except Exception as e:
            logger.error(f"비동기 크롤링 실패 {url}: {e}")
            return None

    def crawl_page_selenium(self, driver, url):
        """Selenium 기반 페이지 크롤링 (JavaScript 필요한 페이지용)"""
        try:
            driver.set_page_load_timeout(60)  # 페이지 로드 타임아웃 60초
            driver.implicitly_wait(10)        # 암시적 대기 10초
            
            driver.get(url)
            WebDriverWait(driver, 30).until(  # 대기 시간 15→30초
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            # 페이지 로딩 완료 대기
            time.sleep(3)  # 안전한 대기 시간 증가
            return driver.page_source
        except Exception as e:
            logger.error(f"Selenium 크롤링 실패 {url}: {e}")
            return None

    def process_url(self, url_data):
        """단일 URL 처리"""
        url, use_selenium = url_data
        
        if url in self.visited:
            return None
        
        try:
            logger.info(f"🔍 크롤링: {url}")
            
            # 도메인별 통계 업데이트
            domain = urlparse(url).netloc
            self.domain_stats[domain] += 1
            
            content = None
            
            if use_selenium:
                # JavaScript가 필요한 페이지 (재시도 로직 추가)
                driver = self.create_selenium_driver()
                try:
                    content = self.crawl_page_selenium(driver, url)
                    if not content:
                        # 첫 번째 시도 실패 시 HTTP로 재시도
                        logger.warning(f"Selenium 실패, HTTP로 재시도: {url}")
                        headers = {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        }
                        response = requests.get(url, headers=headers, timeout=30)
                        if response.status_code == 200:
                            content = response.text
                finally:
                    driver.quit()
            else:
                # 일반 HTTP 요청
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
                response = requests.get(url, headers=headers, timeout=30)
                if response.status_code == 200:
                    content = response.text
            
            if not content:
                return None
            
            # 텍스트 정제
            cleaned_text = self.clean_text_advanced(content, url)
            
            if not cleaned_text or len(cleaned_text) < 50:
                logger.warning(f"⚠️  텍스트 부족: {url}")
                return None
            
            # 중복 검사
            if self.is_duplicate_content(cleaned_text):
                logger.info(f"📋 중복 콘텐츠: {url}")
                return None
            
            # 링크 추출
            soup = BeautifulSoup(content, "html.parser")
            current_depth = self.url_depths.get(url, 0)
            new_links = self.extract_links(soup, url, current_depth)
            
            return {
                'url': url,
                'text': cleaned_text,
                'links': new_links,
                'depth': current_depth
            }
            
        except Exception as e:
            logger.error(f"❌ 처리 실패 {url}: {e}")
            return None

    def save_page(self, data, index):
        """페이지 데이터 저장"""
        filename = os.path.join(self.output_dir, f"page_{index:05d}.txt")
        
        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"[URL] {data['url']}\\n")
                f.write(f"[DEPTH] {data['depth']}\\n")
                f.write(f"[DOMAIN] {urlparse(data['url']).netloc}\\n")
                f.write(f"[TIMESTAMP] {datetime.now().isoformat()}\\n")
                f.write(f"[LENGTH] {len(data['text'])}\\n\\n")
                f.write(data['text'])
            
            self.saved_texts.append(data['text'])
            self.saved_urls.append(data['url'])
            
            logger.info(f"✅ 저장: {data['url']} ({len(data['text'])}자)")
            
        except Exception as e:
            logger.error(f"저장 실패 {data['url']}: {e}")

    def run(self):
        """메인 크롤링 실행"""
        logger.info(f"🚀 고성능 크롤링 시작 - {self.max_workers}개 워커 사용")
        
        page_index = len(self.saved_urls)
        
        try:
            while self.to_visit:
                # URL 우선순위 정렬
                sorted_urls = sorted(list(self.to_visit), key=self.get_url_priority, reverse=True)
                
                # 배치 크기 (M4 Pro 성능 최적화)
                batch_size = min(self.max_workers * 2, len(sorted_urls))
                current_batch = sorted_urls[:batch_size]
                
                # 처리할 URL을 to_visit에서 제거
                for url in current_batch:
                    self.to_visit.remove(url)
                
                # JavaScript 필요 여부 판단
                url_tasks = []
                for url in current_batch:
                    # 특정 패턴은 Selenium 사용
                    use_selenium = any(pattern in url for pattern in [
                        'artclView.do', 'subview.do', 'board', 'bbs'
                    ])
                    url_tasks.append((url, use_selenium))
                
                # 병렬 처리
                results = []
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    future_to_url = {executor.submit(self.process_url, task): task[0] 
                                   for task in url_tasks}
                    
                    for future in as_completed(future_to_url):
                        url = future_to_url[future]
                        try:
                            result = future.result()
                            if result:
                                results.append(result)
                                
                                # 방문 처리
                                self.visited.add(result['url'])
                                
                                # 새 링크 추가
                                new_links = result['links'] - self.visited
                                self.to_visit.update(new_links)
                                
                                # 페이지 저장
                                self.save_page(result, page_index)
                                page_index += 1
                                
                        except Exception as e:
                            logger.error(f"결과 처리 실패 {url}: {e}")
                        
                        # 방문 처리 (실패한 경우에도)
                        self.visited.add(url)
                
                # 주기적 상태 저장
                if page_index % 20 == 0:
                    self.save_state()
                    logger.info(f"📊 진행 상황: 저장 {page_index}개, 대기 {len(self.to_visit)}개")
                
                # 서버 부하 방지 및 안정성 확보
                time.sleep(2)  # 대기 시간 증가
                
        except KeyboardInterrupt:
            logger.info("⏸️  사용자 중단 - 상태 저장 중...")
            self.save_state()
        except Exception as e:
            logger.error(f"크롤링 오류: {e}")
            self.save_state()
        
        finally:
            self.save_state()
            logger.info(f"🏁 크롤링 완료! 총 {page_index}개 페이지 저장")
            logger.info(f"📈 도메인별 통계: {dict(self.domain_stats)}")

if __name__ == "__main__":
    crawler = EnhancedCrawler()
    crawler.run()