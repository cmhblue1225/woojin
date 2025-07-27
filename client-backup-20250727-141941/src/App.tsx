import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, AppBar, Toolbar, Typography, Box } from '@mui/material';
import ChatInterface from './components/ChatInterface';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#4285f4',
      light: '#7baaf7',
      dark: '#2e5ce6',
    },
    secondary: {
      main: '#34a853',
      light: '#81c784',
      dark: '#2e7d32',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
    },
  },
  typography: {
    fontFamily: [
      'Pretendard',
      'Noto Sans KR',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'sans-serif',
    ].join(','),
    h6: {
      fontWeight: 600,
      fontSize: '1.1rem',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="App">
        <AppBar 
          position="static" 
          elevation={0}
          sx={{
            background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  fontWeight: 700,
                  fontSize: { xs: '1rem', sm: '1.25rem' },
                  mr: 1,
                }}
              >
                🎓 대진대학교
              </Typography>
              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  fontWeight: 400,
                  fontSize: { xs: '1rem', sm: '1.25rem' },
                  opacity: 0.9,
                }}
              >
                우진봇
              </Typography>
            </Box>
            <Typography 
              variant="caption" 
              sx={{ 
                display: { xs: 'none', sm: 'block' },
                opacity: 0.9,
                fontSize: '0.875rem',
              }}
            >
              AI 학사정보 도우미
            </Typography>
          </Toolbar>
        </AppBar>
        
        <Container 
          maxWidth="lg" 
          sx={{ 
            mt: { xs: 1, sm: 2 }, 
            mb: { xs: 1, sm: 2 }, 
            px: { xs: 1, sm: 2 },
            height: { xs: 'calc(100vh - 60px)', sm: 'calc(100vh - 80px)' },
          }}
        >
          <ChatInterface />
        </Container>
      </div>
    </ThemeProvider>
  );
}

export default App;
