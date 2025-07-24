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
    <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <QuestionAnswerIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" color="primary" fontWeight="600">
          자주 묻는 질문들
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {actions.map((action, index) => (
          <Chip
            key={index}
            label={action}
            onClick={() => !disabled && onActionClick(action)}
            disabled={disabled}
            variant="outlined"
            sx={{
              cursor: disabled ? 'default' : 'pointer',
              fontSize: '0.85rem',
              height: 'auto',
              py: 0.5,
              px: 1,
              '& .MuiChip-label': {
                whiteSpace: 'normal',
                textAlign: 'left',
                lineHeight: 1.2,
                padding: '4px 8px',
              },
              '&:hover': {
                bgcolor: disabled ? 'transparent' : 'primary.main',
                color: disabled ? 'inherit' : 'white',
                borderColor: disabled ? 'divider' : 'primary.main',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          />
        ))}
      </Box>
      
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1, display: 'block' }}
      >
        💡 위 질문들을 클릭하거나 직접 질문을 입력해보세요!
      </Typography>
    </Paper>
  );
};

export default QuickActions;