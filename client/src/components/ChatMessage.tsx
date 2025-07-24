import React from 'react';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  Paper,
  Tooltip,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SourceIcon from '@mui/icons-material/Source';
import { Message } from './ChatInterface';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { text, isUser, timestamp, context } = message;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatText = (text: string) => {
    // 간단한 마크다운 스타일 처리
    return text
      .split('\n')
      .map((line, index) => (
        <Typography
          key={index}
          variant="body2"
          component="div"
          sx={{
            mb: index < text.split('\n').length - 1 ? 1 : 0,
            fontWeight: line.startsWith('**') && line.endsWith('**') ? 'bold' : 'normal',
          }}
        >
          {line.replace(/^\*\*|\*\*$/g, '')}
        </Typography>
      ));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        mb: { xs: 2, sm: 2.5 },
        alignItems: 'flex-start',
        gap: { xs: 1, sm: 1.5 },
        maxWidth: '100%',
      }}
    >
      {/* 아바타 */}
      <Avatar
        sx={{
          bgcolor: isUser ? 'primary.main' : 'white',
          width: { xs: 36, sm: 40 },
          height: { xs: 36, sm: 40 },
          border: !isUser ? '2px solid #f0f0f0' : 'none',
          boxShadow: !isUser ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        }}
        src={!isUser ? '/woojin.jpg' : undefined}
      >
        {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
      </Avatar>

      {/* 메시지 내용 */}
      <Box
        sx={{
          maxWidth: { xs: 'calc(100% - 50px)', sm: '75%' },
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          minWidth: 0, // flex 자식의 shrink를 위해 필요
        }}
      >
        {/* 메시지 버블 */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2 },
            background: isUser 
              ? 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)' 
              : 'white',
            color: isUser ? 'white' : 'text.primary',
            borderRadius: 3,
            borderTopLeftRadius: !isUser ? 1 : 3,
            borderTopRightRadius: isUser ? 1 : 3,
            maxWidth: '100%',
            wordBreak: 'break-word',
            border: !isUser ? '1px solid #f0f0f0' : 'none',
            boxShadow: isUser 
              ? '0 4px 12px rgba(66, 133, 244, 0.3)' 
              : '0 2px 8px rgba(0,0,0,0.1)',
            position: 'relative',
            '&::before': isUser ? {
              content: '""',
              position: 'absolute',
              top: 16,
              right: -6,
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #4285f4',
              transform: 'rotate(45deg)',
            } : {
              content: '""',
              position: 'absolute',
              top: 16,
              left: -6,
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid white',
              transform: 'rotate(-45deg)',
            },
          }}
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