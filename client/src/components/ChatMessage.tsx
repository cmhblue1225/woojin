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
        mb: 2,
        alignItems: 'flex-start',
        gap: 1,
      }}
    >
      {/* 아바타 */}
      <Avatar
        sx={{
          bgcolor: isUser ? 'primary.main' : 'white',
          width: 32,
          height: 32,
          border: !isUser ? '1px solid #e0e0e0' : 'none',
        }}
        src={!isUser ? '/woojin.jpg' : undefined}
      >
        {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
      </Avatar>

      {/* 메시지 내용 */}
      <Box
        sx={{
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        {/* 메시지 버블 */}
        <Paper
          elevation={1}
          sx={{
            p: 2,
            bgcolor: isUser ? 'primary.main' : 'white',
            color: isUser ? 'white' : 'text.primary',
            borderRadius: 2,
            borderTopLeftRadius: !isUser ? 1 : 2,
            borderTopRightRadius: isUser ? 1 : 2,
            maxWidth: '100%',
            wordBreak: 'break-word',
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