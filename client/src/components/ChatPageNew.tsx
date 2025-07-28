import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Tooltip,
  Container,
} from '@mui/material';
import { 
  Send, 
  AutoAwesome, 
  Refresh, 
  Person, 
  SmartToy,
  Source,
  Circle,
  QuestionAnswer,
  Mic,
  Stop,
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
}

// 빠른 액션 데이터
const QUICK_ACTIONS: QuickAction[] = [
  { id: '1', text: '수강신청 일정이 언제야?', category: '학사정보' },
  { id: '2', text: '박정규 교수님이 담당하시는 강좌는?', category: '교수정보' },
  { id: '3', text: '컴퓨터공학과 커리큘럼은 어떻게 되나요?', category: '학과정보' },
  { id: '4', text: '도서관 이용 시간을 알려주세요', category: '시설정보' },
  { id: '5', text: '기숙사 신청은 어떻게 해?', category: '시설정보' },
  { id: '6', text: '장학금 제도에 대해 설명해주세요', category: '학사정보' },
];

// 메시지 버블 컴포넌트
const MessageBubble: React.FC<{ message: Message }> = React.memo(({ message }) => {
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
            mb: index < text.split('\n').length - 1 ? 0.5 : 0,
            fontWeight: line.includes('**') ? 600 : 400,
            fontSize: { xs: '0.85rem', md: '0.9rem' },
            lineHeight: 1.5,
            color: isUser ? 'white' : 'text.primary',
          }}
        >
          {line.replace(/\*\*/g, '')}
        </Typography>
      ));
  };

  const bubbleStyles = useMemo(() => ({
    p: { xs: 1.5, md: 2 },
    background: isUser 
      ? 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)' 
      : 'rgba(30, 41, 59, 0.8)',
    color: isUser ? 'white' : 'text.primary',
    borderRadius: 2.5,
    borderBottomLeftRadius: !isUser ? 0.5 : 2.5,
    borderBottomRightRadius: isUser ? 0.5 : 2.5,
    maxWidth: '100%',
    wordBreak: 'break-word' as const,
    border: !isUser ? '1px solid rgba(59, 130, 246, 0.2)' : 'none',
    boxShadow: isUser 
      ? '0 4px 12px rgba(59, 130, 246, 0.25)' 
      : '0 2px 8px rgba(0,0,0,0.1)',
    position: 'relative' as const,
    backdropFilter: !isUser ? 'blur(10px)' : 'none',
    // 말풍선 꼬리
    '&::after': isUser ? {
      content: '""',
      position: 'absolute',
      bottom: 4,
      right: -6,
      width: 0,
      height: 0,
      borderLeft: '6px solid #10B981',
      borderTop: '4px solid transparent',
      borderBottom: '4px solid transparent',
    } : {
      content: '""',
      position: 'absolute',
      bottom: 4,
      left: -6,
      width: 0,
      height: 0,
      borderRight: '6px solid rgba(30, 41, 59, 0.8)',
      borderTop: '4px solid transparent',
      borderBottom: '4px solid transparent',
    },
    // 테두리와 매칭되는 꼬리 (봇 메시지만)
    '&::before': !isUser ? {
      content: '""',
      position: 'absolute',
      bottom: 4,
      left: -7,
      width: 0,
      height: 0,
      borderRight: '7px solid rgba(59, 130, 246, 0.2)',
      borderTop: '5px solid transparent',
      borderBottom: '5px solid transparent',
    } : {},
  }), [isUser]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        mb: { xs: 1.5, md: 2 },
        alignItems: 'flex-start',
        gap: { xs: 1, md: 1.5 },
        maxWidth: '100%',
        animation: 'messageSlideIn 0.4s ease-out',
      }}
    >
      {/* 아바타 */}
      <Avatar
        sx={{
          bgcolor: isUser ? 'primary.main' : 'background.paper',
          width: { xs: 32, md: 36 },
          height: { xs: 32, md: 36 },
          border: !isUser ? '2px solid rgba(59, 130, 246, 0.3)' : 'none',
          boxShadow: !isUser ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        }}
        src={!isUser ? '/woojin.jpg' : undefined}
      >
        {isUser ? (
          <Person fontSize={isMobile ? 'small' : 'medium'} />
        ) : (
          <SmartToy fontSize={isMobile ? 'small' : 'medium'} />
        )}
      </Avatar>

      {/* 메시지 내용 */}
      <Box
        sx={{
          maxWidth: { xs: 'calc(100% - 45px)', md: '75%' },
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          minWidth: 0,
        }}
      >
        {/* 메시지 버블 */}
        <Paper elevation={0} sx={bubbleStyles}>
          {formatText(text)}
        </Paper>

        {/* 컨텍스트 정보 (봇 메시지에만 표시) */}
        {!isUser && context && context.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {context.map((ctx, index) => (
              <Tooltip
                key={index}
                title={`유사도: ${Math.round(ctx.similarity * 100)}%`}
                arrow
                placement="top"
              >
                <Chip
                  icon={<Source fontSize="small" />}
                  label={ctx.source.replace('.txt', '')}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: { xs: '0.65rem', md: '0.7rem' },
                    height: { xs: 22, md: 24 },
                    color: 'text.secondary',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    background: 'rgba(59, 130, 246, 0.05)',
                    '&:hover': {
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderColor: 'rgba(59, 130, 246, 0.5)',
                    },
                    '& .MuiChip-icon': {
                      color: 'rgba(59, 130, 246, 0.7)',
                    },
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        )}

        {/* 타임스탬프 */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            mt: 0.5,
            fontSize: { xs: '0.65rem', md: '0.7rem' },
            opacity: 0.8,
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Fade in>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          py: { xs: 2, md: 2.5 },
          px: { xs: 2, md: 3 },
          mx: { xs: 1, md: 2 },
          background: 'rgba(30, 41, 59, 0.4)',
          borderRadius: 2,
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}
      >
        {/* 아바타 */}
        <Box
          sx={{
            width: { xs: 32, md: 36 },
            height: { xs: 32, md: 36 },
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #3B82F6, #10B981)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CircularProgress 
            size={isMobile ? 16 : 18} 
            sx={{ color: 'white' }} 
          />
        </Box>

        {/* 텍스트 */}
        <Box sx={{ flex: 1 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary', 
              fontStyle: 'italic',
              fontSize: { xs: '0.85rem', md: '0.9rem' },
            }}
          >
            우진이가 답변을 준비하고 있어요...
          </Typography>
          
          {/* 타이핑 도트 애니메이션 */}
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.6)',
                  animation: `typing 1.4s infinite ease-in-out`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Fade>
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
  const isSmallMobile = useMediaQuery('(max-width: 480px)');

  const visibleActions = useMemo(() => {
    if (isSmallMobile) return QUICK_ACTIONS.slice(0, 4);
    if (isMobile) return QUICK_ACTIONS.slice(0, 5);
    return QUICK_ACTIONS;
  }, [isSmallMobile, isMobile]);

  return (
    <Paper 
      elevation={0} 
      sx={{
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: { xs: 2, md: 2.5 },
        mb: 2,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          border: '1px solid rgba(59, 130, 246, 0.3)',
          background: 'rgba(15, 23, 42, 0.5)',
        },
      }}
    >
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        {/* 헤더 */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5, 
          mb: { xs: 2, md: 2.5 },
          justifyContent: 'center',
        }}>
          <Box
            sx={{
              width: { xs: 24, md: 28 },
              height: { xs: 24, md: 28 },
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3B82F6, #10B981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <QuestionAnswer 
              sx={{ 
                color: 'white',
                fontSize: { xs: 14, md: 16 },
              }}
            />
          </Box>
          <Typography 
            variant="subtitle2" 
            fontWeight="700"
            sx={{ 
              fontSize: { xs: '0.9rem', md: '1rem' },
              color: 'text.primary',
              background: 'linear-gradient(45deg, #3B82F6, #10B981)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            자주 묻는 질문들
          </Typography>
        </Box>
        
        {/* 액션 버튼들 */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr 1fr',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: { xs: 1, md: 1.5 },
          mb: { xs: 1.5, md: 2 },
        }}>
          {visibleActions.map((action, index) => (
            <Chip
              key={action.id}
              label={action.text}
              onClick={() => !disabled && onQuickAction(action.text)}
              disabled={disabled}
              variant="outlined"
              sx={{
                cursor: disabled ? 'default' : 'pointer',
                fontSize: { xs: '0.75rem', md: '0.85rem' },
                height: 'auto',
                py: { xs: 1, md: 1.25 },
                px: { xs: 1.5, md: 2 },
                borderRadius: 2,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: 'text.primary',
                '& .MuiChip-label': {
                  whiteSpace: 'normal',
                  textAlign: 'center',
                  lineHeight: 1.4,
                  padding: 0,
                  fontWeight: 500,
                },
                '&:hover': disabled ? {} : {
                  background: 'rgba(59, 130, 246, 0.15)',
                  borderColor: 'primary.main',
                  color: 'primary.light',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(59, 130, 246, 0.25)',
                },
                '&:active': disabled ? {} : {
                  transform: 'translateY(0px)',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
                },
                animationDelay: `${index * 0.1}s`,
                animation: 'fadeInUp 0.6s ease-out both',
              }}
            />
          ))}
        </Box>
        
        {/* 도우미 텍스트 */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ 
            display: 'block',
            textAlign: 'center',
            fontSize: { xs: '0.7rem', md: '0.75rem' },
            opacity: 0.8,
            fontStyle: 'italic',
          }}
        >
          💡 {isMobile ? '질문을 탭하거나' : '질문을 클릭하거나'} 직접 입력해보세요!
        </Typography>
      </Box>
    </Paper>
  );
});

QuickActionsPanel.displayName = 'QuickActionsPanel';

// 메인 채팅 페이지 컴포넌트
const ChatPageNew: React.FC = () => {
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
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  
  // 레퍼런스
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 스크롤을 맨 아래로
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 새 메시지가 추가될 때 자동 스크롤
  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  // 입력창 포커스 (데스크톱에서만)
  useEffect(() => {
    if (!isMobile && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMobile]);

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
        text: '안녕하세요! 🎓 대진대학교 AI 챗봇 우진이입니다.\n\n🔍 **새로워진 기능**\n• 향상된 시간표 검색 (교수별/과목별)\n• 대진대 홈페이지 정보 통합\n• 더욱 정확한 학사정보 제공\n\n궁금한 것이 있으시면 언제든 물어보세요! ✨',
        isUser: false,
        timestamp: new Date(),
      },
    ]);
    setError(null);
    setShowQuickActions(true);
    setInputText('');
  }, []);

  // 음성 녹음 토글 (향후 구현)
  const handleVoiceToggle = useCallback(() => {
    setIsVoiceRecording(prev => !prev);
    // TODO: 음성 인식 구현
  }, []);

  return (
    <Container
      maxWidth="lg"
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        py: { xs: 1, md: 2 },
        px: { xs: 1, md: 3 },
      }}
    >
      {/* 헤더 */}
      <Paper
        elevation={0}
        sx={{
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: { xs: 2, md: 3 },
          p: { xs: 2, md: 2.5 },
          mb: 2,
          flexShrink: 0,
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
              gap: { xs: 1, md: 1.5 },
              flex: 1,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: { xs: 36, md: 40 },
                height: { xs: 36, md: 40 },
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
            >
              <AutoAwesome 
                sx={{ 
                  color: 'white', 
                  fontSize: { xs: 18, md: 20 } 
                }} 
              />
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  color: 'text.primary',
                  lineHeight: 1.2,
                }}
              >
                AI 챗봇 우진이
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: '0.7rem', md: '0.75rem' },
                  lineHeight: 1,
                  display: 'block',
                }}
              >
                대진대학교 학사정보 도우미
              </Typography>
            </Box>
          </Box>

          {/* 오른쪽: 상태 및 액션 버튼 */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: { xs: 0.5, md: 1 },
              flexShrink: 0,
            }}
          >
            {/* 라이브 상태 표시 */}
            <Tooltip title="실시간 응답 가능" placement="bottom">
              <Chip
                icon={
                  <Circle 
                    sx={{ 
                      fontSize: '8px !important',
                      animation: 'pulse 2s infinite',
                      color: '#10B981',
                    }} 
                  />
                }
                label="LIVE"
                size="small"
                sx={{
                  height: { xs: 24, md: 28 },
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  fontSize: { xs: '0.65rem', md: '0.7rem' },
                  fontWeight: 600,
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              />
            </Tooltip>

            {/* 새로고침 버튼 */}
            <Tooltip title="채팅 초기화" placement="bottom">
              <IconButton
                size={isMobile ? 'small' : 'medium'}
                onClick={clearChat}
                sx={{
                  color: 'text.secondary',
                  width: { xs: 36, md: 40 },
                  height: { xs: 36, md: 40 },
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: 'primary.light',
                    transform: 'rotate(180deg)',
                  },
                }}
              >
                <Refresh fontSize={isMobile ? 'small' : 'medium'} />
              </IconButton>
            </Tooltip>
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
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: { xs: 2, md: 3 },
          overflow: 'hidden',
        }}
      >
        {/* 메시지 영역 */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 1, md: 2 },
            py: { xs: 1, md: 1.5 },
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
          {/* 빠른 액션 (첫 화면에만 표시) */}
          {showQuickActions && messages.length === 1 && (
            <QuickActionsPanel 
              onQuickAction={sendMessage}
              disabled={isLoading}
            />
          )}

          {/* 메시지 목록 */}
          {messages.map((message) => (
            <Fade key={message.id} in timeout={500}>
              <Box>
                <MessageBubble message={message} />
              </Box>
            </Fade>
          ))}
          
          {/* 로딩 인디케이터 */}
          {isLoading && <LoadingIndicator />}
          
          {/* 스크롤 앵커 */}
          <div ref={messagesEndRef} />
        </Box>

        {/* 에러 메시지 */}
        {error && (
          <Box sx={{ px: { xs: 1, md: 2 }, pb: 1 }}>
            <Alert 
              severity="error" 
              sx={{ 
                background: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid rgba(244, 67, 54, 0.3)',
                '& .MuiAlert-message': {
                  color: '#FF6B6B',
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
        <Box sx={{ p: { xs: 1, md: 1.5 } }}>
          <Paper
            elevation={0}
            sx={{
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: { xs: 2, md: 2.5 },
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                border: '1px solid rgba(59, 130, 246, 0.4)',
                background: 'rgba(15, 23, 42, 0.7)',
              },
              '&:focus-within': {
                border: '1px solid rgba(59, 130, 246, 0.6)',
                background: 'rgba(15, 23, 42, 0.8)',
                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
              },
            }}
          >
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'flex-end',
                gap: { xs: 1, md: 1.5 },
                p: { xs: 1, md: 1.25 },
              }}
            >
              {/* 음성 입력 버튼 (모바일에서만 표시) */}
              {isMobile && (
                <Tooltip title={isVoiceRecording ? "녹음 중지" : "음성 입력"}>
                  <IconButton
                    onClick={handleVoiceToggle}
                    disabled={isLoading}
                    sx={{
                      color: isVoiceRecording ? 'error.main' : 'text.secondary',
                      width: 36,
                      height: 36,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        background: isVoiceRecording 
                          ? 'rgba(244, 67, 54, 0.1)' 
                          : 'rgba(59, 130, 246, 0.1)',
                        color: isVoiceRecording ? 'error.light' : 'primary.light',
                      },
                    }}
                  >
                    {isVoiceRecording ? (
                      <Stop fontSize="small" />
                    ) : (
                      <Mic fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              )}

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
                    color: 'text.primary',
                    fontSize: { xs: '0.9rem', md: '1rem' },
                    lineHeight: 1.5,
                    py: { xs: 1.5, md: 1.75 },
                    px: { xs: 1.5, md: 2 },
                    '&::placeholder': {
                      color: 'text.secondary',
                      opacity: 0.7,
                    },
                  },
                }}
              />

              {/* 전송 버튼 */}
              <Tooltip title="메시지 전송 (Enter)">
                <span>
                  <IconButton
                    onClick={() => sendMessage()}
                    disabled={!inputText.trim() || isLoading}
                    sx={{
                      background: inputText.trim() && !isLoading
                        ? 'linear-gradient(135deg, #3B82F6, #10B981)'
                        : 'rgba(59, 130, 246, 0.2)',
                      color: 'white',
                      width: { xs: 40, md: 44 },
                      height: { xs: 40, md: 44 },
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        background: inputText.trim() && !isLoading
                          ? 'linear-gradient(135deg, #1E40AF, #059669)'
                          : 'rgba(59, 130, 246, 0.3)',
                        transform: inputText.trim() && !isLoading ? 'scale(1.05)' : 'none',
                      },
                      '&:disabled': {
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'rgba(255, 255, 255, 0.3)',
                      },
                    }}
                  >
                    <Send fontSize={isMobile ? 'small' : 'medium'} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            {/* 입력 도우미 텍스트 */}
            {!isMobile && (
              <Box
                sx={{
                  px: 2,
                  pb: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    color: 'text.secondary',
                    opacity: 0.8,
                  }}
                >
                  Shift+Enter로 줄바꿈, Enter로 전송
                </Typography>
                
                {inputText.trim() && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.7rem',
                      color: 'text.secondary',
                      opacity: 0.6,
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

      {/* CSS 애니메이션 */}
      <style>
        {`
          @keyframes messageSlideIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes typing {
            0%, 60%, 100% {
              transform: translateY(0);
              opacity: 0.4;
            }
            30% {
              transform: translateY(-8px);
              opacity: 1;
            }
          }

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
    </Container>
  );
};

export default ChatPageNew;