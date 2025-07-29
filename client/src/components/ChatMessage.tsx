import React, { memo, useMemo } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  Paper,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SourceIcon from '@mui/icons-material/Source';
import { Message } from './ChatApp';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
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
    // 간단한 마크다운 스타일 처리
    if (!text) return '';
    return text
      .split('\n')
      .map((line, index) => (
        <Typography
          key={index}
          variant="body1"
          component="div"
          sx={{
            mb: index < (text?.split('\n').length || 0) - 1 ? 0.8 : 0,
            fontWeight: line.startsWith('**') && line.endsWith('**') ? 700 : 500,
            fontSize: { xs: '0.9rem', md: '1rem' },
            lineHeight: 1.6,
            color: '#ffffff',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
            letterSpacing: '0.01em',
          }}
        >
          {line.replace(/^\*\*|\*\*$/g, '')}
        </Typography>
      ));
  };

  // 새로운 모던 메시지 버블 스타일
  const bubbleStyles = useMemo(() => ({
    p: { xs: 2, md: 2.5 },
    background: isUser 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
      : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: '#ffffff',
    borderRadius: '20px',
    maxWidth: '100%',
    wordBreak: 'break-word' as const,
    border: 'none',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    position: 'relative' as const,
    fontSize: { xs: '0.9rem', md: '1rem' },
    fontWeight: 500,
    lineHeight: 1.6,
    // 부드러운 애니메이션 효과
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
    },
    // 내부 글로우 효과
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: '20px',
      padding: '1px',
      background: isUser 
        ? 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)'
        : 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)',
      mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      maskComposite: 'xor',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
    }
  }), [isUser]);

  const avatarStyles = useMemo(() => ({
    width: { xs: 40, md: 44 },
    height: { xs: 40, md: 44 },
    border: '3px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
    background: isUser 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'scale(1.1)',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)',
    },
    '& .MuiAvatar-img': {
      borderRadius: '50%',
    }
  }), [isUser]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        mb: { xs: 2.5, md: 3 },
        alignItems: 'flex-start',
        gap: { xs: 1.5, md: 2 },
        maxWidth: '100%',
        animation: 'messageSlideIn 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        '@keyframes messageSlideIn': {
          '0%': {
            opacity: 0,
            transform: isUser ? 'translateX(30px)' : 'translateX(-30px)',
          },
          '100%': {
            opacity: 1,
            transform: 'translateX(0)',
          },
        },
      }}
    >
      {/* 아바타 */}
      <Avatar
        sx={avatarStyles}
        src={!isUser ? '/woojin.jpg' : undefined}
      >
        {isUser ? (
          <PersonIcon fontSize={isMobile ? 'small' : 'medium'} />
        ) : (
          <SmartToyIcon fontSize={isMobile ? 'small' : 'medium'} />
        )}
      </Avatar>

      {/* 메시지 내용 */}
      <Box
        sx={{
          maxWidth: { xs: 'calc(100% - 60px)', md: '70%' },
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          minWidth: 0,
          gap: 1,
        }}
      >
        {/* 메시지 버블 */}
        <Paper
          elevation={0}
          sx={bubbleStyles}
        >
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
                  icon={<SourceIcon fontSize="small" />}
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
          sx={{
            fontSize: { xs: '0.7rem', md: '0.75rem' },
            opacity: 0.6,
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: 400,
            textAlign: isUser ? 'right' : 'left',
            px: 0.5,
          }}
        >
          {formatTime(timestamp)}
        </Typography>
      </Box>
    </Box>
  );
};

export default memo(ChatMessage);