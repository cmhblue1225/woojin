import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Avatar,
  Container,
  Stack,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { 
  Send, 
  AutoAwesome, 
  Refresh, 
  Person, 
  SmartToy,
  Circle,
  QuestionAnswer,
  Lightbulb,
  School,
  Schedule,
  MenuBook,
} from '@mui/icons-material';

// 타입 정의
export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  context?: { source: string; similarity: number }[];
}

interface QuickAction {
  id: string;
  text: string;
  category: string;
  icon: React.ReactElement;
  color: string;
}

// 빠른 액션 데이터
const QUICK_ACTIONS: QuickAction[] = [
  { 
    id: '1', 
    text: '수강신청 일정이 언제야?', 
    category: '학사정보',
    icon: <Schedule />,
    color: '#FF6B6B'
  },
  { 
    id: '2', 
    text: '박정규 교수님이 담당하시는 강좌는?', 
    category: '교수정보',
    icon: <Person />,
    color: '#4ECDC4'
  },
  { 
    id: '3', 
    text: '컴퓨터공학과 커리큘럼은 어떻게 되나요?', 
    category: '학과정보',
    icon: <MenuBook />,
    color: '#45B7D1'
  },
  { 
    id: '4', 
    text: '도서관 이용 시간을 알려주세요', 
    category: '시설정보',
    icon: <School />,
    color: '#96CEB4'
  },
  { 
    id: '5', 
    text: '기숙사 신청은 어떻게 해?', 
    category: '시설정보',
    icon: <School />,
    color: '#FFEAA7'
  },
  { 
    id: '6', 
    text: '장학금 제도에 대해 설명해주세요', 
    category: '학사정보',
    icon: <Lightbulb />,
    color: '#DDA0DD'
  },
];

// 메시지 버블 컴포넌트
const MessageBubble: React.FC<{ message: Message; isLast: boolean }> = React.memo(({ message, isLast }) => {
  const { text, isUser, timestamp, context } = message;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatText = (text: string) => {
    if (!text) return '';
    return text
      .split('\n')
      .map((line, index) => (
        <Typography
          key={index}
          variant="body2"
          component="div"
          sx={{
            mb: index < text.split('\n').length - 1 ? 0.8 : 0,
            fontWeight: line.includes('**') ? 600 : 400,
            fontSize: { xs: '0.9rem', md: '0.95rem' },
            lineHeight: 1.6,
            color: isUser ? '#FFFFFF' : '#2D3748',
          }}
        >
          {line.replace(/\*\*/g, '')}
        </Typography>
      ));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        mb: { xs: 2, md: 2.5 },
        alignItems: 'flex-start',
        gap: { xs: 1.5, md: 2 },
        maxWidth: '100%',
        animation: 'messageSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        px: { xs: 1, md: 2 },
      }}
    >
      {/* 아바타 */}
      <Avatar
        sx={{
          bgcolor: isUser ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#FFFFFF',
          width: { xs: 40, md: 44 },
          height: { xs: 40, md: 44 },
          border: isUser ? 'none' : '3px solid #E2E8F0',
          boxShadow: isUser 
            ? '0 4px 20px rgba(102, 126, 234, 0.4)' 
            : '0 4px 20px rgba(45, 55, 72, 0.15)',
          flexShrink: 0,
        }}
        src={!isUser ? '/woojin.jpg' : undefined}
      >
        {isUser ? (
          <Person sx={{ color: 'white', fontSize: { xs: 20, md: 22 } }} />
        ) : (
          <SmartToy sx={{ color: '#4A5568', fontSize: { xs: 20, md: 22 } }} />
        )}
      </Avatar>

      {/* 메시지 내용 */}
      <Box
        sx={{
          maxWidth: { xs: '75%', md: '70%' },
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          minWidth: 0,
          position: 'relative',
        }}
      >
        {/* 메시지 버블 */}
        <Box
          sx={{
            position: 'relative',
            background: isUser 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
              : '#FFFFFF',
            color: isUser ? '#FFFFFF' : '#2D3748',
            borderRadius: '20px',
            borderBottomLeftRadius: !isUser ? '8px' : '20px',
            borderBottomRightRadius: isUser ? '8px' : '20px',
            py: { xs: 2, md: 2.5 },
            px: { xs: 2.5, md: 3 },
            maxWidth: '100%',
            wordBreak: 'break-word',
            boxShadow: isUser
              ? '0 8px 32px rgba(102, 126, 234, 0.3)'
              : '0 8px 32px rgba(45, 55, 72, 0.15)',
            border: !isUser ? '1px solid #E2E8F0' : 'none',
            transform: 'translateZ(0)', // GPU 가속
            // 말풍선 꼬리 - 완전한 삼각형
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: '8px',
              [isUser ? 'right' : 'left']: '-8px',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: isUser ? '8px 8px 8px 0' : '8px 0 8px 8px',
              borderColor: isUser 
                ? 'transparent #764ba2 transparent transparent'
                : 'transparent transparent transparent #FFFFFF',
              filter: !isUser ? 'drop-shadow(2px 2px 4px rgba(45, 55, 72, 0.1))' : 'none',
            },
          }}
        >
          {formatText(text)}
        </Box>

        {/* 컨텍스트 정보 (봇 메시지에만 표시) */}
        {!isUser && context && context.length > 0 && (
          <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
            {context.slice(0, 3).map((ctx, index) => (
              <Chip
                key={index}
                label={`${ctx.source.replace('.txt', '')} (${Math.round(ctx.similarity * 100)}%)`}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: { xs: '0.7rem', md: '0.75rem' },
                  height: { xs: 24, md: 26 },
                  color: '#4A5568',
                  borderColor: '#CBD5E0',
                  background: '#F7FAFC',
                  '&:hover': {
                    background: '#EDF2F7',
                    borderColor: '#A0AEC0',
                  },
                }}
              />
            ))}
          </Box>
        )}

        {/* 타임스탬프 */}
        <Typography
          variant="caption"
          sx={{
            mt: 1,
            fontSize: { xs: '0.7rem', md: '0.75rem' },
            color: '#A0AEC0',
            alignSelf: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          {formatTime(timestamp)}
        </Typography>
      </Box>
    </Box>
  );
});

MessageBubble.displayName = 'MessageBubble';

// 로딩 인디케이터 컴포넌트
const LoadingIndicator: React.FC = React.memo(() => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        py: { xs: 2, md: 2.5 },
        px: { xs: 3, md: 4 },
        mx: { xs: 1, md: 2 },
        background: '#FFFFFF',
        borderRadius: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 8px 32px rgba(45, 55, 72, 0.15)',
        animation: 'messageSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {/* 아바타 */}
      <Avatar
        sx={{
          bgcolor: '#FFFFFF',
          width: { xs: 40, md: 44 },
          height: { xs: 40, md: 44 },
          border: '3px solid #E2E8F0',
          boxShadow: '0 4px 20px rgba(45, 55, 72, 0.15)',
          flexShrink: 0,
        }}
        src="/woojin.jpg"
      >
        <SmartToy sx={{ color: '#4A5568', fontSize: { xs: 20, md: 22 } }} />
      </Avatar>

      {/* 텍스트 및 애니메이션 */}
      <Box sx={{ flex: 1 }}>
        <Typography 
          variant="body2" 
          sx={{ 
            color: '#4A5568', 
            fontStyle: 'italic',
            fontSize: { xs: '0.9rem', md: '0.95rem' },
            mb: 1,
          }}
        >
          우진이가 답변을 준비하고 있어요...
        </Typography>
        
        {/* 타이핑 도트 애니메이션 */}
        <Box sx={{ display: 'flex', gap: 0.8 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                animation: 'typingDots 1.4s infinite ease-in-out',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
});

LoadingIndicator.displayName = 'LoadingIndicator';

// 빠른 액션 컴포넌트
const QuickActionsPanel: React.FC<{ 
  onQuickAction: (text: string) => void; 
  disabled?: boolean;
}> = React.memo(({ onQuickAction, disabled = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Card 
      elevation={0}
      sx={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '24px',
        mb: 3,
        overflow: 'visible',
        boxShadow: '0 8px 32px rgba(45, 55, 72, 0.15)',
        animation: 'fadeInUp 0.6s ease-out',
      }}
    >
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        {/* 헤더 */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2, 
          mb: 3,
          justifyContent: 'center',
        }}>
          <Box
            sx={{
              width: { xs: 32, md: 36 },
              height: { xs: 32, md: 36 },
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
            }}
          >
            <QuestionAnswer 
              sx={{ 
                color: 'white',
                fontSize: { xs: 16, md: 18 },
              }}
            />
          </Box>
          <Typography 
            variant="h6" 
            fontWeight="700"
            sx={{ 
              fontSize: { xs: '1.1rem', md: '1.2rem' },
              color: '#2D3748',
            }}
          >
            자주 묻는 질문들
          </Typography>
        </Box>
        
        {/* 액션 버튼들 */}
        <Stack spacing={2}>
          {QUICK_ACTIONS.map((action, index) => (
            <Chip
              key={action.id}
              icon={
                <Box sx={{ color: action.color, fontSize: 18, display: 'flex' }}>
                  {action.icon}
                </Box>
              }
              label={action.text}
              onClick={() => !disabled && onQuickAction(action.text)}
              disabled={disabled}
              variant="outlined"
              sx={{
                cursor: disabled ? 'default' : 'pointer',
                fontSize: { xs: '0.85rem', md: '0.9rem' },
                height: 'auto',
                py: { xs: 1.5, md: 2 },
                px: { xs: 2, md: 2.5 },
                borderRadius: '16px',
                justifyContent: 'flex-start',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: '#F7FAFC',
                border: `2px solid ${action.color}20`,
                color: '#2D3748',
                '& .MuiChip-label': {
                  padding: 0,
                  fontWeight: 500,
                  textAlign: 'left',
                  lineHeight: 1.5,
                },
                '&:hover': disabled ? {} : {
                  background: `${action.color}15`,
                  borderColor: `${action.color}60`,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 25px ${action.color}30`,
                },
                '&:active': disabled ? {} : {
                  transform: 'translateY(0px)',
                },
                animationDelay: `${index * 0.1}s`,
                animation: 'fadeInUp 0.6s ease-out both',
              }}
            />
          ))}
        </Stack>
        
        <Divider sx={{ my: 3, borderColor: '#E2E8F0' }} />
        
        {/* 도우미 텍스트 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Lightbulb sx={{ color: '#FFA726', fontSize: 20 }} />
          <Typography
            variant="body2"
            sx={{ 
              textAlign: 'center',
              fontSize: { xs: '0.8rem', md: '0.85rem' },
              color: '#4A5568',
              fontStyle: 'italic',
            }}
          >
            질문을 {isMobile ? '탭하거나' : '클릭하거나'} 직접 입력해보세요!
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
});

QuickActionsPanel.displayName = 'QuickActionsPanel';

// 메인 채팅 페이지 컴포넌트
const ChatPageBright: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // 상태 관리
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '안녕하세요! 🎓 대진대학교 AI 챗봇 우진이입니다.\n\n✨ **새로워진 기능**\n• 향상된 시간표 검색 (교수별/과목별)\n• 대진대 홈페이지 정보 통합\n• 더욱 정확한 학사정보 제공\n\n궁금한 것이 있으시면 언제든 물어보세요! 😊',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  
  // 레퍼런스
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 스크롤을 맨 아래로 (부드럽게)
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    }
  }, []);

  // 새 메시지가 추가될 때 자동 스크롤 (약간의 딜레이)
  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  // 입력창 포커스 (데스크톱에서만)
  useEffect(() => {
    if (!isMobile && inputRef.current && !isLoading) {
      inputRef.current.focus();
    }
  }, [isMobile, isLoading]);

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
        throw new Error(`서버 오류 (${response.status})`);
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || '응답을 받지 못했습니다.',
        isUser: false,
        timestamp: new Date(),
        context: data.context,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('메시지 전송 오류:', error);
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

  // Enter 키 핸들링
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // 채팅 초기화
  const clearChat = useCallback(() => {
    setMessages([
      {
        id: '1',
        text: '안녕하세요! 🎓 대진대학교 AI 챗봇 우진이입니다.\n\n✨ **새로워진 기능**\n• 향상된 시간표 검색 (교수별/과목별)\n• 대진대 홈페이지 정보 통합\n• 더욱 정확한 학사정보 제공\n\n궁금한 것이 있으시면 언제든 물어보세요! 😊',
        isUser: false,
        timestamp: new Date(),
      },
    ]);
    setError(null);
    setShowQuickActions(true);
    setInputText('');
  }, []);

  return (
    <Box
      sx={{
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
        }}
      />

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
        <Paper
          elevation={0}
          sx={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            p: { xs: 2, md: 2.5 },
            mb: 2,
            flexShrink: 0,
            boxShadow: '0 8px 32px rgba(255, 255, 255, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: 2,
            }}
          >
            {/* 왼쪽: 타이틀 영역 */}
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: { xs: 1.5, md: 2 },
                flex: 1,
                minWidth: 0,
              }}
            >
              <Box
                sx={{
                  width: { xs: 44, md: 48 },
                  height: { xs: 44, md: 48 },
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
                }}
              >
                <AutoAwesome 
                  sx={{ 
                    color: 'white', 
                    fontSize: { xs: 22, md: 24 } 
                  }} 
                />
              </Box>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1.1rem', md: '1.25rem' },
                    color: '#2D3748',
                    lineHeight: 1.2,
                  }}
                >
                  AI 챗봇 우진이
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#4A5568',
                    fontSize: { xs: '0.75rem', md: '0.8rem' },
                    lineHeight: 1,
                    display: 'block',
                  }}
                >
                  대진대학교 학사정보 도우미 ✨
                </Typography>
              </Box>
            </Box>

            {/* 오른쪽: 상태 및 액션 버튼 */}
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: { xs: 1, md: 1.5 },
                flexShrink: 0,
              }}
            >
              {/* 라이브 상태 표시 */}
              <Chip
                icon={
                  <Circle 
                    sx={{ 
                      fontSize: '10px !important',
                      animation: 'pulse 2s infinite',
                      color: '#10B981',
                    }} 
                  />
                }
                label="LIVE"
                size="small"
                sx={{
                  height: { xs: 28, md: 32 },
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  fontSize: { xs: '0.7rem', md: '0.75rem' },
                  fontWeight: 600,
                  border: '2px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '16px',
                }}
              />

              {/* 새로고침 버튼 */}
              <IconButton
                size={isMobile ? 'small' : 'medium'}
                onClick={clearChat}
                sx={{
                  color: '#4A5568',
                  width: { xs: 40, md: 44 },
                  height: { xs: 40, md: 44 },
                  background: 'rgba(74, 85, 104, 0.1)',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.15)',
                    color: '#667eea',
                    transform: 'rotate(180deg)',
                  },
                }}
              >
                <Refresh fontSize={isMobile ? 'small' : 'medium'} />
              </IconButton>
            </Box>
          </Box>
        </Paper>

        {/* 메인 채팅 영역 */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(255, 255, 255, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
          }}
        >
          {/* 메시지 영역 */}
          <Box
            ref={messagesContainerRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: { xs: 1, md: 2 },
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'rgba(74, 85, 104, 0.1)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(102, 126, 234, 0.3)',
                borderRadius: '4px',
                '&:hover': {
                  background: 'rgba(102, 126, 234, 0.5)',
                },
              },
            }}
          >
            {/* 빠른 액션 (첫 화면에만 표시) */}
            {showQuickActions && messages.length === 1 && (
              <QuickActionsPanel 
                onQuickAction={sendMessage}
                disabled={isLoading}
              />
            )}

            {/* 메시지 목록 */}
            {messages.map((message, index) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                isLast={index === messages.length - 1}
              />
            ))}
            
            {/* 로딩 인디케이터 */}
            {isLoading && <LoadingIndicator />}
            
            {/* 스크롤 앵커 */}
            <div ref={messagesEndRef} style={{ height: '1px' }} />
          </Box>

          {/* 에러 메시지 */}
          {error && (
            <Box sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
              <Alert 
                severity="error" 
                sx={{ 
                  background: 'rgba(244, 67, 54, 0.1)',
                  border: '1px solid rgba(244, 67, 54, 0.3)',
                  borderRadius: '16px',
                  '& .MuiAlert-message': {
                    color: '#C53030',
                    fontSize: { xs: '0.85rem', md: '0.9rem' },
                  },
                }}
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            </Box>
          )}

          {/* 입력 영역 */}
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            <Paper
              elevation={0}
              sx={{
                background: '#F7FAFC',
                borderRadius: '20px',
                border: '2px solid #E2E8F0',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  borderColor: '#CBD5E0',
                  background: '#FFFFFF',
                },
                '&:focus-within': {
                  borderColor: '#667eea',
                  background: '#FFFFFF',
                  boxShadow: '0 0 0 4px rgba(102, 126, 234, 0.1)',
                },
              }}
            >
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'flex-end',
                  gap: { xs: 1.5, md: 2 },
                  p: { xs: 1.5, md: 2 },
                }}
              >
                {/* 텍스트 입력 필드 */}
                <TextField
                  inputRef={inputRef}
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
                      background: 'transparent',
                      border: 'none',
                      '& fieldset': {
                        border: 'none',
                      },
                    },
                    '& .MuiInputBase-input': {
                      color: '#2D3748',
                      fontSize: { xs: '0.95rem', md: '1rem' },
                      lineHeight: 1.6,
                      py: { xs: 1.5, md: 2 },
                      px: { xs: 2, md: 2.5 },
                      '&::placeholder': {
                        color: '#A0AEC0',
                        opacity: 1,
                      },
                    },
                  }}
                />

                {/* 전송 버튼 */}
                <IconButton
                  onClick={() => sendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  sx={{
                    background: inputText.trim() && !isLoading
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : '#E2E8F0',
                    color: inputText.trim() && !isLoading ? 'white' : '#A0AEC0',
                    width: { xs: 44, md: 48 },
                    height: { xs: 44, md: 48 },
                    transition: 'all 0.3s ease-in-out',
                    boxShadow: inputText.trim() && !isLoading 
                      ? '0 4px 20px rgba(102, 126, 234, 0.4)' 
                      : 'none',
                    '&:hover': {
                      background: inputText.trim() && !isLoading
                        ? 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)'
                        : '#CBD5E0',
                      transform: inputText.trim() && !isLoading ? 'scale(1.05)' : 'none',
                    },
                    '&:disabled': {
                      background: '#E2E8F0',
                      color: '#A0AEC0',
                    },
                  }}
                >
                  <Send fontSize={isMobile ? 'small' : 'medium'} />
                </IconButton>
              </Box>

              {/* 입력 도우미 텍스트 (데스크톱만) */}
              {!isMobile && (
                <Box
                  sx={{
                    px: 2.5,
                    pb: 1.5,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.75rem',
                      color: '#A0AEC0',
                    }}
                  >
                    Shift+Enter로 줄바꿈, Enter로 전송
                  </Typography>
                  
                  {inputText.trim() && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.7rem',
                        color: '#A0AEC0',
                      }}
                    >
                      {inputText.length}자
                    </Typography>
                  )}
                </Box>
              )}
            </Paper>
          </Box>
        </Paper>
      </Container>

      {/* CSS 애니메이션 */}
      <style>
        {`
          @keyframes messageSlideIn {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes typingDots {
            0%, 60%, 100% {
              transform: translateY(0);
              opacity: 0.6;
            }
            30% {
              transform: translateY(-8px);
              opacity: 1;
            }
          }

          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.1);
            }
          }

          @keyframes backgroundFloat {
            0%, 100% {
              transform: translate(0, 0) rotate(0deg);
            }
            33% {
              transform: translate(20px, -20px) rotate(60deg);
            }
            66% {
              transform: translate(-15px, 15px) rotate(120deg);
            }
          }
        `}
      </style>
    </Box>
  );
};

export default ChatPageBright;