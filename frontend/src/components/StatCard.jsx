import { Box, CircularProgress, Paper, Typography } from '@mui/material';
export default function StatCard({
  icon,
  iconBg,
  iconFg,
  title,
  value,
  sub,
  accent,
  loading = false,
  onClick,
}) {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2,
        height: '100%',
        background: iconBg ? `linear-gradient(120deg, color-mix(in srgb, ${iconBg} 62%, #fff) 0%, #FFFFFF 80%)` : '#fff',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .18s ease, transform .18s ease, border-color .18s ease',
        ...(onClick && {
          '&:hover': {
            boxShadow: 3,
            borderColor: 'primary.light',
            transform: 'translateY(-1px)',
          },
        }),
      }}
    >
      {accent && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            bgcolor: accent,
          }}
        />
      )}
      {icon && (
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '13px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: iconBg || '#fff',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)',
            color: iconFg || 'primary.main',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap
          title={typeof title === 'string' ? title : undefined}
          sx={{ fontWeight: 600, fontSize: '0.8125rem' }}
        >
          {title}
        </Typography>
        {loading ? (
          <Box sx={{ mt: 0.5 }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <Typography variant="h5" fontWeight={700} sx={{ mt: 0.25, lineHeight: 1.2 }}>
            {value}
          </Typography>
        )}
        {sub && (
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ mt: 0.25, fontSize: '0.72rem', lineHeight: 1.3 }}
          >
            {sub}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}