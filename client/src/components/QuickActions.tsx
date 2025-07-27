import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Paper,
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
  // 기본 빠른 액션 목록
  const actions = [
    "컴퓨터공학과 커리큘럼은 어떻게 되나요?",
    "기계공학과 교수님들을 알려주세요",
    "대진대학교 입학 전형은 어떻게 되나요?",
    "도서관 이용 시간을 알려주세요",
    "장학금 제도에 대해 설명해주세요",
    "졸업 요건이 궁금합니다"
  ];
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: { xs: 1.5, sm: 2 }, 
        mb: { xs: 1, sm: 2 }, 
        borderRadius: 3,
        background: 'rgba(30, 41, 59, 0.6)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        mb: { xs: 1, sm: 1.5 },
        justifyContent: 'center',
      }}>
        <QuestionAnswerIcon color="primary" fontSize="small" />
        <Typography 
          variant="subtitle2" 
          fontWeight="600"
          sx={{ 
            fontSize: { xs: '0.9rem', sm: '1rem' },
            color: 'text.primary'
          }}
        >
          자주 묻는 질문들
        </Typography>
      </Box>
      
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: { xs: 0.75, sm: 1 },
        justifyContent: 'center',
      }}>
        {actions.map((action, index) => (
          <Chip
            key={index}
            label={action}
            onClick={() => !disabled && onQuickAction(action)}
            disabled={disabled}
            variant="outlined"
            sx={{
              cursor: disabled ? 'default' : 'pointer',
              fontSize: { xs: '0.8rem', sm: '0.85rem' },
              height: 'auto',
              py: { xs: 0.75, sm: 1 },
              px: { xs: 1, sm: 1.5 },
              borderRadius: 2,
              transition: 'all 0.3s ease-in-out',
              '& .MuiChip-label': {
                whiteSpace: 'normal',
                textAlign: 'center',
                lineHeight: 1.3,
                padding: { xs: '6px 8px', sm: '8px 12px' },
              },
              '&:hover': {
                bgcolor: disabled ? 'transparent' : 'rgba(59, 130, 246, 0.2)',
                color: disabled ? 'inherit' : 'primary.light',
                borderColor: disabled ? 'rgba(59, 130, 246, 0.2)' : 'primary.main',
                transform: disabled ? 'none' : 'translateY(-2px)',
                boxShadow: disabled ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
              },
              '&:active': {
                transform: disabled ? 'none' : 'translateY(0px)',
              },
            }}
          />
        ))}
      </Box>
      
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ 
          mt: { xs: 1, sm: 1.5 }, 
          display: 'block',
          textAlign: 'center',
          fontSize: { xs: '0.7rem', sm: '0.75rem' },
        }}
      >
        💡 위 질문들을 클릭하거나 직접 질문을 입력해보세요!
      </Typography>
    </Paper>
  );
};

export default QuickActions;