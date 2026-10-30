import { Avatar } from '@mui/material';
import { tintForString } from '../theme/theme';

function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function InitialsAvatar({ name, src, size = 36, sx }) {
  const tint = tintForString(name || '');
  return (
    <Avatar
      src={src || undefined}
      alt={name || ''}
      sx={{
        width: size,
        height: size,
        bgcolor: tint.bg,
        color: tint.fg,
        fontSize: Math.max(11, size * 0.36),
        fontWeight: 700,
        ...sx,
      }}
    >
      {initialsOf(name)}
    </Avatar>
  );
}