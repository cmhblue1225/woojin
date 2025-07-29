import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Fade,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import {
  Send,
  AttachFile,
  EmojiEmotions,
  KeyboardVoice,
} from '@mui/icons-material';

interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

const InputArea: React.FC<InputAreaProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = '궁금한 것을 물어보세요... (Shift+Enter로 줄바꿈)',
  maxLength = 2000,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 자동 포커스 (데스크톱만)
  useEffect(() => {
    if (!isMobile && !disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMobile, disabled]);

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  const isNearLimit = value.length > maxLength * 0.8;
  const isOverLimit = value.length > maxLength;
  const canSend = value.trim() && !disabled && !isOverLimit;

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 } }}>
      <Paper
        elevation={0}
        sx={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: isFocused
            ? '2px solid #4F46E5'
            : '2px solid rgba(203, 213, 224, 0.5)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isFocused
            ? '0 0 0 4px rgba(79, 70, 229, 0.1)'
            : '0 4px 20px rgba(0, 0, 0, 0.05)',
          position: 'relative',
          overflow: 'hidden',
          
          // 글로우 효과
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: isFocused
              ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.02) 0%, rgba(124, 58, 237, 0.02) 100%)'
              : 'transparent',
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
          },
          
          '&:hover': !disabled ? {
            borderColor: '#9CA3AF',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
          } : {},
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: { xs: 1, md: 1.5 },
            p: { xs: 1.5, md: 2 },
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* 추가 기능 버튼들 (향후 확장용) */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="파일 첨부 (준비중)" arrow>
                <IconButton
                  size="small"
                  disabled
                  sx={{
                    width: 32,
                    height: 32,
                    color: '#9CA3AF',
                    '&:hover': {
                      background: 'rgba(156, 163, 175, 0.1)',
                    },
                  }}
                >
                  <AttachFile fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="이모지 (준비중)" arrow>
                <IconButton
                  size="small"
                  disabled
                  sx={{
                    width: 32,
                    height: 32,
                    color: '#9CA3AF',
                    '&:hover': {
                      background: 'rgba(156, 163, 175, 0.1)',
                    },
                  }}
                >
                  <EmojiEmotions fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* 텍스트 입력 필드 */}
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            variant="outlined"
            error={isOverLimit}
            sx={{
              '& .MuiOutlinedInput-root': {
                background: 'transparent',
                border: 'none',
                '& fieldset': {
                  border: 'none',
                },
              },
              '& .MuiInputBase-input': {
                color: '#1a202c',
                fontSize: { xs: '0.95rem', md: '1rem' },
                lineHeight: 1.6,
                py: { xs: 1.5, md: 2 },
                px: { xs: 1, md: 1.5 },
                fontWeight: 400,
                '&::placeholder': {
                  color: '#9CA3AF',
                  opacity: 1,
                  fontStyle: 'italic',
                },
              },
              '& .MuiInputBase-inputMultiline': {
                resize: 'none',
              },
            }}
          />

          {/* 음성 입력 버튼 (모바일만, 준비중) */}
          {isMobile && (
            <Tooltip title="음성 입력 (준비중)" arrow>
              <IconButton
                size="medium"
                disabled
                sx={{
                  width: { xs: 40, md: 44 },
                  height: { xs: 40, md: 44 },
                  color: '#9CA3AF',
                  '&:hover': {
                    background: 'rgba(156, 163, 175, 0.1)',
                  },
                }}
              >
                <KeyboardVoice fontSize="medium" />
              </IconButton>
            </Tooltip>
          )}

          {/* 전송 버튼 */}
          <IconButton
            onClick={onSend}
            disabled={!canSend}
            sx={{
              width: { xs: 44, md: 48 },
              height: { xs: 44, md: 48 },
              background: canSend
                ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
                : '#E5E7EB',
              color: canSend ? 'white' : '#9CA3AF',
              boxShadow: canSend
                ? '0 4px 20px rgba(79, 70, 229, 0.3)'
                : 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              
              // 내부 글로우
              '&::before': canSend ? {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%)',
                pointerEvents: 'none',
              } : {},
              
              '&:hover': canSend ? {
                background: 'linear-gradient(135deg, #3730A3 0%, #6B21A8 100%)',
                transform: 'scale(1.05)',
                boxShadow: '0 6px 25px rgba(79, 70, 229, 0.4)',
              } : {},
              
              '&:active': canSend ? {
                transform: 'scale(0.95)',
              } : {},
              
              '&:disabled': {
                background: '#E5E7EB',
                color: '#9CA3AF',
                transform: 'none',
                boxShadow: 'none',
              },
            }}
          >
            <Send fontSize={isMobile ? 'medium' : 'large'} />
          </IconButton>
        </Box>

        {/* 하단 정보 바 */}
        <Fade in={isFocused || value.length > 0}>
          <Box
            sx={{
              px: { xs: 2, md: 2.5 },
              pb: { xs: 1.5, md: 2 },
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* 왼쪽: 도움말 */}
            {!isMobile && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.75rem',
                  color: '#9CA3AF',
                  fontStyle: 'italic',
                }}
              >
                Shift+Enter로 줄바꿈, Enter로 전송
              </Typography>
            )}
            
            {isMobile && (
              <Box />  // 빈 공간
            )}

            {/* 오른쪽: 글자 수 */}
            {value.length > 0 && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  color: isOverLimit ? '#EF4444' : isNearLimit ? '#F59E0B' : '#9CA3AF',
                  fontWeight: isNearLimit ? 600 : 400,
                  transition: 'color 0.2s ease',
                }}
              >
                {value.length.toLocaleString()}/{maxLength.toLocaleString()}
              </Typography>
            )}
          </Box>
        </Fade>

        {/* 에러 메시지 */}
        {isOverLimit && (
          <Fade in>
            <Box
              sx={{
                px: { xs: 2, md: 2.5 },
                pb: { xs: 1.5, md: 2 },
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.75rem',
                  color: '#EF4444',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                ⚠️ 최대 {maxLength.toLocaleString()}자까지 입력 가능합니다
              </Typography>
            </Box>
          </Fade>
        )}
      </Paper>
    </Box>
  );
};

export default InputArea;