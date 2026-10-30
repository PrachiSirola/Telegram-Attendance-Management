import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';

export default function NotificationsMenu({ items, unreadCount, onRefresh }) {
  const [anchor, setAnchor] = useState(null);
  const [markingRead, setMarkingRead] = useState(false);
  const open = Boolean(anchor);

  async function markAllRead() {
    const ids = items.filter((n) => !n.read).map((n) => n._id);
    if (ids.length === 0) return;
    setMarkingRead(true);
    try {
      await api.post('/notifications/mark-read', { ids });
      onRefresh?.();
    } catch {
      /* non-critical */
    } finally {
      setMarkingRead(false);
    }
  }

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton color="inherit" onClick={(e) => setAnchor(e.currentTarget)}>
          <Badge
            color="error"
            badgeContent={unreadCount}
            max={99}
            invisible={unreadCount === 0}
            sx={{ '& .MuiBadge-badge': { fontWeight: 700, fontSize: '0.65rem' } }}
          >
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxHeight: 460 } } }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="subtitle1">Notifications</Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={markAllRead}
              disabled={markingRead}
              startIcon={markingRead ? <CircularProgress size={14} color="inherit" /> : null}
            >
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        {items.length === 0 && (
          <Box sx={{ px: 3, py: 5, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              You&apos;re all caught up.
            </Typography>
          </Box>
        )}
        {items.slice(0, 20).map((n) => (
          <MenuItem
            key={n._id}
            onClick={() => setAnchor(null)}
            sx={{
              whiteSpace: 'normal',
              alignItems: 'flex-start',
              py: 1.25,
              borderLeft: '3px solid',
              borderColor: n.read ? 'transparent' : 'primary.main',
            }}
          >
            <ListItemText
              primary={
                <Typography variant="body2" fontWeight={n.read ? 500 : 700}>
                  {n.title}
                </Typography>
              }
              secondary={
                <>
                  {n.body && (
                    <Typography variant="caption" color="text.secondary" component="div">
                      {n.body}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.disabled">
                    {n.createdAt
                      ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })
                      : ''}
                  </Typography>
                </>
              }
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}