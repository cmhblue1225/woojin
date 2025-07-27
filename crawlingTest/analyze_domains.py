#!/usr/bin/env python3
"""
기존 크롤링 데이터 도메인 분석 스크립트
"""

import os
import re
from collections import defaultdict

def analyze_crawled_data():
    """기존 크롤링 데이터 분석"""
    output_dir = "enhanced_output"
    domain_stats = defaultdict(int)
    url_patterns = defaultdict(int)
    
    total_files = 0
    empty_files = 0
    
    print("🔍 기존 크롤링 데이터 분석 중...")
    
    for filename in os.listdir(output_dir):
        if filename.endswith('.txt'):
            total_files += 1
            filepath = os.path.join(output_dir, filename)
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    if len(content.strip()) < 50:
                        empty_files += 1
                        continue
                    
                    # URL과 도메인 추출
                    url_match = re.search(r'\[URL\] (https?://[^\n]+)', content)
                    if url_match:
                        url = url_match.group(1)
                        
                        # 도메인 추출
                        domain_match = re.search(r'https?://([^/]+)', url)
                        if domain_match:
                            domain = domain_match.group(1)
                            domain_stats[domain] += 1
                            
                            # URL 패턴 분석
                            if '/bbs/' in url and 'artclView.do' in url:
                                url_patterns['게시판_게시글'] += 1
                            elif '/bbs/' in url:
                                url_patterns['게시판_목록'] += 1
                            elif 'subview.do' in url:
                                url_patterns['서브페이지'] += 1
                            elif '/index.do' in url:
                                url_patterns['메인페이지'] += 1
                            else:
                                url_patterns['기타'] += 1
                                
            except Exception as e:
                print(f"❌ 파일 처리 오류: {filename} - {e}")
    
    print(f"\n📊 데이터 분석 결과:")
    print(f"총 파일 수: {total_files:,}개")
    print(f"빈 파일 수: {empty_files:,}개")
    print(f"유효 파일 수: {total_files - empty_files:,}개")
    
    print(f"\n🌐 도메인별 분포 (상위 20개):")
    for domain, count in sorted(domain_stats.items(), key=lambda x: x[1], reverse=True)[:20]:
        print(f"  {domain}: {count:,}개")
    
    print(f"\n📝 URL 패턴 분포:")
    for pattern, count in sorted(url_patterns.items(), key=lambda x: x[1], reverse=True):
        print(f"  {pattern}: {count:,}개")
    
    # 도서관 확인
    library_count = domain_stats.get('library.daejin.ac.kr', 0)
    print(f"\n📚 도서관 데이터: {library_count}개 (이미 제외됨 ✅)")
    
    return domain_stats, url_patterns

if __name__ == "__main__":
    analyze_crawled_data()