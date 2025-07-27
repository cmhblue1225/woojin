import React from 'react';
import { Box, Typography, Chip, Link, useMediaQuery, useTheme } from '@mui/material';
import { AutoAwesome, Update, DataObject } from '@mui/icons-material';

const Footer: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        mt: { xs: 2, md: 3 },
        pt: 2,
        borderTop: '1px solid rgba(59, 130, 246, 0.2)',
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        {/* 상태 정보 */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: { xs: 'center', md: 'flex-start' },
          }}
        >
          <Chip
            icon={<AutoAwesome sx={{ fontSize: 16 }} />}
            label="향상된 시간표 검색"
            size="small"
            sx={{
              background: 'rgba(59, 130, 246, 0.2)',
              color: 'primary.light',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              fontSize: '0.75rem',
            }}
          />
          <Chip
            icon={<Update sx={{ fontSize: 16 }} />}
            label="실시간 데이터"
            size="small"
            sx={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: 'secondary.light',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: '0.75rem',
            }}
          />
          <Chip
            icon={<DataObject sx={{ fontSize: 16 }} />}
            label="홈페이지 정보 추가"
            size="small"
            sx={{
              background: 'rgba(168, 85, 247, 0.2)',
              color: '#C084FC',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              fontSize: '0.75rem',
            }}
          />
        </Box>

        {/* 버전 정보 */}
        {!isMobile && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.75rem',
            }}
          >
            v2.0 • Claude 3.5 Sonnet
          </Typography>
        )}
      </Box>

      {/* 푸터 텍스트 */}
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: { xs: '0.7rem', md: '0.75rem' },
          lineHeight: 1.5,
        }}
      >
        대진대학교 학사정보를 AI로 더욱 쉽고 빠르게 찾아보세요. 
        {!isMobile && (
          <>
            <br />
            Made with ❤️ by{' '}
            <Link
              href="#"
              sx={{
                color: 'primary.light',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Daejin University
            </Link>
          </>
        )}
      </Typography>
    </Box>
  );
};

export default Footer;