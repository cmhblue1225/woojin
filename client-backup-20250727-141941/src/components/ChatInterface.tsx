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
  Avatar,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '안녕하세요! 대진대학교 챗봇입니다. 수강신청, 시간표, 학사일정 등에 대해 궁금한 것이 있으시면 언제든 물어보세요! 😊',
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

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text.trim(),
          sessionId: generateSessionId(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.message,
        isUser: false,
        timestamp: new Date(),
        context: data.context,
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setError('죄송합니다. 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const quickActionMessages = [
    '수강신청 일정이 언제야?',
    '교양필수 과목이 뭐가 있어?',
    '컴퓨터공학과 전공필수 시간표 알려줘',
    '수강신청 학점 제한이 얼마야?',
    '재수강은 어떻게 해?',
  ];

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      maxWidth: '100%',
    }}>
      {error && (
        <Fade in={!!error}>
          <Alert 
            severity="error" 
            sx={{ 
              mb: { xs: 1, sm: 2 },
              mx: { xs: 0, sm: 0 },
              borderRadius: 2,
            }} 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        </Fade>
      )}

      {/* 채팅 메시지 영역 */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          p: { xs: 1, sm: 2 },
          mb: { xs: 1, sm: 2 },
          overflow: 'auto',
          backgroundColor: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        }}
      >
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, alignSelf: 'flex-start' }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'white',
                border: '1px solid #e0e0e0',
              }}
              src="/woojin.jpg"
            >
              <SmartToyIcon fontSize="small" />
            </Avatar>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              답변을 생성하고 있습니다...
            </Typography>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Paper>

      {/* 빠른 액션 버튼들 */}
      {messages.length <= 1 && (
        <QuickActions
          actions={quickActionMessages}
          onActionClick={sendMessage}
          disabled={isLoading}
        />
      )}

      {/* 메시지 입력 영역 */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 1.5, sm: 2 },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="궁금한 것을 물어보세요..."
            variant="outlined"
            size="small"
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'white',
                borderRadius: 2,
                border: '2px solid transparent',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: 'primary.light',
                },
                '&.Mui-focused': {
                  borderColor: 'primary.main',
                  boxShadow: '0 0 0 3px rgba(66, 133, 244, 0.1)',
                },
              },
              '& .MuiInputBase-input': {
                fontSize: { xs: '0.9rem', sm: '1rem' },
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={() => sendMessage()}
            disabled={!inputText.trim() || isLoading}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              width: { xs: 40, sm: 48 },
              height: { xs: 40, sm: 48 },
              borderRadius: 2,
              transition: 'all 0.2s ease-in-out',
              '&:hover': { 
                bgcolor: 'primary.dark',
                transform: 'scale(1.05)',
              },
              '&:disabled': { 
                bgcolor: 'grey.300',
                transform: 'none',
              },
            }}
          >
            <SendIcon fontSize={isLoading ? 'small' : 'medium'} />
          </IconButton>
        </Box>
        
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ 
            mt: { xs: 0.5, sm: 1 }, 
            display: 'block',
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
            textAlign: 'center',
          }}
        >
          {inputText.length === 0 ? (
            '💡 Enter로 전송, Shift+Enter로 줄바꿈'
          ) : (
            `${inputText.length}/500자`
          )}
        </Typography>
      </Paper>
    </Box>
  );
};

export default ChatInterface;