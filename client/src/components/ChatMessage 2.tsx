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
          variant="body2"
          component="div"
          sx={{
            mb: index < (text?.split('\n').length || 0) - 1 ? 0.5 : 0,
            fontWeight: line.startsWith('**') && line.endsWith('**') ? 600 : 400,
            fontSize: { xs: '0.85rem', md: '0.9rem' },
            lineHeight: 1.5,
            color: isUser ? 'white' : 'text.primary',
          }}
        >
          {line.replace(/^\*\*|\*\*$/g, '')}
        </Typography>
      ));
  };

  // 메시지 버블 스타일 메모이제이션
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

  const avatarStyles = useMemo(() => ({
    bgcolor: isUser ? 'primary.main' : 'background.paper',
    width: { xs: 32, md: 36 },
    height: { xs: 32, md: 36 },
    border: !isUser ? '2px solid rgba(59, 130, 246, 0.3)' : 'none',
    boxShadow: !isUser ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
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
          maxWidth: { xs: 'calc(100% - 45px)', md: '75%' },
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          minWidth: 0,
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
              >
                <Chip
                  icon={<SourceIcon />}
                  label={ctx.source.replace('.txt', '')}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: '0.7rem',
                    height: 24,
                    color: 'text.secondary',
                    borderColor: 'divider',
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
            fontSize: '0.7rem',
          }}
        >
          {formatTime(timestamp)}
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatMessage;