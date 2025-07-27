import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import QuickActions from './QuickActions';

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  context?: { source: string; similarity: number }[];
}

const ChatApp: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // 상태 관리
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '안녕하세요! 🎓 대진대학교 AI 챗봇 우진이입니다.\n\n🔍 **새로워진 기능**\n• 향상된 시간표 검색 (교수별/과목별)\n• 대진대 홈페이지 정보 통합\n• 더욱 정확한 학사정보 제공\n\n궁금한 것이 있으시면 언제든 물어보세요! ✨',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  
  // 레퍼런스
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // 메시지 전송 함수
  const sendMessage = useCallback(async (text: string = inputText) => {
    if (!text.trim() || isLoading) return;

    setError(null);
    setShowQuickActions(false); // 첫 메시지 후 빠른 액션 숨김
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    console.log('[클라이언트] 사용자 메시지 추가:', userMessage);
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      console.log('[클라이언트] 현재 메시지 목록:', newMessages);
      return newMessages;
    });
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[클라이언트] 서버 응답 받음:', data);
      console.log('[클라이언트] data.response 타입:', typeof data.response);
      console.log('[클라이언트] data.response 내용:', data.response);
      console.log('[클라이언트] data.context:', data.context);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || '응답을 받지 못했습니다.',
        isUser: false,
        timestamp: new Date(),
        context: data.context,
      };

      console.log('[클라이언트] 메시지 설정:', assistantMessage);
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('메시지 전송 중 오류가 발생했습니다. 다시 시도해주세요.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 🔧',
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading]);

  // 채팅 초기화
  const clearChat = useCallback(() => {
    setMessages([
      {
        id: '1',
        text: '안녕하세요! 🎓 대진대학교 AI 챗봇 우진이입니다.\n\n🔍 **새로워진 기능**\n• 향상된 시간표 검색 (교수별/과목별)\n• 대진대 홈페이지 정보 통합\n• 더욱 정확한 학사정보 제공\n\n궁금한 것이 있으시면 언제든 물어보세요! ✨',
        isUser: false,
        timestamp: new Date(),
      },
    ]);
    setError(null);
    setShowQuickActions(true);
  }, []);

  // 빠른 액션 핸들러
  const handleQuickAction = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  // 키보드 높이 감지 (모바일)
  useEffect(() => {
    if (!isMobile) return;

    const handleResize = () => {
      const viewport = window.visualViewport;
      if (viewport && chatContainerRef.current) {
        const heightDiff = window.innerHeight - viewport.height;
        chatContainerRef.current.style.setProperty(
          '--keyboard-height',
          `${heightDiff}px`
        );
      }
    };

    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }
  }, [isMobile]);

  // 메모이제이션된 스타일
  const containerStyles = useMemo(() => ({
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    overflow: 'hidden',
    background: 'rgba(30, 41, 59, 0.6)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: { xs: 2, md: 3 },
    // 키보드 대응 (CSS 커스텀 프로퍼티 사용)
    ...(isMobile && {
      paddingBottom: 'var(--keyboard-height, 0px)',
      transition: 'padding-bottom 0.3s ease',
    }),
  }), [isMobile]);

  const headerStyles = useMemo(() => ({
    flexShrink: 0,
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
    p: { xs: 2, md: 2.5 },
  }), []);

  const messagesContainerStyles = useMemo(() => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0, // flex 항목이 최소 크기보다 작아질 수 있도록
    overflow: 'hidden',
  }), []);

  const inputContainerStyles = useMemo(() => ({
    flexShrink: 0,
    p: { xs: 1.5, md: 2 },
    pt: { xs: 1, md: 1.5 },
  }), []);

  return (
    <Box
      ref={chatContainerRef}
      sx={containerStyles}
      data-testid="chat-app"
    >
      {/* 헤더 영역 */}
      <Box sx={headerStyles}>
        <ChatHeader onClearChat={clearChat} />
      </Box>

      {/* 메시지 영역 */}
      <Box sx={messagesContainerStyles}>
        <MessageList
          messages={messages}
          isLoading={isLoading}
          error={error}
          onClearError={() => setError(null)}
        />
        
        {/* 빠른 액션 (첫 화면에만 표시) */}
        {showQuickActions && messages.length === 1 && (
          <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1 }}>
            <QuickActions 
              onQuickAction={handleQuickAction}
              disabled={isLoading}
            />
          </Box>
        )}
      </Box>

      {/* 입력 영역 */}
      <Box sx={inputContainerStyles}>
        <ChatInput
          value={inputText}
          onChange={setInputText}
          onSend={sendMessage}
          disabled={isLoading}
          placeholder="궁금한 것을 물어보세요..."
        />
      </Box>
    </Box>
  );
};

export default React.memo(ChatApp);