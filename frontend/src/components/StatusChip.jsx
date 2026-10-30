import { Box, Chip } from '@mui/material';

const MAP = {

  present: { label: 'Present', bg: '#E8F8EE', fg: '#178A43' },
  active: { label: 'Active', bg: '#E8F8EE', fg: '#178A43' },
  approved: { label: 'Approved', bg: '#E8F8EE', fg: '#178A43' },
  completed: { label: 'Completed', bg: '#E8F8EE', fg: '#178A43' },
  linked: { label: 'Linked', bg: '#E8F8EE', fg: '#178A43' },
  on_time: { label: 'On time', bg: '#E8F8EE', fg: '#178A43' },


  late: { label: 'Late', bg: '#FFF4E2', fg: '#C9720A' },
  pending: { label: 'Pending', bg: '#FFF4E2', fg: '#C9720A' },
  half_day: { label: 'Half day', bg: '#FFF4E2', fg: '#C9720A' },


  absent: { label: 'Absent', bg: '#FDECEC', fg: '#C62F2F' },
  inactive: { label: 'Inactive', bg: '#FDECEC', fg: '#C62F2F' },
  rejected: { label: 'Rejected', bg: '#FDECEC', fg: '#C62F2F' },


  on_leave: { label: 'On leave', bg: '#F1ECFF', fg: '#6A3DE8' },
  day_off: { label: 'Day off', bg: '#EAF0FF', fg: '#1454E0' },
  yet_to_checkout: { label: 'Yet to check out', bg: '#EAF0FF', fg: '#1454E0' },
  not_linked: { label: 'Not linked', bg: '#F2F5FA', fg: '#64748B' },
};

export default function StatusChip({ status, label, size = 'small' }) {
  const key = String(status || '').toLowerCase();
  const cfg = MAP[key] || { label: label || status || 'Unknown', bg: '#F2F5FA', fg: '#64748B' };
  return (
    <Chip
      size={size}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            component="span"
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: cfg.fg,
              flexShrink: 0,
            }}
          />
          {label || cfg.label}
        </Box>
      }
      sx={{ bgcolor: cfg.bg, color: cfg.fg }}
    />
  );
}