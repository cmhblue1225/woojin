import React, { memo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  QuestionAnswer,
  Schedule,
  Person,
  MenuBook,
  School,
  Lightbulb,
  Info,
} from '@mui/icons-material';
import { QuickSuggestion } from '../../types/chat';

interface QuickSuggestionsProps {
  onSuggestionClick: (text: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS: QuickSuggestion[] = [
  {
    id: '1',
    text: '수강신청 일정이 언제야?',
    category: '학사정보',
    icon: <Schedule />,
    color: '#EF4444',
    priority: 1,
  },
  {
    id: '2', 
    text: '박정규 교수님이 담당하시는 강좌는?',
    category: '교수정보',
    icon: <Person />,
    color: '#06B6D4',
    priority: 2,
  },
  {
    id: '3',
    text: '컴퓨터공학과 커리큘럼은 어떻게 되나요?',
    category: '학과정보',
    icon: <MenuBook />,
    color: '#3B82F6', 
    priority: 3,
  },
  {
    id: '4',
    text: '도서관 이용 시간을 알려주세요',
    category: '시설정보',
    icon: <School />,
    color: '#10B981',
    priority: 4,
  },
  {
    id: '5',
    text: '기숙사 신청은 어떻게 해?',
    category: '시설정보',
    icon: <School />,
    color: '#F59E0B',
    priority: 5,
  },
  {
    id: '6',
    text: '장학금 제도에 대해 설명해주세요',
    category: '학사정보',
    icon: <Lightbulb />,
    color: '#8B5CF6',
    priority: 6,
  },
];

const QuickSuggestions: React.FC<QuickSuggestionsProps> = ({
  onSuggestionClick,
  disabled = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery('(max-width: 480px)');

  // 디바이스에 따라 표시할 제안 수 조정
  const visibleSuggestions = isSmallMobile 
    ? SUGGESTIONS.slice(0, 4)
    : isMobile 
    ? SUGGESTIONS.slice(0, 5)
    : SUGGESTIONS;

  return (
    <Paper
      elevation={0}
      sx={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        mb: 3,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        animation: 'fadeInUp 0.6s ease-out',
        position: 'relative',
        
        // 배경 그라데이션 오버레이
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.03) 0%, rgba(124, 58, 237, 0.03) 100%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Box 
        sx={{ 
          p: { xs: 3, md: 4 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* 헤더 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            mb: 3,
          }}
        >
          <Box
            sx={{
              width: { xs: 36, md: 40 },
              height: { xs: 36, md: 40 },
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(79, 70, 229, 0.3)',
              position: 'relative',
              
              // 내부 글로우
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%)',
                pointerEvents: 'none',
              },
            }}
          >
            <QuestionAnswer
              sx={{
                color: 'white',
                fontSize: { xs: 18, md: 20 },
                position: 'relative',
                zIndex: 1,
              }}
            />
          </Box>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.1rem', md: '1.2rem' },
              color: '#1a202c',
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            자주 묻는 질문들
          </Typography>
        </Box>

        {/* 제안 버튼들 */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(2, 1fr)',
            },
            gap: { xs: 1.5, md: 2 },
            mb: 3,
          }}
        >
          {visibleSuggestions.map((suggestion, index) => (
            <Chip
              key={suggestion.id}
              icon={
                <Box
                  sx={{
                    color: suggestion.color,
                    fontSize: 18,
                    display: 'flex',
                    alignItems: 'center',
                    mr: 1,
                  }}
                >
                  {suggestion.icon}
                </Box>
              }
              label={suggestion.text}
              onClick={() => !disabled && onSuggestionClick(suggestion.text)}
              disabled={disabled}
              variant="outlined"
              sx={{
                cursor: disabled ? 'default' : 'pointer',
                fontSize: { xs: '0.85rem', md: '0.9rem' },
                height: 'auto',
                py: { xs: 2, md: 2.5 },
                px: { xs: 2, md: 2.5 },
                borderRadius: '16px',
                justifyContent: 'flex-start',
                textAlign: 'left',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'rgba(255, 255, 255, 0.7)',
                border: `2px solid ${suggestion.color}20`,
                color: '#1a202c',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                
                '& .MuiChip-label': {
                  padding: 0,
                  paddingLeft: '8px',
                  fontWeight: 500,
                  lineHeight: 1.5,
                  whiteSpace: 'normal',
                  textAlign: 'left',
                  width: '100%',
                },
                
                '&:hover': disabled ? {} : {
                  background: `${suggestion.color}08`,
                  borderColor: `${suggestion.color}40`,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 25px ${suggestion.color}20`,
                  
                  '& .MuiChip-icon': {
                    transform: 'scale(1.1)',
                  },
                },
                
                '&:active': disabled ? {} : {
                  transform: 'translateY(0px)',
                  boxShadow: `0 4px 15px ${suggestion.color}15`,
                },
                
                // 애니메이션 딜레이
                animationDelay: `${index * 0.1}s`,
                animation: 'fadeInUp 0.6s ease-out both',
              }}
            />
          ))}
        </Box>

        {/* 구분선 */}
        <Box
          sx={{
            width: '100%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(79, 70, 229, 0.2) 50%, transparent 100%)',
            mb: 3,
          }}
        />

        {/* 도우미 텍스트 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
          }}
        >
          <Info
            sx={{
              color: '#6B7280',
              fontSize: { xs: 16, md: 18 },
            }}
          />
          <Typography
            variant="body2"
            sx={{
              textAlign: 'center',
              fontSize: { xs: '0.8rem', md: '0.85rem' },
              color: '#6B7280',
              fontStyle: 'italic',
              fontWeight: 500,
            }}
          >
            질문을 {isMobile ? '탭하거나' : '클릭하거나'} 직접 입력해보세요! ✨
          </Typography>
        </Box>
      </Box>

    </Paper>
  );
};

export default memo(QuickSuggestions);