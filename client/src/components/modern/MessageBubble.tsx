import React, { memo } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Person,
  SmartToy,
  Check,
  CheckCircle,
  Error,
  Refresh,
  Source,
} from '@mui/icons-material';
import { Message, MessageStatus } from '../../types/chat';

interface MessageBubbleProps {
  message: Message;
  onRetry?: (messageId: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onRetry }) => {
  const { id, text, isUser, timestamp, status, context } = message;
  const theme = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatText = (text: string) => {
    if (!text) return '';
    
    return text.split('\n').map((line, index) => (
      <Typography
        key={index}
        variant="body2" 
        component="div"
        sx={{
          mb: index < text.split('\n').length - 1 ? 0.8 : 0,
          fontWeight: line.includes('**') ? 600 : 400,
          fontSize: { xs: '0.9rem', md: '0.95rem' },
          lineHeight: 1.6,
          color: isUser ? '#FFFFFF' : '#1a202c',
          wordBreak: 'break-word',
        }}
      >
        {line.replace(/\*\*/g, '')}
      </Typography>
    ));
  };

  const getStatusIcon = (status?: MessageStatus) => {
    const iconProps = {
      fontSize: 'small' as const,
      sx: { fontSize: 14 }
    };

    switch (status) {
      case 'sending':
        return <Check {...iconProps} sx={{ ...iconProps.sx, color: '#9CA3AF' }} />;
      case 'sent':
        return <Check {...iconProps} sx={{ ...iconProps.sx, color: '#6B7280' }} />;
      case 'delivered':
        return <CheckCircle {...iconProps} sx={{ ...iconProps.sx, color: '#10B981' }} />;
      case 'failed':
        return <Error {...iconProps} sx={{ ...iconProps.sx, color: '#EF4444' }} />;
      default:
        return null;
    }
  };

  const getBubbleStyles = () => ({
    position: 'relative' as const,
    background: isUser
      ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
      : '#FFFFFF',
    color: isUser ? '#FFFFFF' : '#1a202c',
    borderRadius: '20px',
    borderBottomLeftRadius: !isUser ? '8px' : '20px',
    borderBottomRightRadius: isUser ? '8px' : '20px',
    py: { xs: 2, md: 2.5 },
    px: { xs: 2.5, md: 3 },
    maxWidth: '100%',
    wordBreak: 'break-word' as const,
    boxShadow: isUser
      ? '0 8px 32px rgba(79, 70, 229, 0.3)'
      : '0 8px 32px rgba(0, 0, 0, 0.1)',
    border: !isUser ? '1px solid rgba(226, 232, 240, 0.8)' : 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    
    // 글로우 효과
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: '20px',
      background: isUser
        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
        : 'linear-gradient(135deg, rgba(79, 70, 229, 0.02) 0%, rgba(124, 58, 237, 0.02) 100%)',
      pointerEvents: 'none',
    },

    // 말풍선 꼬리
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
        ? 'transparent #7C3AED transparent transparent'
        : 'transparent transparent transparent #FFFFFF',
      filter: !isUser ? 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.1))' : 'none',
    },

    // 실패 상태 스타일
    ...(status === 'failed' && {
      background: isUser
        ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
        : '#FEF2F2',
      border: !isUser ? '1px solid #FECACA' : 'none',
      '&::after': {
        borderColor: isUser
          ? 'transparent #DC2626 transparent transparent'
          : 'transparent transparent transparent #FEF2F2',
      },
    }),
  });

  const getAvatarStyles = () => ({
    width: { xs: 40, md: 44 },
    height: { xs: 40, md: 44 },
    border: '3px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    background: isUser
      ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
      : '#FFFFFF',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative' as const,
    
    // 온라인 상태 표시 (봇만)
    '&::after': !isUser ? {
      content: '""',
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: '#10B981',
      border: '2px solid #FFFFFF',
    } : {},
  });

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        mb: { xs: 2.5, md: 3 },
        alignItems: 'flex-start',
        gap: { xs: 1.5, md: 2 },
        px: { xs: 1, md: 2 },
        animation: 'messageSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {/* 아바타 */}
      <Avatar
        sx={getAvatarStyles()}
        src={!isUser ? '/woojin.jpg' : undefined}
      >
        {isUser ? (
          <Person sx={{ color: 'white', fontSize: { xs: 18, md: 20 } }} />
        ) : (
          <SmartToy sx={{ color: '#4F46E5', fontSize: { xs: 18, md: 20 } }} />
        )}
      </Avatar>

      {/* 메시지 컨텐츠 */}
      <Box
        sx={{
          maxWidth: { xs: '75%', md: '70%' },
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          minWidth: 0,
        }}
      >
        {/* 메시지 버블 */}
        <Box sx={getBubbleStyles()}>
          {formatText(text)}
        </Box>

        {/* 컨텍스트 정보 (봇 메시지만) */}
        {!isUser && context && context.length > 0 && (
          <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
            {context.slice(0, 3).map((ctx, index) => (
              <Tooltip
                key={index}
                title={`유사도: ${Math.round(ctx.similarity * 100)}%`}
                arrow
                placement="top"
              >
                <Chip
                  icon={<Source fontSize="small" />}
                  label={`${ctx.source.replace('.txt', '')} (${Math.round(ctx.similarity * 100)}%)`}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: { xs: '0.7rem', md: '0.75rem' },
                    height: { xs: 24, md: 26 },
                    color: '#6B7280',
                    borderColor: 'rgba(79, 70, 229, 0.2)',
                    background: 'rgba(79, 70, 229, 0.05)',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      background: 'rgba(79, 70, 229, 0.1)',
                      borderColor: 'rgba(79, 70, 229, 0.4)',
                      transform: 'translateY(-1px)',
                    },
                    '& .MuiChip-icon': {
                      color: '#4F46E5',
                    },
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        )}

        {/* 하단 정보 (시간, 상태, 재시도) */}
        <Box
          sx={{
            mt: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            alignSelf: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          {/* 시간 */}
          <Typography
            variant="caption"
            sx={{
              fontSize: { xs: '0.7rem', md: '0.75rem' },
              color: '#9CA3AF',
              fontWeight: 400,
            }}
          >
            {formatTime(timestamp)}
          </Typography>

          {/* 메시지 상태 (사용자 메시지만) */}
          {isUser && status && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {getStatusIcon(status)}
            </Box>
          )}

          {/* 재시도 버튼 (실패한 메시지만) */}
          {status === 'failed' && onRetry && (
            <Tooltip title="다시 시도" arrow>
              <IconButton
                size="small"
                onClick={() => onRetry(id)}
                sx={{
                  width: 20,
                  height: 20,
                  color: '#EF4444',
                  '&:hover': {
                    background: 'rgba(239, 68, 68, 0.1)',
                  },
                }}
              >
                <Refresh sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

    </Box>
  );
};

export default memo(MessageBubble);