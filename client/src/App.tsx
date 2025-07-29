import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Fade } from '@mui/material';
import { ChatContainer } from './components/modern';
import LoadingScreen from './components/LoadingScreen';
import './App.css';

// 모던 테마 설정 (다크/라이트 모드 대응)
const createAppTheme = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    primary: {
      main: '#4F46E5', // 모던한 인디고
      light: '#818CF8',
      dark: '#3730A3',
    },
    secondary: {
      main: '#7C3AED', // 생동감 있는 보라
      light: '#A78BFA',
      dark: '#5B21B6',
    },
    background: {
      default: mode === 'light' ? '#FFFFFF' : '#0F172A',
      paper: mode === 'light' ? '#FFFFFF' : '#1E293B',
    },
    text: {
      primary: mode === 'light' ? '#1a202c' : '#F1F5F9',
      secondary: mode === 'light' ? '#4A5568' : '#CBD5E1',
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
      color: mode === 'light' ? '#1a202c' : '#F1F5F9',
    },
    h2: {
      fontSize: '1.8rem',
      fontWeight: 600,
      color: mode === 'light' ? '#1a202c' : '#F1F5F9',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: mode === 'light' ? '#1a202c' : '#F1F5F9',
    },
    body2: {
      fontSize: '0.9rem',
      lineHeight: 1.6,
      color: mode === 'light' ? '#4A5568' : '#CBD5E1',
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
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#1E293B',
          boxShadow: mode === 'light' 
            ? '0 8px 32px rgba(0, 0, 0, 0.1)' 
            : '0 8px 32px rgba(0, 0, 0, 0.3)',
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
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 16,
          },
        },
      },
    },
  },
});

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // 초기 로딩 시뮬레이션
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // 시스템 테마 감지
  useEffect(() => {
    const savedTheme = localStorage.getItem('woojin-chat-theme');
    if (savedTheme) {
      setThemeMode(savedTheme as 'light' | 'dark');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setThemeMode('dark');
    }
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ThemeProvider theme={createAppTheme(themeMode)}>
      <CssBaseline />
      <Fade in timeout={1000}>
        <Box 
          sx={{ 
            width: '100%', 
            height: '100vh',
            // 글로벌 CSS 변수 설정
            '--primary-color': '#4F46E5',
            '--secondary-color': '#7C3AED',
            '--bg-gradient': themeMode === 'light' 
              ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
              : 'linear-gradient(135deg, #1E1B4B 0%, #581C87 100%)',
          }}
        >
          <ChatContainer />
        </Box>
      </Fade>
    </ThemeProvider>
  );
}

export default App;