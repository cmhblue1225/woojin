#!/usr/bin/env python3
"""
향상된 전략적 크롤링 시스템
- 기존 데이터 무시하고 완전 새로운 크롤링
- 게시판 중심 깊이 우선 탐색
- 더 많은 학과 홈페이지 커버
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

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('enhanced_strategic_crawler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class EnhancedStrategicCrawler:
    def __init__(self):
        # 성능 설정 (M4 Pro 최적화)
        self.max_workers = 12
        self.max_concurrent_requests = 40
        self.max_selenium_instances = 6
        
        # 디렉토리 설정
        self.output_dir = "enhanced_strategic_output"
        self.state_file = "enhanced_strategic_crawler_state.json"
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 크롤링 상태 (기존 데이터 무시)
        self.visited = set()
        self.to_visit = deque()
        self.saved_texts = []
        self.saved_urls = []
        self.url_depths = {}
        self.domain_stats = defaultdict(int)
        self.priority_queue = deque()
        
        # 대학 홈페이지 우선순위 URL (대폭 확장)
        self.seed_urls = [
            # 메인 대진대학교 사이트 및 주요 페이지
            "https://www.daejin.ac.kr/sites/daejin/index.do",
            "https://www.daejin.ac.kr/daejin/index.do",
            "https://www.daejin.ac.kr/daejin/1135/subview.do",  # 공지사항
            "https://www.daejin.ac.kr/daejin/1139/subview.do",  # 일반소식
            "https://www.daejin.ac.kr/daejin/1140/subview.do",  # 학사공지
            "https://www.daejin.ac.kr/daejin/1141/subview.do",  # 행사안내
            "https://www.daejin.ac.kr/daejin/1142/subview.do",  # 채용정보
            
            # 대학 구조
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
            "https://ce.daejin.ac.kr/",                    # 컴퓨터공학전공
            "https://ce.daejin.ac.kr/main.php",
            "https://ce.daejin.ac.kr/bbs/board.php?bo_table=notice",  # 공지사항
            "https://ce.daejin.ac.kr/bbs/board.php?bo_table=job",     # 취업정보
            "https://aidata.daejin.ac.kr/",                # AI빅데이터전공
            "https://security.daejin.ac.kr/",              # 스마트융합보안학과
            
            # 인문예술대학
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
            
            # 보건과학대학
            "https://medical.daejin.ac.kr/",               # 의생명과학과
            "https://nurse.daejin.ac.kr/",                 # 간호학과
            "https://sports.daejin.ac.kr/",                # 스포츠건강과학과
            "https://food.daejin.ac.kr/",                  # 식품영양학과
            "https://health.daejin.ac.kr/",                # 보건경영학과
            
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
        ]
        
        # 도메인별 크롤링 전략
        self.domain_strategies = {
            # 메인 사이트 - 매우 깊게
            'www.daejin.ac.kr': {'max_depth': 20, 'priority': 1000},
            
            # AI융합대학 - 최우선
            'ce.daejin.ac.kr': {'max_depth': 25, 'priority': 950},
            'aidata.daejin.ac.kr': {'max_depth': 20, 'priority': 900},
            'security.daejin.ac.kr': {'max_depth': 20, 'priority': 900},
            
            # 주요 학과 - 높은 우선순위
            'economics.daejin.ac.kr': {'max_depth': 15, 'priority': 800},
            'sm.daejin.ac.kr': {'max_depth': 15, 'priority': 800},
            'law.daejin.ac.kr': {'max_depth': 15, 'priority': 800},
            'media.daejin.ac.kr': {'max_depth': 15, 'priority': 800},
            'medical.daejin.ac.kr': {'max_depth': 15, 'priority': 800},
            'nurse.daejin.ac.kr': {'max_depth': 15, 'priority': 800},
            
            # 기타 학과 - 중간 우선순위
            'default': {'max_depth': 12, 'priority': 500}
        }
        
        # 우선순위가 높은 URL 패턴
        self.high_priority_patterns = [
            (r'/bbs/.*/artclView\\.do', 100),      # 게시판 게시물
            (r'/ce/2518/subview\\.do\\?enc=', 95), # 컴공과 게시글
            (r'/bbs/.*/', 80),                     # 게시판 목록
            (r'/board/.*/', 75),                   # 게시판 관련
            (r'/notice/', 70),                     # 공지사항
            (r'/subview\\.do', 60),                # 서브페이지
            (r'/curriculum/', 50),                 # 교육과정
            (r'/professor/', 50),                  # 교수진
            (r'/faculty/', 50),                    # 교수진
            (r'/student/', 45),                    # 학생 관련
            (r'/admission/', 40),                  # 입학 관련
        ]
        
        # 제외할 패턴 (최소화)
        self.exclude_patterns = [
            r'\\.(pdf|doc|hwp|zip|exe)$',
            r'/download\\.do',
            r'groupware\\.daejin\\.ac\\.kr',
            r'webmail\\.daejin\\.ac\\.kr',
            r'sso\\.daejin\\.ac\\.kr',
            r'#none$',
            r'#this$',
            r'javascript:',
        ]

    def should_crawl_url(self, url, depth):
        """URL 크롤링 여부 결정 (기존 데이터와 무관하게)"""
        # 이미 방문한 URL
        if url in self.visited:
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
        strategy = self.domain_strategies.get(domain, self.domain_strategies['default'])
        if depth > strategy['max_depth']:
            return False
        
        return True

    def get_url_priority(self, url):
        """URL 우선순위 계산"""
        # 시드 URL은 최고 우선순위
        if url in self.seed_urls:
            return 1000
        
        # 패턴 기반 우선순위
        for pattern, priority in self.high_priority_patterns:
            if re.search(pattern, url):
                return priority
        
        # 도메인 기반 우선순위
        parsed = urlparse(url)
        domain = parsed.netloc
        strategy = self.domain_strategies.get(domain, self.domain_strategies['default'])
        
        return strategy['priority']

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
            driver.set_page_load_timeout(20)
            
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
        text = '\\n'.join(line for line in lines if line and len(line) > 2)
        
        return text

    def save_page_content(self, page_data):
        """페이지 내용 저장"""
        if not page_data or len(page_data['content'].strip()) < 200:
            return False
        
        filename = f"enhanced_strategic_page_{len(self.saved_texts):05d}.txt"
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
            
            self.saved_texts.append(filepath)
            self.saved_urls.append(page_data['url'])
            self.domain_stats[page_data['domain']] += 1
            
            logger.info(f"💾 저장: {filename} ({page_data['domain']}) - {page_data['length']}자")
            return True
            
        except Exception as e:
            logger.error(f"파일 저장 오류: {e}")
            return False

    async def run_enhanced_crawling(self, max_pages=5000):
        """향상된 전략적 크롤링 실행"""
        logger.info("🚀 향상된 전략적 크롤링 시작")
        logger.info(f"🎯 시드 URL: {len(self.seed_urls)}개")
        logger.info(f"📊 목표 페이지: {max_pages:,}개")
        
        # 시드 URL로 시작
        for url in self.seed_urls:
            priority = self.get_url_priority(url)
            self.priority_queue.append((url, 0, priority))
        
        processed = 0
        
        with ThreadPoolExecutor(max_workers=self.max_selenium_instances) as executor:
            while (self.priority_queue or self.to_visit) and processed < max_pages:
                # 우선순위 큐에서 가져오기
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
                    break
                
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
                            
                            # 새 링크를 우선순위에 따라 분류
                            for link_url, link_priority, link_depth in page_data['links']:
                                if link_url not in self.visited:
                                    if link_priority >= 70:  # 높은 우선순위
                                        self.priority_queue.append((link_url, link_depth, link_priority))
                                    else:  # 일반 우선순위
                                        self.to_visit.append((link_url, link_depth, link_priority))
                    
                    except Exception as e:
                        logger.error(f"페이지 처리 오류: {e}")
                
                # 주기적 상태 보고
                if processed % 100 == 0:
                    logger.info(f"📈 진행상황: {processed}/{max_pages} 페이지 처리")
                    logger.info(f"🌐 도메인별 수집: {dict(self.domain_stats)}")
                    logger.info(f"📋 대기 중: 우선순위 {len(self.priority_queue)}개, 일반 {len(self.to_visit)}개")
                
                # 속도 조절
                await asyncio.sleep(0.5)
        
        logger.info("✅ 향상된 전략적 크롤링 완료")
        logger.info(f"📊 총 수집: {processed}개 페이지")
        logger.info(f"🌐 도메인별 통계: {dict(self.domain_stats)}")
        
        return processed

if __name__ == "__main__":
    crawler = EnhancedStrategicCrawler()
    result = asyncio.run(crawler.run_enhanced_crawling(max_pages=5000))
    print(f"크롤링 완료: {result}개 페이지 수집")