import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import { TIME_SLOTS, breakWindowSlots, endTime, to12h } from '../utils/time';
import { brand } from '../theme/theme';

const BREAKS = [
  { key: 'morning', label: 'Morning break', durationMins: 15 },
  { key: 'lunch', label: 'Lunch break', durationMins: 30 },
  { key: 'evening', label: 'Evening break', durationMins: 15 },
];
export default function ShiftBreakPicker({ value, onChange, label = 'Shift timing' }) {
  const [shiftOpen, setShiftOpen] = useState(false);
  const { shiftStart, shiftEnd, breakTimings } = value;

  const shiftLabel = shiftStart && shiftEnd ? `${to12h(shiftStart)} – ${to12h(shiftEnd)}` : '';

  return (
    <>
      <TextField
        label={label}
        value={shiftLabel}
        onClick={() => setShiftOpen(true)}
        placeholder="Tap to set — e.g. 9:30 AM – 6:30 PM"
        size="small"
        fullWidth
        InputProps={{
          readOnly: true,
          sx: { cursor: 'pointer' },
          startAdornment: (
            <InputAdornment position="start">
              <ScheduleIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
        inputProps={{ sx: { cursor: 'pointer' } }}
      />

      <Box
        sx={{
          mt: 2,
          p: 2.25,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '14px',
          bgcolor: brand.blueSofter,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <LocalCafeIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2">Break timings</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Pick a window — the employee can start their break any time inside it, for the fixed
          duration.
          {shiftStart && shiftEnd ? ' Options are limited to the shift window.' : ' Set a shift to narrow these options.'}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          {BREAKS.map((b) => {
            const start = breakTimings?.[b.key]?.start || '';
            const windowWidth = b.key === 'lunch' ? 30 : Math.min(b.durationMins * 2, 30);
            const windowSlots = breakWindowSlots(shiftStart, shiftEnd, b.durationMins, b.key);
            const windowEnd = endTime(start, windowWidth);
            return (
              <TextField
                key={b.key}
                select
                label={b.label}
                value={start}
                onChange={(e) =>
                  onChange({
                    ...value,
                    breakTimings: { ...breakTimings, [b.key]: { start: e.target.value } },
                  })
                }
                helperText={
                  windowEnd
                    ? `${b.durationMins} min break, within window`
                    : `${b.durationMins} min break`
                }
                size="small"
                fullWidth
                SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}
              >
                <MenuItem value="">
                  <em>Not set</em>
                </MenuItem>
                {windowSlots.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>
            );
          })}
        </Box>
      </Box>

      <Dialog open={shiftOpen} onClose={() => setShiftOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{label}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2, mt: 1 }}>
            Overnight shifts are supported — set an end time earlier than the start.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              select
              label="Shift start"
              value={shiftStart}
              onChange={(e) => onChange({ ...value, shiftStart: e.target.value })}
              size="small"
              SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}
            >
              <MenuItem value="">
                <em>Not set</em>
              </MenuItem>
              {TIME_SLOTS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Shift end"
              value={shiftEnd}
              onChange={(e) => onChange({ ...value, shiftEnd: e.target.value })}
              size="small"
              SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}
            >
              <MenuItem value="">
                <em>Not set</em>
              </MenuItem>
              {TIME_SLOTS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onChange({ ...value, shiftStart: '', shiftEnd: '' })}>Clear</Button>
          <Button
            variant="contained"
            onClick={() => {
              const nextBreaks = Object.fromEntries(
                BREAKS.map((b) => {
                  const valid = new Set(
                    breakWindowSlots(shiftStart, shiftEnd, b.durationMins, b.key).map((s) => s.value)
                  );
                  const current = breakTimings?.[b.key]?.start;
                  return [b.key, { start: valid.has(current) ? current : '' }];
                })
              );
              onChange({ ...value, breakTimings: nextBreaks });
              setShiftOpen(false);
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}