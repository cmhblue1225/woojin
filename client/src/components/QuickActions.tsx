import React, { memo, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';

interface QuickActionsProps {
  onQuickAction: (text: string) => void;
  disabled?: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onQuickAction,
  disabled = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery('(max-width: 480px)');

  // 기본 빠른 액션 목록 메모이제이션
  const allActions = useMemo(() => [
    "컴퓨터공학과 커리큘럼은 어떻게 되나요?",
    "기계공학과 교수님들을 알려주세요",
    "대진대학교 입학 전형은 어떻게 되나요?",
    "도서관 이용 시간을 알려주세요",
    "장학금 제도에 대해 설명해주세요",
    "졸업 요건이 궁금합니다"
  ], []);

  const actions = useMemo(() => {
    if (isSmallMobile) return allActions.slice(0, 4);
    if (isMobile) return allActions.slice(0, 5);
    return allActions;
  }, [isSmallMobile, isMobile, allActions]);

  // 컨테이너 스타일 메모이제이션
  const containerStyles = useMemo(() => ({
    background: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: { xs: 2, md: 2.5 },
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      border: '1px solid rgba(59, 130, 246, 0.3)',
      background: 'rgba(15, 23, 42, 0.5)',
    },
  }), []);

  // 칩 스타일 생성 함수
  const getChipStyles = useCallback((index: number) => ({
    cursor: disabled ? 'default' : 'pointer',
    fontSize: { xs: '0.75rem', md: '0.85rem' },
    height: 'auto',
    py: { xs: 1, md: 1.25 },
    px: { xs: 1.5, md: 2 },
    borderRadius: 2,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    color: 'text.primary',
    '& .MuiChip-label': {
      whiteSpace: 'normal',
      textAlign: 'center',
      lineHeight: 1.4,
      padding: 0,
      fontWeight: 500,
    },
    '&:hover': disabled ? {} : {
      background: 'rgba(59, 130, 246, 0.15)',
      borderColor: 'primary.main',
      color: 'primary.light',
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 20px rgba(59, 130, 246, 0.25)',
    },
    '&:active': disabled ? {} : {
      transform: 'translateY(0px)',
      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
    },
    animationDelay: `${index * 0.1}s`,
    animation: 'fadeInUp 0.6s ease-out both',
  }), [disabled]);
  return (
    <Paper elevation={0} sx={containerStyles}>
      <Box 
        sx={{ 
          p: { xs: 2, md: 2.5 },
        }}
      >
        {/* 헤더 */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5, 
          mb: { xs: 2, md: 2.5 },
          justifyContent: 'center',
        }}>
          <Box
            sx={{
              width: { xs: 24, md: 28 },
              height: { xs: 24, md: 28 },
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3B82F6, #10B981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <QuestionAnswerIcon 
              sx={{ 
                color: 'white',
                fontSize: { xs: 14, md: 16 },
              }}
            />
          </Box>
          <Typography 
            variant="subtitle2" 
            fontWeight="700"
            sx={{ 
              fontSize: { xs: '0.9rem', md: '1rem' },
              color: 'text.primary',
              background: 'linear-gradient(45deg, #3B82F6, #10B981)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            자주 묻는 질문들
          </Typography>
        </Box>
        
        {/* 액션 버튼들 */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr 1fr',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: { xs: 1, md: 1.5 },
          mb: { xs: 1.5, md: 2 },
        }}>
          {actions.map((action, index) => (
            <Chip
              key={index}
              label={action}
              onClick={() => !disabled && onQuickAction(action)}
              disabled={disabled}
              variant="outlined"
              sx={getChipStyles(index)}
            />
          ))}
        </Box>
        
        {/* 도우미 텍스트 */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ 
            display: 'block',
            textAlign: 'center',
            fontSize: { xs: '0.7rem', md: '0.75rem' },
            opacity: 0.8,
            fontStyle: 'italic',
          }}
        >
          💡 {isMobile ? '질문을 탭하거나' : '질문을 클릭하거나'} 직접 입력해보세요!
        </Typography>
      </Box>

      {/* CSS 애니메이션 */}
      <style>
        {`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </Paper>
  );
};

export default memo(QuickActions);