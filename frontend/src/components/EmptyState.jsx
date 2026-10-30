import { Box, Typography } from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { brand } from '../theme/theme';
export function EmptyIllustration({ icon, size = 96 }) {
  const w = size;
  return (
    <Box sx={{ position: 'relative', width: w * 1.45, height: w, mx: 'auto', mb: 1.5 }} aria-hidden>
      {/* soft cloud */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          width: '100%',
          height: '58%',
          transform: 'translateX(-50%)',
          borderRadius: 999,
          background: 'linear-gradient(180deg, #E3ECFF 0%, #EEF0FF 100%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: '22%',
          bottom: '28%',
          width: '40%',
          height: '52%',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #E3ECFF 0%, #EAEFFF 100%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: '46%',
          bottom: '30%',
          width: '30%',
          height: '40%',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #E6EDFF 0%, #EEF0FF 100%)',
        }}
      />
      {/* icon tile */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '4%',
          width: w * 0.5,
          height: w * 0.5,
          transform: 'translateX(-50%)',
          borderRadius: '14px',
          display: 'grid',
          placeItems: 'center',
          bgcolor: '#fff',
          color: brand.blue500,
          border: `1px solid ${brand.cardBorder}`,
          boxShadow: '0 8px 18px -8px rgba(40, 70, 190, 0.35)',
          '& svg': { fontSize: w * 0.3 },
        }}
      >
        {icon || <EventAvailableIcon />}
      </Box>
    </Box>
  );
}

export default function EmptyState({ icon, title, hint, dense = false, sx }) {
  return (
    <Box sx={{ py: dense ? 2.5 : 5, textAlign: 'center', ...sx }}>
      <EmptyIllustration icon={icon} size={dense ? 84 : 96} />
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
