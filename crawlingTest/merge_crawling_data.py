#!/usr/bin/env python3
"""
기존 + 신규 크롤링 데이터 통합 스크립트
RAG 시스템 임베딩용 데이터 준비
"""

import os
import shutil
import json
import re
from datetime import datetime
from collections import defaultdict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CrawlingDataMerger:
    def __init__(self):
        self.existing_dir = "enhanced_output"
        self.strategic_dir = "strategic_output"
        self.merged_dir = "merged_output"
        self.stats = defaultdict(int)
        
    def create_merged_directory(self):
        """통합 디렉토리 생성"""
        if os.path.exists(self.merged_dir):
            backup_dir = f"{self.merged_dir}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            shutil.move(self.merged_dir, backup_dir)
            logger.info(f"📁 기존 디렉토리 백업: {backup_dir}")
        
        os.makedirs(self.merged_dir, exist_ok=True)
        logger.info(f"📁 통합 디렉토리 생성: {self.merged_dir}")

    def analyze_file_content(self, filepath):
        """파일 내용 분석"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # URL과 도메인 추출
            url_match = re.search(r'\[URL\] (https?://[^\n]+)', content)
            domain_match = re.search(r'\[DOMAIN\] ([^\n]+)', content)
            length_match = re.search(r'\[LENGTH\] (\d+)', content)
            
            url = url_match.group(1) if url_match else ""
            domain = domain_match.group(1) if domain_match else ""
            length = int(length_match.group(1)) if length_match else len(content)
            
            # 품질 분석
            quality_score = self.calculate_quality_score(content, url)
            
            return {
                'url': url,
                'domain': domain,
                'length': length,
                'quality_score': quality_score,
                'content': content
            }
            
        except Exception as e:
            logger.warning(f"❌ 파일 분석 오류 {filepath}: {e}")
            return None

    def calculate_quality_score(self, content, url):
        """컨텐츠 품질 점수 계산"""
        score = 0
        
        # 길이 점수 (100-2000자: 최고점)
        content_length = len(content)
        if 100 <= content_length <= 2000:
            score += 10
        elif 50 <= content_length < 100:
            score += 5
        elif content_length > 2000:
            score += 7
        
        # URL 패턴 점수
        if '/bbs/' in url and 'artclView.do' in url:
            score += 15  # 게시판 게시글
        elif '/bbs/' in url:
            score += 10  # 게시판 목록
        elif 'subview.do' in url:
            score += 8   # 서브페이지
        elif '/index.do' in url:
            score += 5   # 메인페이지
        
        # 도메인 점수
        if 'ce.daejin.ac.kr' in url:
            score += 5   # 컴공과 우대
        elif 'www.daejin.ac.kr' in url:
            score += 3   # 메인 사이트
        elif any(dept in url for dept in ['law', 'eng', 'food', 'nurse']):
            score += 4   # 주요 학과
        
        # 전자책 페이지 감점
        if 'ebook.daejin.ac.kr' in url:
            if any(pattern in url for pattern in ['search', 'keyword', 'category']):
                score -= 10  # 검색/목록 페이지
            else:
                score -= 5   # 일반 전자책 페이지
        
        # 컨텐츠 품질 확인
        if '공지사항' in content or '안내' in content:
            score += 3
        if '교육과정' in content or '교수' in content:
            score += 3
        if '입학' in content or '모집' in content:
            score += 2
        
        return max(0, score)  # 음수 방지

    def filter_and_copy_files(self, source_dir, prefix):
        """파일 필터링 및 복사"""
        if not os.path.exists(source_dir):
            logger.warning(f"⚠️ 소스 디렉토리 없음: {source_dir}")
            return 0
        
        files = [f for f in os.listdir(source_dir) if f.endswith('.txt')]
        copied_count = 0
        
        logger.info(f"📊 {source_dir} 분석 중... ({len(files):,}개 파일)")
        
        # 품질 기준으로 정렬
        file_scores = []
        for filename in files:
            filepath = os.path.join(source_dir, filename)
            analysis = self.analyze_file_content(filepath)
            
            if analysis and analysis['quality_score'] > 0:
                file_scores.append((filename, analysis))
        
        # 품질 점수 순으로 정렬
        file_scores.sort(key=lambda x: x[1]['quality_score'], reverse=True)
        
        # 고품질 파일만 복사
        for filename, analysis in file_scores:
            # 품질 필터링
            if analysis['quality_score'] < 5:  # 최소 품질 기준
                continue
                
            # 중복 URL 제거 (이미 처리된 URL인지 확인)
            url_hash = hash(analysis['url'])
            if url_hash in self.processed_urls:
                self.stats['duplicates'] += 1
                continue
            
            self.processed_urls.add(url_hash)
            
            # 파일 복사
            source_path = os.path.join(source_dir, filename)
            target_filename = f"{prefix}_{copied_count:05d}.txt"
            target_path = os.path.join(self.merged_dir, target_filename)
            
            try:
                shutil.copy2(source_path, target_path)
                copied_count += 1
                
                # 통계 업데이트
                self.stats['total_files'] += 1
                self.stats[f'{prefix}_files'] += 1
                self.stats[analysis['domain']] += 1
                
                if copied_count % 500 == 0:
                    logger.info(f"   복사 진행: {copied_count:,}개 완료")
                    
            except Exception as e:
                logger.error(f"❌ 파일 복사 오류 {filename}: {e}")
        
        logger.info(f"✅ {source_dir}: {copied_count:,}개 파일 복사 완료")
        return copied_count

    def create_metadata(self):
        """메타데이터 파일 생성"""
        metadata = {
            'merge_timestamp': datetime.now().isoformat(),
            'source_directories': {
                'existing': self.existing_dir,
                'strategic': self.strategic_dir
            },
            'statistics': dict(self.stats),
            'quality_criteria': {
                'min_quality_score': 5,
                'duplicate_removal': True,
                'ebook_filtering': True
            },
            'total_files': self.stats['total_files']
        }
        
        metadata_path = os.path.join(self.merged_dir, 'merge_metadata.json')
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        logger.info(f"📋 메타데이터 저장: {metadata_path}")

    def merge_crawling_data(self):
        """크롤링 데이터 통합 실행"""
        logger.info("🔄 크롤링 데이터 통합 시작")
        
        # 초기화
        self.processed_urls = set()
        self.create_merged_directory()
        
        # 기존 데이터 복사 (높은 품질만)
        existing_count = self.filter_and_copy_files(self.existing_dir, "existing")
        
        # 신규 데이터 복사
        strategic_count = self.filter_and_copy_files(self.strategic_dir, "strategic")
        
        # 메타데이터 생성
        self.create_metadata()
        
        # 결과 보고
        total_count = existing_count + strategic_count
        logger.info("✅ 데이터 통합 완료")
        logger.info(f"📊 통합 결과:")
        logger.info(f"   기존 데이터: {existing_count:,}개")
        logger.info(f"   신규 데이터: {strategic_count:,}개")
        logger.info(f"   중복 제거: {self.stats['duplicates']:,}개")
        logger.info(f"   총 파일: {total_count:,}개")
        logger.info(f"📁 결과 위치: {self.merged_dir}/")
        
        # 도메인별 통계 (상위 10개)
        domain_stats = {k: v for k, v in self.stats.items() 
                       if k not in ['total_files', 'existing_files', 'strategic_files', 'duplicates']}
        top_domains = sorted(domain_stats.items(), key=lambda x: x[1], reverse=True)[:10]
        
        logger.info(f"🌐 주요 도메인 (상위 10개):")
        for domain, count in top_domains:
            logger.info(f"   {domain}: {count:,}개")
        
        return total_count

if __name__ == "__main__":
    merger = CrawlingDataMerger()
    total_files = merger.merge_crawling_data()
    
    print("\n" + "=" * 60)
    print("✅ 크롤링 데이터 통합 완료!")
    print(f"📊 총 파일 수: {total_files:,}개")
    print("📁 통합 데이터 위치: merged_output/")
    print("🎯 다음 단계: RAG 시스템 임베딩 실행")
    print("=" * 60)