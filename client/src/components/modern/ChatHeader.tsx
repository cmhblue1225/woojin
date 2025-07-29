import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Avatar,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  AutoAwesome,
  Refresh,
  Circle,
  DarkMode,
  LightMode,
} from '@mui/icons-material';
import { ThemeMode } from '../../types/chat';

interface ChatHeaderProps {
  onClearChat: () => void;
  isConnected: boolean;
  themeMode: ThemeMode;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onClearChat,
  isConnected,
  themeMode,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: { xs: '20px', md: '24px' },
        p: { xs: 2, md: 2.5 },
        mb: 2,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(124, 58, 237, 0.05) 100%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* 왼쪽: 로고 및 타이틀 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, md: 2 },
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* 로고 */}
          <Avatar
            sx={{
              width: { xs: 44, md: 48 },
              height: { xs: 44, md: 48 },
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 4px 20px rgba(79, 70, 229, 0.3)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%)',
                pointerEvents: 'none',
              },
            }}
            src="/woojin.jpg"
          >
            <AutoAwesome sx={{ color: 'white', fontSize: { xs: 20, md: 22 } }} />
          </Avatar>

          {/* 타이틀 정보 */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.1rem', md: '1.25rem' },
                color: '#1a202c',
                lineHeight: 1.2,
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              AI 챗봇 우진이
              <Box
                component="span"
                sx={{
                  fontSize: { xs: '1.2rem', md: '1.4rem' },
                  animation: 'sparkle 2s ease-in-out infinite',
                }}
              >
                ✨
              </Box>
            </Typography>

            <Typography
              variant="caption"
              sx={{
                color: 'rgba(26, 32, 44, 0.7)',
                fontSize: { xs: '0.75rem', md: '0.8rem' },
                fontWeight: 500,
                display: 'block',
                lineHeight: 1,
              }}
            >
              대진대학교 스마트 학사 도우미
            </Typography>
          </Box>
        </Box>

        {/* 오른쪽: 상태 및 액션 버튼들 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, md: 1.5 },
          }}
        >
          {/* 연결 상태 */}
          <Chip
            icon={
              <Circle
                sx={{
                  fontSize: '8px !important',
                  color: isConnected ? '#10B981' : '#EF4444',
                  animation: isConnected ? 'pulse 2s infinite' : 'none',
                }}
              />
            }
            label={isConnected ? 'ONLINE' : 'OFFLINE'}
            size="small"
            sx={{
              height: { xs: 26, md: 28 },
              background: isConnected
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
              color: isConnected ? '#10B981' : '#EF4444',
              fontSize: { xs: '0.65rem', md: '0.7rem' },
              fontWeight: 600,
              border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '14px',
              '& .MuiChip-icon': {
                marginLeft: '6px',
              },
            }}
          />

          {/* 테마 토글 */}
          <IconButton
            size={isMobile ? 'small' : 'medium'}
            onClick={themeMode.toggleMode}
            sx={{
              width: { xs: 36, md: 40 },
              height: { xs: 36, md: 40 },
              background: 'rgba(79, 70, 229, 0.1)',
              color: '#4F46E5',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                background: 'rgba(79, 70, 229, 0.2)',
                transform: 'scale(1.1) rotate(180deg)',
              },
            }}
          >
            {themeMode.mode === 'light' ? (
              <DarkMode fontSize={isMobile ? 'small' : 'medium'} />
            ) : (
              <LightMode fontSize={isMobile ? 'small' : 'medium'} />
            )}
          </IconButton>

          {/* 새로고침 버튼 */}
          <IconButton
            size={isMobile ? 'small' : 'medium'}
            onClick={onClearChat}
            sx={{
              width: { xs: 36, md: 40 },
              height: { xs: 36, md: 40 },
              background: 'rgba(124, 58, 237, 0.1)',
              color: '#7C3AED',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                background: 'rgba(124, 58, 237, 0.2)',
                transform: 'scale(1.1) rotate(360deg)',
              },
            }}
          >
            <Refresh fontSize={isMobile ? 'small' : 'medium'} />
          </IconButton>
        </Box>
      </Box>

    </Box>
  );
};

export default ChatHeader;