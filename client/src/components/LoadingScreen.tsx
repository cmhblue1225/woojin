import React from 'react';
import { Box, Typography, CircularProgress, Fade } from '@mui/material';
import { School } from '@mui/icons-material';

const LoadingScreen: React.FC = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 배경 애니메이션 */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)
          `,
          animation: 'float 20s ease-in-out infinite',
        }}
      />

      <Fade in timeout={800}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            zIndex: 1,
          }}
        >
          {/* 로고 */}
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(45deg, #3B82F6, #10B981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(59, 130, 246, 0.4)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              <School sx={{ color: 'white', fontSize: 40 }} />
            </Box>
            
            {/* 로딩 링 */}
            <CircularProgress
              size={100}
              thickness={2}
              sx={{
                position: 'absolute',
                color: 'primary.light',
                opacity: 0.3,
              }}
            />
          </Box>

          {/* 텍스트 */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(45deg, #3B82F6, #10B981)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
                fontSize: { xs: '1.8rem', md: '2.125rem' },
              }}
            >
              대진대학교 우진봇
            </Typography>
            
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                fontSize: { xs: '0.9rem', md: '1rem' },
                animation: 'fadeInOut 2s ease-in-out infinite',
              }}
            >
              AI 챗봇을 준비하고 있어요...
            </Typography>
          </Box>
        </Box>
      </Fade>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 8px 32px rgba(59, 130, 246, 0.4);
            }
            50% {
              transform: scale(1.05);
              box-shadow: 0 12px 40px rgba(59, 130, 246, 0.6);
            }
          }

          @keyframes fadeInOut {
            0%, 100% {
              opacity: 0.7;
            }
            50% {
              opacity: 1;
            }
          }

          @keyframes float {
            0%, 100% {
              transform: translate(0, 0) rotate(0deg);
            }
            33% {
              transform: translate(30px, -30px) rotate(120deg);
            }
            66% {
              transform: translate(-20px, 20px) rotate(240deg);
            }
          }
        `}
      </style>
    </Box>
  );
};

export default LoadingScreen;