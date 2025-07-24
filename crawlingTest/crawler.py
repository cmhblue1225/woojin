
import os
import time
import json
import requests
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import pdfplumber
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from concurrent.futures import ThreadPoolExecutor, as_completed
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Selenium 설정
def create_driver():
    options = Options()
    options.headless = True
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
    return webdriver.Chrome(options=options)

# 시작 URL 목록
start_urls = [
    "https://www.daejin.ac.kr/sites/daejin/index.do",
    "https://sm.daejin.ac.kr/sm/index.do",
    "https://swcg.daejin.ac.kr/swcg/index.do",
    "https://ce.daejin.ac.kr/ce/index.do",
    "https://eng.daejin.ac.kr/eng/index.do",
    "https://law.daejin.ac.kr/law/index.do",
]

# 상태 저장 파일
state_file = "crawler_state.json"
output_dir = "output"
os.makedirs(output_dir, exist_ok=True)

# 방문한 URL, 방문할 URL, 저장된 텍스트 관리
visited = set()
to_visit = set(start_urls)
saved_texts = []
saved_urls = []

# 상태 로드
def load_state():
    global visited, to_visit, saved_texts, saved_urls
    if os.path.exists(state_file):
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
            visited.update(state.get("visited", []))
            to_visit.update(state.get("to_visit", []))
            saved_texts.extend(state.get("saved_texts", []))
            saved_urls.extend(state.get("saved_urls", []))
            print(f"📂 상태 로드: {len(visited)}개의 방문 URL, {len(to_visit)}개의 대기 URL")

# 상태 저장
def save_state():
    state = {
        "visited": list(visited),
        "to_visit": list(to_visit),
        "saved_texts": saved_texts,
        "saved_urls": saved_urls
    }
    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False)
    print(f"💾 상태 저장: {len(visited)}개의 방문 URL, {len(to_visit)}개의 대기 URL")

# 유효한 URL인지 확인
def is_valid_url(url):
    try:
        parsed = urlparse(url)
        if re.search(r'\.(pdf|jpg|png|gif|doc|docx|zip)$', url, re.IGNORECASE):
            return False
        return parsed.scheme in ("http", "https") and "daejin.ac.kr" in parsed.netloc
    except:
        return False

# 텍스트 정리 함수
def clean_text(html, url):
    if url.lower().endswith('.pdf'):
        try:
            with pdfplumber.open(html) as pdf:
                text = ""
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                return text.strip()
        except Exception as e:
            log_error(url, f"PDF 처리 실패: {e}")
            return ""
    
    try:
        soup = BeautifulSoup(html, "html.parser")
        # 불필요한 요소 제거
        for tag in soup.select("header, nav, footer, .sitemap, .quickmenu, script, style, noscript"):
            tag.extract()
        for tag in soup.find_all(class_=re.compile("menu|nav|sitemap|footer|quickmenu|popup", re.I)):
            tag.extract()
        text = soup.get_text(separator="\n", strip=True)
        text = re.sub(r'\n\s*\n', '\n', text).strip()
        return text if text else ""
    except Exception as e:
        log_error(url, f"HTML 파싱 실패: {e}")
        return ""

# 파일 저장 함수
def save_to_file(url, text, idx):
    filename = os.path.join(output_dir, f"page_{idx}.txt")
    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"[URL] {url}\n\n{text}")
    saved_texts.append(text)
    saved_urls.append(url)

# 에러 로깅 함수
def log_error(url, error):
    with open(os.path.join(output_dir, "error_log.txt"), "a", encoding="utf-8") as f:
        f.write(f"[ERROR] {url}: {str(error)}\n")

# 중복 콘텐츠 감지
def is_duplicate(text):
    if not saved_texts:
        return False
    vectorizer = TfidfVectorizer().fit_transform([text] + saved_texts)
    similarities = cosine_similarity(vectorizer[0:1], vectorizer[1:])[0]
    return any(similarity > 0.95 for similarity in similarities)

# 게시판 게시물 링크 추출
def extract_board_links(soup, base_url):
    board_links = set()
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if re.search(r'/(bbs|artclView\.do|subview\.do)', href, re.IGNORECASE):
            next_url = urljoin(base_url, href)
            if is_valid_url(next_url) and next_url not in visited:
                board_links.add(next_url)
    return board_links

# 단일 페이지 크롤링
def crawl_page(url, driver):
    if url in visited or not is_valid_url(url):
        return set(), None, None

    try:
        print(f"📄 크롤링 중: {url}")
        if url.lower().endswith('.pdf'):
            headers = {"User-Agent": "Mozilla/5.0"}
            response = requests.get(url, headers=headers, timeout=10, stream=True)
            response.raise_for_status()
            content = response.content
        else:
            driver.get(url)
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            content = driver.page_source

        text = clean_text(content, url)
        if not text:
            print(f"⚠️ 빈 텍스트: {url}")
            log_error(url, "빈 텍스트 반환")
            return set(), None, None

        if is_duplicate(text):
            print(f"⚠️ 중복 콘텐츠: {url}")
            log_error(url, "중복 콘텐츠 감지")
            return set(), None, None

        new_links = set()
        if not url.lower().endswith('.pdf'):
            soup = BeautifulSoup(content, "html.parser")
            new_links.update(extract_board_links(soup, url))
            for tag in soup.find_all("a", href=True):
                next_url = urljoin(url, tag["href"])
                if is_valid_url(next_url) and next_url not in visited:
                    new_links.add(next_url)

        return new_links, text, url

    except Exception as e:
        print(f"❌ 실패: {url} → {e}")
        log_error(url, e)
        return set(), None, None

# 메인 크롤링 루프
def main():
    global visited, to_visit
    load_state()
    idx = len(saved_urls)
    max_workers = 4  # 스레드 수 (시스템 성능에 따라 조정)

    while to_visit:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            drivers = [create_driver() for _ in range(max_workers)]
            try:
                url_batch = list(to_visit)[:max_workers]
                to_visit.difference_update(url_batch)
                futures = {executor.submit(crawl_page, url, drivers[i]): url for i, url in enumerate(url_batch)}

                for future in as_completed(futures):
                    url = futures[future]
                    new_links, text, crawled_url = future.result()
                    if text and crawled_url:
                        visited.add(crawled_url)
                        save_to_file(crawled_url, text, idx)
                        idx += 1
                        print(f"✅ 저장 완료: {crawled_url} (page_{idx}.txt)")
                    to_visit.update(new_links - visited)
                    save_state()

            finally:
                for driver in drivers:
                    driver.quit()

        time.sleep(0.5)  # 서버 부하 방지

    print(f"\n✅ 크롤링 완료! 총 {idx}개의 페이지 저장됨.")

if __name__ == "__main__":
    main()
