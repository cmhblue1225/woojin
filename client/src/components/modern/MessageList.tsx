import React, { forwardRef } from 'react';
import { Box } from '@mui/material';
import { Message } from '../../types/chat';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import QuickSuggestions from './QuickSuggestions';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  showSuggestions: boolean;
  onSuggestionClick: (text: string) => void;
  onRetryMessage?: (messageId: string) => void;
  onScroll?: () => void;
}

const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  ({ 
    messages, 
    isLoading, 
    showSuggestions, 
    onSuggestionClick, 
    onRetryMessage,
    onScroll 
  }, ref) => {
    return (
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: { xs: 1, md: 2 },
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 0.5, md: 1 },
          
          // 스크롤바 스타일링
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(156, 163, 175, 0.1)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(79, 70, 229, 0.3)',
            borderRadius: '4px',
            transition: 'background 0.2s ease',
            '&:hover': {
              background: 'rgba(79, 70, 229, 0.5)',
            },
          },
          
          // Firefox 스크롤바
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(79, 70, 229, 0.3) rgba(156, 163, 175, 0.1)',
        }}
        onScroll={onScroll}
      >
        {/* 빠른 제안 (첫 화면에만 표시) */}
        {showSuggestions && messages.length === 1 && (
          <QuickSuggestions 
            onSuggestionClick={onSuggestionClick}
            disabled={isLoading}
          />
        )}

        {/* 메시지 목록 */}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onRetry={onRetryMessage}
          />
        ))}

        {/* 타이핑 인디케이터 */}
        {isLoading && <TypingIndicator />}

        {/* 스크롤 앵커 */}
        <div 
          ref={ref} 
          style={{ 
            height: '1px', 
            flexShrink: 0,
            marginTop: 'auto' 
          }} 
        />
      </Box>
    );
  }
);

MessageList.displayName = 'MessageList';

export default MessageList;