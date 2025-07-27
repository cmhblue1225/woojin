import React from 'react';
import { Box, Typography, Chip, useMediaQuery, useTheme, IconButton } from '@mui/material';
import { School, SmartToy, InfoOutlined } from '@mui/icons-material';

const Header: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: { xs: 2, md: 3 },
        px: { xs: 1, md: 2 },
        py: 2,
        background: 'rgba(30, 41, 59, 0.4)',
        backdropFilter: 'blur(10px)',
        borderRadius: 2,
        border: '1px solid rgba(59, 130, 246, 0.2)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: { xs: 40, md: 48 },
            height: { xs: 40, md: 48 },
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #3B82F6, #10B981)',
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
          }}
        >
          <School sx={{ color: 'white', fontSize: { xs: 20, md: 24 } }} />
        </Box>
        
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.1rem', md: '1.3rem' },
              background: 'linear-gradient(45deg, #3B82F6, #10B981)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            대진대학교
          </Typography>
          {!isMobile && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.8rem',
              }}
            >
              AI 학사정보 도우미
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          icon={<SmartToy sx={{ fontSize: 16 }} />}
          label="AI 챗봇"
          size="small"
          sx={{
            background: 'rgba(16, 185, 129, 0.2)',
            color: 'secondary.light',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            '& .MuiChip-icon': {
              color: 'secondary.light',
            },
          }}
        />
        
        {!isMobile && (
          <IconButton
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                background: 'rgba(59, 130, 246, 0.1)',
                color: 'primary.light',
              },
            }}
          >
            <InfoOutlined fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Box>
  );
};

export default Header;