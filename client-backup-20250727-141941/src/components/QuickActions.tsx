import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Paper,
} from '@mui/material';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';

interface QuickActionsProps {
  actions: string[];
  onActionClick: (action: string) => void;
  disabled?: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  actions,
  onActionClick,
  disabled = false,
}) => {
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: { xs: 1.5, sm: 2 }, 
        mb: { xs: 1, sm: 2 }, 
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
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
          color="primary" 
          fontWeight="600"
          sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
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
            onClick={() => !disabled && onActionClick(action)}
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
                bgcolor: disabled ? 'transparent' : 'primary.main',
                color: disabled ? 'inherit' : 'white',
                borderColor: disabled ? 'divider' : 'primary.main',
                transform: disabled ? 'none' : 'translateY(-2px)',
                boxShadow: disabled ? 'none' : '0 4px 12px rgba(66, 133, 244, 0.3)',
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