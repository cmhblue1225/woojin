import React from 'react';
import { Box, Typography, Avatar } from '@mui/material';
import { SmartToy } from '@mui/icons-material';

const TypingIndicator: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, md: 2 },
        px: { xs: 1, md: 2 },
        mb: { xs: 2.5, md: 3 },
        animation: 'messageSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {/* 아바타 */}
      <Avatar
        sx={{
          width: { xs: 40, md: 44 },
          height: { xs: 40, md: 44 },
          background: '#FFFFFF',
          border: '3px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          position: 'relative',
          
          // 온라인 상태 표시
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#10B981',
            border: '2px solid #FFFFFF',
            animation: 'pulse 2s infinite',
          },
        }}
        src="/woojin.jpg"
      >
        <SmartToy sx={{ color: '#4F46E5', fontSize: { xs: 18, md: 20 } }} />
      </Avatar>

      {/* 타이핑 버블 */}
      <Box
        sx={{
          background: '#FFFFFF',
          borderRadius: '20px',
          borderBottomLeftRadius: '8px',
          py: { xs: 2, md: 2.5 },
          px: { xs: 2.5, md: 3 },
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          position: 'relative',
          minWidth: 80,
          
          // 말풍선 꼬리
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: '8px',
            left: '-8px',
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '8px 0 8px 8px',
            borderColor: 'transparent transparent transparent #FFFFFF',
            filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.1))',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* 타이핑 텍스트 */}
          <Typography
            variant="body2"
            sx={{
              color: '#6B7280',
              fontSize: { xs: '0.85rem', md: '0.9rem' },
              fontStyle: 'italic',
              fontWeight: 500,
            }}
          >
            우진이가 답변을 준비하고 있어요...
          </Typography>

          {/* 타이핑 도트 애니메이션 */}
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  animation: 'typingDots 1.4s infinite ease-in-out',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>

    </Box>
  );
};

export default TypingIndicator;