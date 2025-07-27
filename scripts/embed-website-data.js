#!/usr/bin/env node
/**
 * 웹사이트 크롤링 데이터 임베딩 스크립트
 * 통합된 크롤링 데이터를 Supabase에 임베딩
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 설정
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CONFIG = {
  chunkSize: 1000,
  chunkOverlap: 200,
  batchSize: 10,
  maxRetries: 3,
  embeddingModel: 'text-embedding-3-small'
};

class WebsiteDataEmbedder {
  constructor() {
    this.processedCount = 0;
    this.totalFiles = 0;
    this.errors = [];
  }

  async processWebsiteData(dataDir = '../crawlingTest/merged_output') {
    console.log('🌐 웹사이트 데이터 임베딩 시작');
    console.log(`📁 데이터 디렉토리: ${dataDir}`);
    
    try {
      // 데이터 디렉토리 확인
      if (!fs.existsSync(dataDir)) {
        throw new Error(`데이터 디렉토리가 존재하지 않습니다: ${dataDir}`);
      }

      // 파일 목록 로드
      const files = fs.readdirSync(dataDir)
        .filter(file => file.endsWith('.txt'))
        .sort();

      this.totalFiles = files.length;
      console.log(`📊 총 파일 수: ${this.totalFiles:,}개`);

      // 기존 웹사이트 데이터 삭제
      await this.cleanExistingWebsiteData();

      // 배치 처리
      const batches = this.createBatches(files, CONFIG.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`\n📦 배치 ${i + 1}/${batches.length} 처리 중...`);
        
        await this.processBatch(batch, dataDir);
        
        // 진행률 표시
        const progress = ((i + 1) / batches.length * 100).toFixed(1);
        console.log(`📈 진행률: ${progress}% (${this.processedCount}/${this.totalFiles})`);
        
        // API 제한 방지
        if (i < batches.length - 1) {
          await this.sleep(1000);
        }
      }

      // 결과 요약
      await this.printSummary();

    } catch (error) {
      console.error('❌ 웹사이트 데이터 처리 오류:', error.message);
      throw error;
    }
  }

  async cleanExistingWebsiteData() {
    console.log('🧹 기존 웹사이트 데이터 정리 중...');
    
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('source_type', 'website');

      if (error) throw error;
      
      console.log('✅ 기존 웹사이트 데이터 삭제 완료');
    } catch (error) {
      console.warn('⚠️ 기존 데이터 삭제 중 오류:', error.message);
    }
  }

  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  async processBatch(files, dataDir) {
    const promises = files.map(filename => 
      this.processFile(filename, dataDir)
    );
    
    await Promise.allSettled(promises);
  }

  async processFile(filename, dataDir) {
    try {
      const filepath = path.join(dataDir, filename);
      const content = fs.readFileSync(filepath, 'utf-8');
      
      // 메타데이터 추출
      const metadata = this.extractMetadata(content);
      if (!metadata) {
        console.warn(`⚠️ 메타데이터 추출 실패: ${filename}`);
        return;
      }

      // 본문 텍스트 추출
      const mainContent = this.extractMainContent(content);
      if (mainContent.length < 50) {
        console.warn(`⚠️ 내용이 너무 짧음: ${filename}`);
        return;
      }

      // 청킹
      const chunks = this.createChunks(mainContent);
      
      // 각 청크 임베딩
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = `${filename}_chunk_${i}`;
        
        await this.embedAndStore({
          id: chunkId,
          content: chunk,
          metadata: {
            ...metadata,
            chunk_index: i,
            total_chunks: chunks.length,
            source_file: filename
          }
        });
      }

      this.processedCount++;
      
      if (this.processedCount % 50 === 0) {
        console.log(`   처리 완료: ${this.processedCount}/${this.totalFiles}`);
      }

    } catch (error) {
      console.error(`❌ 파일 처리 오류 ${filename}:`, error.message);
      this.errors.push({ filename, error: error.message });
    }
  }

  extractMetadata(content) {
    try {
      const urlMatch = content.match(/\[URL\] (https?:\/\/[^\n]+)/);
      const domainMatch = content.match(/\[DOMAIN\] ([^\n]+)/);
      const depthMatch = content.match(/\[DEPTH\] (\d+)/);
      const lengthMatch = content.match(/\[LENGTH\] (\d+)/);
      const timestampMatch = content.match(/\[TIMESTAMP\] ([^\n]+)/);

      if (!urlMatch || !domainMatch) {
        return null;
      }

      const url = urlMatch[1].trim();
      const domain = domainMatch[1].trim();

      return {
        url,
        domain,
        depth: depthMatch ? parseInt(depthMatch[1]) : 0,
        length: lengthMatch ? parseInt(lengthMatch[1]) : 0,
        timestamp: timestampMatch ? timestampMatch[1] : null,
        page_type: this.classifyPageType(url),
        department: this.extractDepartment(url, domain)
      };
    } catch (error) {
      console.warn('메타데이터 추출 오류:', error.message);
      return null;
    }
  }

  extractMainContent(content) {
    // 메타데이터 헤더 제거
    const lines = content.split('\n');
    let startIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('[') && lines[i].includes(']')) {
        continue;
      }
      if (lines[i].trim() === '') {
        startIndex = i + 1;
        break;
      }
    }
    
    return lines.slice(startIndex).join('\n').trim();
  }

  classifyPageType(url) {
    if (url.includes('/bbs/') && url.includes('artclView.do')) {
      return 'article';
    } else if (url.includes('/bbs/')) {
      return 'board';
    } else if (url.includes('subview.do')) {
      return 'subpage';
    } else if (url.includes('/index.do')) {
      return 'main';
    } else if (url.includes('/notice/')) {
      return 'notice';
    } else {
      return 'general';
    }
  }

  extractDepartment(url, domain) {
    // 도메인에서 학과 추출
    const departmentMap = {
      'ce.daejin.ac.kr': '컴퓨터공학과',
      'law.daejin.ac.kr': '법학과',
      'eng.daejin.ac.kr': '영어영문학과',
      'food.daejin.ac.kr': '식품영양학과',
      'nurse.daejin.ac.kr': '간호학과',
      'intlbusiness.daejin.ac.kr': '국제통상학과',
      'camde.daejin.ac.kr': '중국어문화학과',
      'djfilm.daejin.ac.kr': '영화영상학과',
      'www.daejin.ac.kr': '대진대학교'
    };

    return departmentMap[domain] || domain;
  }

  createChunks(text) {
    const chunks = [];
    const sentences = text.split(/[.!?]\s+/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const testChunk = currentChunk + sentence + '. ';
      
      if (testChunk.length > CONFIG.chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence + '. ';
      } else {
        currentChunk = testChunk;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 20);
  }

  async embedAndStore(document) {
    try {
      // 임베딩 생성
      const embedding = await this.createEmbedding(document.content);
      
      // Supabase에 저장
      const { error } = await supabase
        .from('documents')
        .insert({
          id: document.id,
          content: document.content,
          embedding,
          metadata: document.metadata,
          source_type: 'website',
          source_file: document.metadata.source_file,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

    } catch (error) {
      console.error(`임베딩/저장 오류 ${document.id}:`, error.message);
      throw error;
    }
  }

  async createEmbedding(text) {
    try {
      const response = await openai.embeddings.create({
        model: CONFIG.embeddingModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('임베딩 생성 오류:', error.message);
      throw error;
    }
  }

  async printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('✅ 웹사이트 데이터 임베딩 완료!');
    console.log(`📊 처리 결과:`);
    console.log(`   총 파일: ${this.totalFiles:,}개`);
    console.log(`   처리 완료: ${this.processedCount:,}개`);
    console.log(`   오류: ${this.errors.length}개`);

    if (this.errors.length > 0) {
      console.log('\n❌ 오류 목록:');
      this.errors.slice(0, 10).forEach(({ filename, error }) => {
        console.log(`   ${filename}: ${error}`);
      });
      if (this.errors.length > 10) {
        console.log(`   ... 그 외 ${this.errors.length - 10}개`);
      }
    }

    // 데이터베이스 통계
    try {
      const { count, error } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('source_type', 'website');

      if (!error) {
        console.log(`📚 데이터베이스 내 웹사이트 문서: ${count:,}개`);
      }
    } catch (error) {
      console.warn('데이터베이스 통계 조회 오류:', error.message);
    }

    console.log('='.repeat(60));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 실행
async function main() {
  const embedder = new WebsiteDataEmbedder();
  
  try {
    // 명령행 인자로 데이터 디렉토리 지정 가능
    const dataDir = process.argv[2] || '../crawlingTest/merged_output';
    await embedder.processWebsiteData(dataDir);
    
    console.log('\n🎉 웹사이트 데이터 임베딩 완료!');
    console.log('🤖 이제 챗봇에서 새로운 웹사이트 정보를 사용할 수 있습니다.');
    
  } catch (error) {
    console.error('❌ 임베딩 프로세스 실패:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = WebsiteDataEmbedder;