#!/usr/bin/env python3
"""
전략적 보완 크롤링 시스템
- 기존 데이터 활용 + 누락 영역 집중 크롤링
- 도서관 얕게, 게시판 깊게 전략 구현
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
from collections import defaultdict
import hashlib
from datetime import datetime
import logging

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('strategic_crawler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class StrategicCrawler:
    def __init__(self):
        # M4 Pro 최대 성능 설정
        self.max_workers = 16
        self.max_concurrent_requests = 50
        self.max_selenium_instances = 8
        
        # 디렉토리 설정
        self.output_dir = "strategic_output"
        self.state_file = "strategic_crawler_state.json"
        self.existing_data_dir = "enhanced_output"
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 크롤링 상태
        self.visited = set()
        self.to_visit = set()
        self.existing_urls = set()  # 기존 크롤링된 URL
        self.saved_texts = []
        self.saved_urls = []
        self.url_depths = {}
        self.domain_stats = defaultdict(int)
        
        # 기존 데이터 로드
        self.load_existing_data()
        
        # 대폭 확장된 우선순위 URL (모든 학과 및 기관 포함)
        self.priority_targets = [
            # 메인 대진대학교 사이트
            "https://www.daejin.ac.kr/sites/daejin/index.do",
            "https://www.daejin.ac.kr/daejin/index.do",
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
            
            # 전체 학과 홈페이지 - 인문예술대학
            "https://eng.daejin.ac.kr/",                   # 영어영문학과
            "https://history.daejin.ac.kr/",               # 역사문화콘텐츠학과
            "https://literature.daejin.ac.kr/",            # 문예콘텐츠창작학과
            "https://arte.daejin.ac.kr/",                  # 현대미술전공
            "https://design.daejin.ac.kr/",                # 시각디자인학과
            "https://djfilm.daejin.ac.kr/",                # 영화영상학과
            "https://acting.daejin.ac.kr/",                # 연기예술학과
            "https://music.daejin.ac.kr/",                 # 실용음악학과
            
            # 글로벌산업통상대학
            "https://economics.daejin.ac.kr/",             # 글로벌경제학과
            "https://sm.daejin.ac.kr/",                    # 경영학과
            "https://intlbusiness.daejin.ac.kr/",          # 국제통상학과
            "https://camde.daejin.ac.kr/",                 # 중국어문화학과
            
            # 공공인재대학
            "https://law.daejin.ac.kr/",                   # 공공인재법학과
            "https://pai.daejin.ac.kr/",                   # 행정정보학과
            "https://welfare.daejin.ac.kr/",               # 사회복지학과
            "https://child.daejin.ac.kr/",                 # 아동학과
            "https://media.daejin.ac.kr/",                 # 미디어커뮤니케이션학과
            "https://library.daejin.ac.kr/",               # 문헌정보학과
            
            # 보건과학대학
            "https://medical.daejin.ac.kr/",               # 의생명과학과
            "https://nurse.daejin.ac.kr/",                 # 간호학과
            "https://sports.daejin.ac.kr/",                # 스포츠건강과학과
            "https://food.daejin.ac.kr/",                  # 식품영양학과
            "https://health.daejin.ac.kr/",                # 보건경영학과
            
            # AI융합대학
            "https://ce.daejin.ac.kr/",                    # 컴퓨터공학전공
            "https://aidata.daejin.ac.kr/",                # AI빅데이터전공
            "https://security.daejin.ac.kr/",              # 스마트융합보안학과
            
            # 공과대학
            "https://elec.daejin.ac.kr/",                  # 전기공학전공
            "https://cpe.daejin.ac.kr/",                   # 화학공학전공
            "https://arch.daejin.ac.kr/",                  # 건축공학과
            "https://envir.daejin.ac.kr/",                 # 스마트건설환경공학과
            "https://ie.daejin.ac.kr/",                    # 데이터경영산업공학과
            "https://mech.daejin.ac.kr/",                  # IT기계공학과
            
            # 국제협력대학
            "https://korean.daejin.ac.kr/",                # 한국학과
            
            # 기타 중요 기관
            "https://admission.daejin.ac.kr/",             # 입학처
            "https://job.daejin.ac.kr/",                   # 대학일자리플러스센터
            "https://ctl.daejin.ac.kr/",                   # 교수학습지원센터
            "https://liberal.daejin.ac.kr/",               # 상생교양대학
            "https://international.daejin.ac.kr/",         # 국제교류원
            "https://dormitory.daejin.ac.kr/",             # 생활관
            "https://rotc.daejin.ac.kr/",                  # 학군단
            "https://counseling.daejin.ac.kr/",            # 학생생활상담센터
            
            # 연구기관
            "https://tech.daejin.ac.kr/",                  # 산학협력단
            "https://djss.daejin.ac.kr/",                  # 대진지역상생센터
            "https://hcc.daejin.ac.kr/",                   # 공동기기센터
            
            # 도서관 (제한적)
            "https://library.daejin.ac.kr/main_main.mir",
        ]
        
        # 도메인별 전략적 깊이 설정 (대폭 확장)
        self.domain_strategies = {
            # 도서관 제한적
            'library.daejin.ac.kr': {'max_depth': 2, 'priority': 'low'},
            'ebook.daejin.ac.kr': {'max_depth': 1, 'filter_patterns': [r'product/list', r'search']},
            
            # 메인 사이트 매우 깊게
            'www.daejin.ac.kr': {'max_depth': 25, 'priority': 'highest'},
            
            # AI융합대학 (최우선)
            'ce.daejin.ac.kr': {'max_depth': 30, 'priority': 'highest'},
            'aidata.daejin.ac.kr': {'max_depth': 25, 'priority': 'highest'},
            'security.daejin.ac.kr': {'max_depth': 25, 'priority': 'highest'},
            
            # 인문예술대학
            'eng.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'history.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'literature.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'arte.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'design.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'djfilm.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'acting.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'music.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            
            # 글로벌산업통상대학
            'economics.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'sm.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'intlbusiness.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'camde.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            
            # 공공인재대학
            'law.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'pai.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'welfare.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'child.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'media.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            
            # 보건과학대학
            'medical.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'nurse.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'sports.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'food.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'health.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            
            # 공과대학
            'elec.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'cpe.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'arch.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'envir.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'ie.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            'mech.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            
            # 국제협력대학
            'korean.daejin.ac.kr': {'max_depth': 20, 'priority': 'high'},
            
            # 기타 중요 기관
            'admission.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            'job.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            'ctl.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            'liberal.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            'international.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            'dormitory.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            'rotc.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            'counseling.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            
            # 연구기관
            'tech.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            'djss.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            'hcc.daejin.ac.kr': {'max_depth': 15, 'priority': 'high'},
            
            # 기본값 (새로운 도메인)
            'default': {'max_depth': 15, 'priority': 'medium'}
        }
        
        # 우선순위 패턴 (게시판 중심)
        self.priority_patterns = [
            (r'/bbs/.*/artclView\.do', 100),      # 게시판 게시물 (최고 우선순위)
            (r'/ce/2518/subview\.do\?enc=', 95),  # 컴공과 게시글
            (r'/bbs/.*/', 80),                    # 게시판 목록
            (r'/board/.*/', 75),                  # 게시판 관련
            (r'/notice/', 70),                    # 공지사항
            (r'/subview\.do', 60),                # 서브페이지
            (r'/curriculum/', 50),                # 교육과정
            (r'/professor/', 50),                 # 교수진
            (r'/faculty/', 50),                   # 교수진
            (r'/student/', 45),                   # 학생 관련
            (r'/admission/', 40),                 # 입학 관련
            (r'/employment/', 40),                # 취업 관련
            (r'/index\.do', 30),                  # 메인페이지
        ]
        
        # 제외할 패턴 (최소화)
        self.exclude_patterns = [
            # 전자책 검색 페이지만 제외 (일반 페이지는 허용)
            r'ebook\.daejin\.ac\.kr.*search',
            r'ebook\.daejin\.ac\.kr.*keyword=',
            
            # 시스템 페이지 제외
            r'groupware\.daejin\.ac\.kr',
            r'sso\.daejin\.ac\.kr/login',
            r'webmail\.daejin\.ac\.kr',
            
            # 다운로드 파일만 제외
            r'\.pdf$',
            r'\.doc$',
            r'\.hwp$',
            r'/download\.do',
            
            # 중복 방지 (앵커 링크)
            r'#this$',
            r'#none$',
            r'#link$',
        ]

    def load_existing_data(self):
        """기존 크롤링 데이터 로드"""
        logger.info("🔍 기존 크롤링 데이터 로드 중...")
        
        if not os.path.exists(self.existing_data_dir):
            logger.warning(f"기존 데이터 디렉토리 없음: {self.existing_data_dir}")
            return
        
        count = 0
        for filename in os.listdir(self.existing_data_dir):
            if filename.endswith('.txt'):
                filepath = os.path.join(self.existing_data_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        url_match = re.search(r'\[URL\] (https?://[^\n]+)', content)
                        if url_match:
                            url = url_match.group(1).strip()
                            self.existing_urls.add(url)
                            count += 1
                except Exception as e:
                    logger.warning(f"기존 데이터 로드 오류: {filename} - {e}")
        
        logger.info(f"✅ 기존 URL {count:,}개 로드 완료")

    def is_excluded_url(self, url):
        """URL 제외 여부 검사"""
        for pattern in self.exclude_patterns:
            if re.search(pattern, url):
                return True
        return False

    def get_url_priority(self, url):
        """URL 우선순위 계산"""
        # 기존에 크롤링된 URL은 낮은 우선순위
        if url in self.existing_urls:
            return 0
        
        # 제외 패턴 검사
        if self.is_excluded_url(url):
            return 0
        
        # 우선순위 타겟에 포함된 경우
        if url in self.priority_targets:
            return 1000
        
        # 패턴 기반 우선순위
        for pattern, priority in self.priority_patterns:
            if re.search(pattern, url):
                return priority
        
        return 10  # 기본 우선순위

    def get_domain_strategy(self, domain):
        """도메인별 전략 반환"""
        return self.domain_strategies.get(domain, self.domain_strategies['default'])

    def should_crawl_url(self, url, depth):
        """URL 크롤링 여부 결정"""
        # 이미 방문한 URL
        if url in self.visited or url in self.existing_urls:
            return False
        
        # 제외 패턴
        if self.is_excluded_url(url):
            return False
        
        # 도메인 전략 확인
        parsed = urlparse(url)
        domain = parsed.netloc
        strategy = self.get_domain_strategy(domain)
        
        # 스킵 도메인
        if strategy.get('skip', False):
            return False
        
        # 깊이 제한
        max_depth = strategy['max_depth']
        if depth > max_depth:
            return False
        
        # 전자책 필터링
        if 'ebook.daejin.ac.kr' in domain:
            filter_patterns = strategy.get('filter_patterns', [])
            for pattern in filter_patterns:
                if re.search(pattern, url):
                    return depth <= 1  # 전자책은 매우 얕게만
        
        return True

    async def crawl_with_selenium(self, url, depth=0):
        """Selenium을 사용한 크롤링"""
        try:
            options = Options()
            options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
            
            driver = webdriver.Chrome(options=options)
            driver.set_page_load_timeout(15)
            
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
                    if priority > 0:
                        links.append((full_url, priority))
            
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
            try:
                driver.quit()
            except:
                pass
            return None

    def extract_clean_text(self, soup):
        """깔끔한 텍스트 추출"""
        # 불필요한 태그 제거
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            tag.decompose()
        
        # 텍스트 추출 및 정제
        text = soup.get_text()
        lines = [line.strip() for line in text.splitlines()]
        text = '\n'.join(line for line in lines if line and len(line) > 2)
        
        return text

    def save_page_content(self, page_data):
        """페이지 내용 저장"""
        if not page_data or len(page_data['content'].strip()) < 100:
            return False
        
        filename = f"strategic_page_{len(self.saved_texts):05d}.txt"
        filepath = os.path.join(self.output_dir, filename)
        
        content = f"[URL] {page_data['url']}\n"
        content += f"[DEPTH] {page_data['depth']}\n"
        content += f"[DOMAIN] {page_data['domain']}\n"
        content += f"[TIMESTAMP] {page_data['timestamp']}\n"
        content += f"[LENGTH] {page_data['length']}\n\n"
        content += page_data['content']
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            self.saved_texts.append(filepath)
            self.saved_urls.append(page_data['url'])
            self.domain_stats[page_data['domain']] += 1
            
            logger.info(f"💾 저장: {filename} ({page_data['domain']}) - {page_data['length']}자")
            return True
            
        except Exception as e:
            logger.error(f"파일 저장 오류: {e}")
            return False

    def save_state(self):
        """상태 저장"""
        state = {
            'visited': list(self.visited),
            'to_visit': list(self.to_visit),
            'saved_urls': self.saved_urls,
            'url_depths': self.url_depths,
            'domain_stats': dict(self.domain_stats),
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"상태 저장 오류: {e}")

    async def run_strategic_crawling(self, max_pages=3000):
        """전략적 보완 크롤링 실행"""
        logger.info("🚀 전략적 보완 크롤링 시작")
        logger.info(f"📊 기존 URL: {len(self.existing_urls):,}개")
        logger.info(f"🎯 우선순위 타겟: {len(self.priority_targets)}개")
        
        # 우선순위 타겟으로 시작
        for url in self.priority_targets:
            if url not in self.existing_urls:
                priority = self.get_url_priority(url)
                self.to_visit.add((url, 0, priority))
        
        processed = 0
        
        with ThreadPoolExecutor(max_workers=self.max_selenium_instances) as executor:
            while self.to_visit and processed < max_pages:
                # 우선순위 순으로 정렬
                current_batch = sorted(list(self.to_visit), key=lambda x: x[2], reverse=True)[:self.max_selenium_instances]
                self.to_visit.clear()
                
                # 병렬 처리
                futures = []
                for url, depth, priority in current_batch:
                    if url not in self.visited:
                        future = executor.submit(asyncio.run, self.crawl_with_selenium(url, depth))
                        futures.append(future)
                        self.visited.add(url)
                
                # 결과 처리
                for future in as_completed(futures):
                    try:
                        page_data = future.result()
                        if page_data:
                            # 페이지 저장
                            if self.save_page_content(page_data):
                                processed += 1
                            
                            # 새 링크 추가
                            for link_url, link_priority in page_data['links']:
                                if link_url not in self.visited and link_url not in self.existing_urls:
                                    self.to_visit.add((link_url, page_data['depth'] + 1, link_priority))
                    
                    except Exception as e:
                        logger.error(f"페이지 처리 오류: {e}")
                
                # 주기적 상태 저장
                if processed % 50 == 0:
                    self.save_state()
                    logger.info(f"📈 진행상황: {processed}/{max_pages} 페이지 처리")
                    logger.info(f"🌐 도메인별 수집: {dict(self.domain_stats)}")
                
                # 속도 조절
                await asyncio.sleep(1)
        
        # 최종 상태 저장
        self.save_state()
        
        logger.info("✅ 전략적 크롤링 완료")
        logger.info(f"📊 총 수집: {processed}개 페이지")
        logger.info(f"🌐 도메인별 통계: {dict(self.domain_stats)}")

if __name__ == "__main__":
    crawler = StrategicCrawler()
    asyncio.run(crawler.run_strategic_crawling(max_pages=3000))