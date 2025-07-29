import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Alert,
  Fade,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useChat } from '../../hooks/useChat';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { useTheme as useCustomTheme } from '../../hooks/useTheme';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import InputArea from './InputArea';

const ChatContainer: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const customTheme = useCustomTheme();
  
  // 채팅 상태 및 기능
  const {
    messages,
    isLoading,
    error,
    isConnected,
    showSuggestions,
    sendMessage,
    clearChat,
    retryMessage,
    setError,
  } = useChat();
  
  // 입력 상태
  const [inputText, setInputText] = useState('');
  
  // 자동 스크롤
  const { scrollRef, handleScroll } = useAutoScroll({
    dependency: [messages, isLoading],
    delay: 150,
  });

  // 메시지 전송 핸들러
  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputText;
    if (!messageText.trim()) return;
    
    setInputText('');
    await sendMessage(messageText);
  };

  // 제안 클릭 핸들러
  const handleSuggestionClick = (text: string) => {
    handleSendMessage(text);
  };

  return (
    <Box
      sx={{
        height: '100vh',
        background: customTheme.mode === 'light'
          ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
          : 'linear-gradient(135deg, #1E1B4B 0%, #581C87 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 배경 패턴 */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.05) 0%, transparent 50%)
          `,
          animation: 'backgroundFloat 20s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* 메인 컨테이너 */}
      <Container
        maxWidth="md"
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 1, md: 2 },
          px: { xs: 1, md: 2 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* 헤더 */}
        <ChatHeader
          onClearChat={clearChat}
          isConnected={isConnected}
          themeMode={customTheme}
        />

        {/* 메인 채팅 영역 */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: customTheme.mode === 'light'
              ? 'rgba(255, 255, 255, 0.95)'
              : 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: customTheme.mode === 'light'
              ? '0 8px 32px rgba(0, 0, 0, 0.1)'
              : '0 8px 32px rgba(0, 0, 0, 0.3)',
            border: `1px solid ${
              customTheme.mode === 'light' 
                ? 'rgba(255, 255, 255, 0.2)' 
                : 'rgba(255, 255, 255, 0.1)'
            }`,
            position: 'relative',
            
            // 내부 글로우
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: customTheme.mode === 'light'
                ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.02) 0%, rgba(124, 58, 237, 0.02) 100%)'
                : 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
              borderRadius: '24px',
              pointerEvents: 'none',
            },
          }}
        >
          {/* 메시지 리스트 */}
          <MessageList
            ref={scrollRef}
            messages={messages}
            isLoading={isLoading}
            showSuggestions={showSuggestions}
            onSuggestionClick={handleSuggestionClick}
            onRetryMessage={retryMessage}
            onScroll={handleScroll}
          />

          {/* 에러 메시지 */}
          {error && (
            <Box sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
              <Fade in>
                <Alert
                  severity="error"
                  sx={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '16px',
                    backdropFilter: 'blur(10px)',
                    '& .MuiAlert-message': {
                      color: '#DC2626',
                      fontSize: { xs: '0.85rem', md: '0.9rem' },
                      fontWeight: 500,
                    },
                    '& .MuiAlert-icon': {
                      color: '#DC2626',
                    },
                  }}
                  onClose={() => setError(null)}
                >
                  {error}
                </Alert>
              </Fade>
            </Box>
          )}

          {/* 입력 영역 */}
          <InputArea
            value={inputText}
            onChange={setInputText}
            onSend={() => handleSendMessage()}
            disabled={isLoading}
            maxLength={2000}
          />
        </Paper>
      </Container>

      {/* 플로팅 스크롤 버튼 (옵션) */}
      {!isMobile && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 100,
            right: 30,
            zIndex: 1000,
          }}
        >
          {/* 향후 스크롤 투 바텀 버튼 추가 가능 */}
        </Box>
      )}

    </Box>
  );
};

export default ChatContainer;