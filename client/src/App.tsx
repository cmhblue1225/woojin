import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Fade } from '@mui/material';
import ChatPageBright from './components/ChatPageBright';
import LoadingScreen from './components/LoadingScreen';
import './App.css';

// 대진대학교 밝은 테마 설정
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#667eea', // 부드러운 보라색
      light: '#a4b7f7',
      dark: '#4c63d2',
    },
    secondary: {
      main: '#764ba2', // 깊은 보라색
      light: '#9575cd',
      dark: '#512da8',
    },
    background: {
      default: '#FFFFFF',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#2D3748',
      secondary: '#4A5568',
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
      color: '#2D3748',
    },
    h2: {
      fontSize: '1.8rem',
      fontWeight: 600,
      color: '#2D3748',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: '#2D3748',
    },
  },
  shape: {
    borderRadius: 20,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 8px 32px rgba(45, 55, 72, 0.15)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.95rem',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 500,
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
      <Fade in timeout={1000}>
        <Box sx={{ width: '100%', height: '100vh' }}>
          <ChatPageBright />
        </Box>
      </Fade>
    </ThemeProvider>
  );
}

export default App;