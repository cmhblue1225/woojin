import React, { memo, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Alert,
  Fade,
  Typography,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { FixedSizeList as List } from 'react-window';
import ChatMessage from './ChatMessage';
import { Message } from './ChatApp';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

interface MessageItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: Message[];
    isLoading: boolean;
  };
}

// 개별 메시지 아이템 컴포넌트 (가상 스크롤링용)
const MessageItem: React.FC<MessageItemProps> = memo(({ index, style, data }) => {
  const { messages } = data;
  const message = messages[index];
  
  if (!message) return null;

  return (
    <div style={style}>
      <Box sx={{ px: { xs: 1, md: 2 }, py: 0.5 }}>
        <ChatMessage message={message} />
      </Box>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

// 로딩 인디케이터 컴포넌트
const LoadingIndicator: React.FC = memo(() => {
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

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  error, 
  onClearError 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 가상 스크롤링 설정
  const itemHeight = useMemo(() => (isMobile ? 120 : 140), [isMobile]);
  const overscanCount = 5; // 보이지 않는 영역의 아이템 수

  // 스크롤을 맨 아래로 이동
  const scrollToBottom = useCallback(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  // 새 메시지가 추가될 때 자동 스크롤
  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages.length, scrollToBottom]);

  // 컨테이너 크기 변경 감지
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // react-window의 경우 forceUpdateGrid 대신 scrollToItem 사용
      if (listRef.current && messages.length > 0) {
        setTimeout(() => {
          if (listRef.current) {
            listRef.current.scrollToItem(messages.length - 1, 'end');
          }
        }, 0);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [messages.length]);

  // 리스트 데이터 메모이제이션
  const listData = useMemo(() => ({
    messages,
    isLoading,
  }), [messages, isLoading]);

  // 스타일 메모이제이션
  const containerStyles = useMemo(() => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0,
    position: 'relative' as const,
  }), []);

  const listContainerStyles = useMemo(() => ({
    flex: 1,
    minHeight: 0,
    '& > div': {
      // react-window 컨테이너 스타일 조정
      overflow: 'auto !important',
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
    },
  }), []);

  return (
    <Box ref={containerRef} sx={containerStyles}>
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
            onClose={onClearError}
          >
            {error}
          </Alert>
        </Box>
      )}

      {/* 메시지 리스트 */}
      <Box sx={listContainerStyles}>
        {messages.length > 0 ? (
          <List
            ref={listRef}
            height="100%"
            width="100%"
            itemCount={messages.length}
            itemSize={itemHeight}
            itemData={listData}
            overscanCount={overscanCount}
            style={{
              outline: 'none',
            }}
          >
            {MessageItem}
          </List>
        ) : (
          // 메시지가 없을 때 표시할 내용
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              px: 3,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center', fontStyle: 'italic' }}
            >
              아직 메시지가 없습니다.
            </Typography>
          </Box>
        )}
      </Box>

      {/* 로딩 인디케이터 */}
      {isLoading && (
        <Box sx={{ flexShrink: 0 }}>
          <LoadingIndicator />
        </Box>
      )}

      {/* 타이핑 애니메이션 스타일 */}
      <style>
        {`
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
        `}
      </style>
    </Box>
  );
};

export default memo(MessageList);