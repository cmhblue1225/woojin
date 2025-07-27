import React, { memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { 
  AutoAwesome, 
  Refresh, 
  MoreVert,
  Circle
} from '@mui/icons-material';

interface ChatHeaderProps {
  onClearChat: () => void;
  onMenuClick?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ 
  onClearChat, 
  onMenuClick 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: 2,
      }}
    >
      {/* 왼쪽: 타이틀 영역 */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: { xs: 1, md: 1.5 },
          flex: 1,
          minWidth: 0, // 텍스트 오버플로우 방지
        }}
      >
        {/* 아이콘 */}
        <Box
          sx={{
            width: { xs: 36, md: 40 },
            height: { xs: 36, md: 40 },
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3B82F6 0%, #10B981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          }}
        >
          <AutoAwesome 
            sx={{ 
              color: 'white', 
              fontSize: { xs: 18, md: 20 } 
            }} 
          />
        </Box>

        {/* 타이틀 및 서브타이틀 */}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1rem', md: '1.1rem' },
              color: 'text.primary',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            AI 챗봇 우진이
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '0.7rem', md: '0.75rem' },
              lineHeight: 1,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            대진대학교 학사정보 도우미
          </Typography>
        </Box>
      </Box>

      {/* 오른쪽: 상태 및 액션 버튼 */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: { xs: 0.5, md: 1 },
          flexShrink: 0,
        }}
      >
        {/* 라이브 상태 표시 */}
        <Tooltip title="실시간 응답 가능" placement="bottom">
          <Chip
            icon={
              <Circle 
                sx={{ 
                  fontSize: '8px !important',
                  animation: 'pulse 2s infinite',
                  color: '#10B981',
                }} 
              />
            }
            label="LIVE"
            size="small"
            sx={{
              height: { xs: 24, md: 28 },
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981',
              fontSize: { xs: '0.65rem', md: '0.7rem' },
              fontWeight: 600,
              border: '1px solid rgba(16, 185, 129, 0.3)',
              '& .MuiChip-icon': {
                marginLeft: 0.5,
                marginRight: -0.5,
              },
              '& .MuiChip-label': {
                px: { xs: 0.5, md: 0.75 },
              },
            }}
          />
        </Tooltip>

        {/* 새로고침 버튼 */}
        <Tooltip title="채팅 초기화" placement="bottom">
          <IconButton
            size={isMobile ? 'small' : 'medium'}
            onClick={onClearChat}
            sx={{
              color: 'text.secondary',
              width: { xs: 36, md: 40 },
              height: { xs: 36, md: 40 },
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                background: 'rgba(59, 130, 246, 0.1)',
                color: 'primary.light',
                transform: 'rotate(180deg)',
              },
              '&:active': {
                transform: 'rotate(180deg) scale(0.95)',
              },
            }}
          >
            <Refresh fontSize={isMobile ? 'small' : 'medium'} />
          </IconButton>
        </Tooltip>

        {/* 메뉴 버튼 (모바일에서만 표시) */}
        {isMobile && onMenuClick && (
          <Tooltip title="메뉴" placement="bottom">
            <IconButton
              size="small"
              onClick={onMenuClick}
              sx={{
                color: 'text.secondary',
                width: 36,
                height: 36,
                '&:hover': {
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: 'primary.light',
                },
              }}
            >
              <MoreVert fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* 펄스 애니메이션 스타일 */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </Box>
  );
};

export default memo(ChatHeader);