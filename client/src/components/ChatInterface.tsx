import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  Fade,
  useMediaQuery,
  useTheme,
  Chip,
} from '@mui/material';
import { Send, AutoAwesome, Refresh } from '@mui/icons-material';
import ChatMessage from './ChatMessage';
import QuickActions from './QuickActions';

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  context?: { source: string; similarity: number }[];
}

const ChatInterface: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string = inputText) => {
    if (!text.trim() || isLoading) return;

    setError(null);
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
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
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        isUser: false,
        timestamp: new Date(),
        context: data.context,
      };

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
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        text: '안녕하세요! 🎓 대진대학교 AI 챗봇 우진이입니다.\n\n🔍 **새로워진 기능**\n• 향상된 시간표 검색 (교수별/과목별)\n• 대진대 홈페이지 정보 통합\n• 더욱 정확한 학사정보 제공\n\n궁금한 것이 있으시면 언제든 물어보세요! ✨',
        isUser: false,
        timestamp: new Date(),
      },
    ]);
    setError(null);
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* 상단 바 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 2,
          mb: 2,
          borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesome sx={{ color: 'secondary.main', fontSize: 20 }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              fontSize: { xs: '1rem', md: '1.1rem' },
              color: 'text.primary',
            }}
          >
            AI 챗봇 우진이
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            label="LIVE"
            size="small"
            sx={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: 'secondary.light',
              fontSize: '0.7rem',
              height: 24,
              animation: 'pulse 2s infinite',
            }}
          />
          <IconButton
            size="small"
            onClick={clearChat}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                background: 'rgba(59, 130, 246, 0.1)',
                color: 'primary.light',
              },
            }}
          >
            <Refresh fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* 메시지 영역 */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          pr: { xs: 1, md: 2 },
          mr: { xs: -1, md: -2 },
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(59, 130, 246, 0.3)',
            borderRadius: '3px',
            '&:hover': {
              background: 'rgba(59, 130, 246, 0.5)',
            },
          },
        }}
      >
        {messages.map((message, index) => (
          <Fade key={message.id} in timeout={500}>
            <Box>
              <ChatMessage message={message} />
              {index === messages.length - 1 && <div ref={messagesEndRef} />}
            </Box>
          </Fade>
        ))}
        
        {isLoading && (
          <Fade in>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                py: 2,
                px: 2,
                mt: 1,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(45deg, #3B82F6, #10B981)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress size={16} sx={{ color: 'white' }} />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                우진이가 답변을 준비하고 있어요...
              </Typography>
            </Box>
          </Fade>
        )}
      </Box>

      {/* 에러 메시지 */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 2,
            background: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid rgba(244, 67, 54, 0.3)',
            '& .MuiAlert-message': {
              color: '#FF6B6B',
            },
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* 빠른 액션 */}
      <QuickActions onQuickAction={sendMessage} />

      {/* 입력 영역 */}
      <Paper
        elevation={0}
        sx={{
          mt: 2,
          p: 2,
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="궁금한 것을 물어보세요... (Shift+Enter로 줄바꿈)"
            disabled={isLoading}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                background: 'rgba(15, 23, 42, 0.5)',
                border: 'none',
                '& fieldset': {
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                },
                '&:hover fieldset': {
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                },
                '&.Mui-focused fieldset': {
                  border: '2px solid rgba(59, 130, 246, 0.6)',
                },
              },
              '& .MuiInputBase-input': {
                color: 'text.primary',
                fontSize: { xs: '0.9rem', md: '1rem' },
                '&::placeholder': {
                  color: 'text.secondary',
                  opacity: 0.7,
                },
              },
            }}
          />
          <IconButton
            onClick={() => sendMessage()}
            disabled={!inputText.trim() || isLoading}
            sx={{
              background: inputText.trim() && !isLoading ? 
                'linear-gradient(45deg, #3B82F6, #10B981)' : 
                'rgba(59, 130, 246, 0.2)',
              color: 'white',
              width: { xs: 48, md: 56 },
              height: { xs: 48, md: 56 },
              '&:hover': {
                background: inputText.trim() && !isLoading ? 
                  'linear-gradient(45deg, #1E40AF, #059669)' : 
                  'rgba(59, 130, 246, 0.3)',
                transform: 'scale(1.05)',
              },
              '&:disabled': {
                background: 'rgba(59, 130, 246, 0.1)',
                color: 'rgba(255, 255, 255, 0.3)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <Send fontSize={isMobile ? 'small' : 'medium'} />
          </IconButton>
        </Box>
      </Paper>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </Box>
  );
};

export default ChatInterface;