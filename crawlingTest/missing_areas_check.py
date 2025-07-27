#!/usr/bin/env python3
"""
누락된 영역 확인 및 우선순위 URL 검증
"""

import requests
import re
from urllib.parse import urlparse
import time

def check_url_status(url):
    """URL 접근 가능성 확인"""
    try:
        response = requests.head(url, timeout=10, allow_redirects=True)
        return response.status_code == 200, response.status_code
    except Exception as e:
        return False, str(e)

def check_priority_urls():
    """사용자 요구사항 URL 확인"""
    
    # 사용자가 명시한 중요 URL들
    priority_urls = [
        # 메인 사이트 학과별 페이지
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
        
        # 컴퓨터공학과 중점
        "https://ce.daejin.ac.kr/ce/index.do",
        "https://ce.daejin.ac.kr/ce/2518/subview.do",
        
        # 도서관 (얕게만)
        "https://library.daejin.ac.kr/main_main.mir",
        
        # 샘플 게시글 URL
        "https://ce.daejin.ac.kr/ce/2518/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGY2UlMkY2MDYlMkY0NTQxNTYlMkZhcnRjbFZpZXcuZG8lM0ZwYWdlJTNEMSUyNnNyY2hDb2x1bW4lM0QlMjZzcmNoV3JkJTNEJTI2YmJzQ2xTZXElM0QlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2"
    ]
    
    print("🔍 우선순위 URL 접근성 검사")
    print("=" * 60)
    
    accessible_urls = []
    inaccessible_urls = []
    
    for i, url in enumerate(priority_urls, 1):
        print(f"[{i:2d}/{len(priority_urls)}] 검사 중: {url}")
        
        is_accessible, status = check_url_status(url)
        
        if is_accessible:
            accessible_urls.append(url)
            print(f"    ✅ 접근 가능 (HTTP {status})")
        else:
            inaccessible_urls.append((url, status))
            print(f"    ❌ 접근 불가 ({status})")
        
        time.sleep(0.5)  # 속도 제한
    
    print("\n" + "=" * 60)
    print(f"📊 결과 요약:")
    print(f"   ✅ 접근 가능: {len(accessible_urls)}개")
    print(f"   ❌ 접근 불가: {len(inaccessible_urls)}개")
    
    if inaccessible_urls:
        print(f"\n❌ 접근 불가능한 URL:")
        for url, status in inaccessible_urls:
            print(f"   - {url} ({status})")
    
    return accessible_urls, inaccessible_urls

def analyze_missing_patterns():
    """기존 데이터에서 누락된 패턴 분석"""
    
    print("\n🔍 누락된 패턴 분석")
    print("=" * 60)
    
    # 기존 데이터 로드
    existing_urls = set()
    try:
        with open("enhanced_crawler_state.json", 'r', encoding='utf-8') as f:
            import json
            state = json.load(f)
            visited = state.get('visited', [])
            
            for url in visited:
                existing_urls.add(url)
            
            print(f"📊 기존 URL 수: {len(existing_urls):,}개")
            
    except Exception as e:
        print(f"❌ 기존 상태 파일 로드 실패: {e}")
        return
    
    # 패턴별 분석
    patterns = {
        'www.daejin.ac.kr 학과 페이지': r'www\.daejin\.ac\.kr/daejin/\d+/subview\.do',
        'ce.daejin.ac.kr 게시글': r'ce\.daejin\.ac\.kr/.*artclView\.do',
        'ce.daejin.ac.kr 전체': r'ce\.daejin\.ac\.kr',
        '게시판 게시글 전체': r'/bbs/.*/artclView\.do',
        '도서관 페이지': r'library\.daejin\.ac\.kr',
    }
    
    pattern_counts = {}
    for name, pattern in patterns.items():
        count = len([url for url in existing_urls if re.search(pattern, url)])
        pattern_counts[name] = count
        print(f"   {name}: {count:,}개")
    
    return pattern_counts

if __name__ == "__main__":
    # URL 접근성 검사
    accessible, inaccessible = check_priority_urls()
    
    # 누락 패턴 분석  
    patterns = analyze_missing_patterns()
    
    print(f"\n🎯 전략적 크롤링 권장사항:")
    print(f"   1. 접근 가능한 {len(accessible)}개 우선순위 URL 집중 크롤링")
    print(f"   2. 각 학과 게시판 깊이 우선 탐색")
    print(f"   3. 도서관은 메인 페이지만 얕게 수집")
    print(f"   4. 예상 추가 수집량: 2,000-3,000개 페이지")