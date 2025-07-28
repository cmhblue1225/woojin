import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Fade } from '@mui/material';
import ChatPageNew from './components/ChatPageNew';
import LoadingScreen from './components/LoadingScreen';
import './App.css';

// 대진대학교 테마 설정
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3B82F6', // 대진대 블루
      light: '#60A5FA',
      dark: '#1E40AF',
    },
    secondary: {
      main: '#10B981', // 에메랄드 그린
      light: '#34D399',
      dark: '#059669',
    },
    background: {
      default: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)',
      paper: 'rgba(30, 41, 59, 0.8)',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#CBD5E1',
    },
  },
  typography: {
    fontFamily: [
      'Pretendard',
      '-apple-system',
      'BlinkMacSystemFont',
      'system-ui',
      'Roboto',
      'sans-serif'
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      background: 'linear-gradient(45deg, #3B82F6, #10B981)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    h2: {
      fontSize: '1.8rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(30, 41, 59, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.95rem',
        },
      },
    },
  },
});

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 초기 로딩 시뮬레이션
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 패턴 */}
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
        
        {/* 메인 컨테이너 - 새로운 채팅 페이지 */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100vh',
          }}
        >
          <Fade in timeout={1000}>
            <Box sx={{ width: '100%', height: '100%' }}>
              <ChatPageNew />
            </Box>
          </Fade>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;