import React, { memo, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Send, Mic, Stop } from '@mui/icons-material';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxRows?: number;
  minRows?: number;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "메시지를 입력하세요...",
  maxRows = 4,
  minRows = 1,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery('(max-width: 480px)');
  
  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  const [isVoiceRecording, setIsVoiceRecording] = React.useState(false);

  // Enter 키 핸들링
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (value.trim() && !disabled) {
        onSend(value);
      }
    }
  }, [value, disabled, onSend]);

  // 전송 버튼 핸들링
  const handleSend = useCallback(() => {
    if (value.trim() && !disabled) {
      onSend(value);
    }
  }, [value, disabled, onSend]);

  // 음성 녹음 토글 (향후 구현)
  const handleVoiceToggle = useCallback(() => {
    setIsVoiceRecording(prev => !prev);
    // TODO: 음성 인식 구현
  }, []);

  // 입력창 포커스
  const focusInput = useCallback(() => {
    if (textFieldRef.current) {
      textFieldRef.current.focus();
    }
  }, []);

  // 컴포넌트 마운트 시 포커스 (모바일 제외)
  useEffect(() => {
    if (!isMobile && !disabled) {
      const timer = setTimeout(focusInput, 100);
      return () => clearTimeout(timer);
    }
  }, [isMobile, disabled, focusInput]);

  // 스타일 메모이제이션
  const containerStyles = useMemo(() => ({
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
  }), []);

  const textFieldStyles = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      background: 'transparent',
      border: 'none',
      '& fieldset': {
        border: 'none',
      },
      '&:hover fieldset': {
        border: 'none',
      },
      '&.Mui-focused fieldset': {
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
    '& .MuiInputBase-inputMultiline': {
      resize: 'none',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(59, 130, 246, 0.3) transparent',
      '&::-webkit-scrollbar': {
        width: '4px',
      },
      '&::-webkit-scrollbar-track': {
        background: 'transparent',
      },
      '&::-webkit-scrollbar-thumb': {
        background: 'rgba(59, 130, 246, 0.3)',
        borderRadius: '2px',
      },
    },
  }), []);

  const sendButtonStyles = useMemo(() => {
    const isActive = value.trim() && !disabled;
    return {
      background: isActive
        ? 'linear-gradient(135deg, #3B82F6, #10B981)'
        : 'rgba(59, 130, 246, 0.2)',
      color: 'white',
      width: { xs: 40, md: 44 },
      height: { xs: 40, md: 44 },
      minWidth: 'auto',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        background: isActive
          ? 'linear-gradient(135deg, #1E40AF, #059669)'
          : 'rgba(59, 130, 246, 0.3)',
        transform: isActive ? 'scale(1.05)' : 'none',
      },
      '&:active': {
        transform: isActive ? 'scale(0.95)' : 'none',
      },
      '&:disabled': {
        background: 'rgba(59, 130, 246, 0.1)',
        color: 'rgba(255, 255, 255, 0.3)',
      },
    };
  }, [value, disabled]);

  const voiceButtonStyles = useMemo(() => ({
    color: isVoiceRecording ? 'error.main' : 'text.secondary',
    width: { xs: 36, md: 40 },
    height: { xs: 36, md: 40 },
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      background: isVoiceRecording 
        ? 'rgba(244, 67, 54, 0.1)' 
        : 'rgba(59, 130, 246, 0.1)',
      color: isVoiceRecording ? 'error.light' : 'primary.light',
    },
  }), [isVoiceRecording]);

  return (
    <Paper elevation={0} sx={containerStyles}>
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
              disabled={disabled}
              sx={voiceButtonStyles}
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
          inputRef={textFieldRef}
          fullWidth
          multiline
          maxRows={maxRows}
          minRows={minRows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          variant="outlined"
          sx={textFieldStyles}
          inputProps={{
            'aria-label': '메시지 입력',
            'data-testid': 'chat-input',
          }}
        />

        {/* 전송 버튼 */}
        <Tooltip title="메시지 전송 (Enter)">
          <span>
            <IconButton
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              sx={sendButtonStyles}
              aria-label="메시지 전송"
            >
              <Send fontSize={isMobile ? 'small' : 'medium'} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* 입력 도우미 텍스트 */}
      {!isSmallMobile && (
        <Box
          sx={{
            px: 2,
            pb: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: '0.7rem',
              color: 'text.secondary',
              opacity: 0.8,
            }}
          >
            {isMobile ? 'Enter로 전송' : 'Shift+Enter로 줄바꿈, Enter로 전송'}
          </Box>
          
          {value.trim() && (
            <Box
              component="span"
              sx={{
                fontSize: '0.7rem',
                color: 'text.secondary',
                opacity: 0.6,
              }}
            >
              {value.length}자
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default memo(ChatInput);