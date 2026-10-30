import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Popover,
  TextField,
  Typography,
} from '@mui/material';
import { addDays, addMonths, format, startOfMonth, subMonths, subYears } from 'date-fns';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useOrgTz } from '../hooks/useOrgTz';
import { brand, shadow } from '../theme/theme';

const parseDay = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const toDay = (d) => format(d, 'yyyy-MM-dd');

export const isSundayKey = (key) => {
  const d = parseDay(key);
  return !!d && d.getDay() === 0;
};
const pretty = (s) => (s ? format(parseDay(s), 'dd MMM yyyy') : '');
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];


function Calendar({ start, end, hover, today, min, max, isDateDisabled, onPick, onHover, focusDay }) {
  const [month, setMonth] = useState(() => startOfMonth(parseDay(focusDay || start || end || today) || new Date()));
  const first = startOfMonth(month);
  const gridStart = addDays(first, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const previewEnd = !end && start && hover && hover > start ? hover : end;

  const navSx = {
    width: 32,
    height: 32,
    borderRadius: '10px',
    border: '1px solid',
    borderColor: brand.slate200,
    color: brand.slate700,
    '&:hover': { bgcolor: brand.blueSofter, borderColor: brand.slate300 },
  };

  return (
    <Box sx={{ width: 280, maxWidth: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <IconButton size="small" sx={navSx} onClick={() => setMonth(subMonths(month, 1))} aria-label="Previous month">
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: brand.ink }}>
          {format(month, 'MMMM yyyy')}
        </Typography>
        <IconButton size="small" sx={navSx} onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 0.5, justifyItems: 'center' }}>
        {WEEKDAYS.map((w) => (
          <Typography key={w} variant="caption" sx={{ color: brand.slate500, fontWeight: 600, height: 28, lineHeight: '28px' }}>
            {w}
          </Typography>
        ))}
        {cells.map((d) => {
          const key = toDay(d);
          const outside = d.getMonth() !== month.getMonth();
          const isStart = key === start;
          const isEnd = key === end;
          const selected = isStart || isEnd || (!end && key === previewEnd && previewEnd !== start);
          const inRange = !!start && !!previewEnd && key > start && key < previewEnd;
          const disabled = (min && key < min) || (max && key > max) || !!(isDateDisabled && isDateDisabled(key));
          return (
            <Box
              key={key}
              component="button"
              type="button"
              disabled={!!disabled}
              aria-label={format(d, 'EEEE, d MMMM yyyy')}
              aria-pressed={selected}
              onClick={() => onPick(key)}
              onMouseEnter={() => onHover && onHover(key)}
              sx={{
                width: 36,
                height: 36,
                p: 0,
                border: 0,
                borderRadius: '10px',
                font: 'inherit',
                fontSize: '0.875rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                bgcolor: selected ? brand.blue600 : inRange ? brand.blueSoft : 'transparent',
                color: selected ? '#fff' : outside ? brand.slate400 : brand.ink,
                fontWeight: selected ? 700 : 500,
                opacity: disabled ? 0.3 : outside && !selected ? 0.7 : 1,
                filter: disabled ? 'blur(0.3px)' : 'none',
                boxShadow: key === today && !selected ? `inset 0 0 0 1.5px ${brand.blue600}` : 'none',
                '&:hover': disabled ? {} : { bgcolor: selected ? brand.blue700 : brand.slate100 },
                '&:focus-visible': { outline: `2px solid ${brand.blue400}`, outlineOffset: 1 },
              }}
            >
              {d.getDate()}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

const paperSx = {
  mt: 0.75,
  p: 2,
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100dvh - 32px)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  borderRadius: '14px',
  border: '1px solid',
  borderColor: brand.slate200,
  boxShadow: shadow.lg,
};


function PickerField({ label, value, placeholder, onOpen, size = 'small', sx, helperText, disabled, fullWidth }) {
  return (
    <TextField
      label={label}
      value={value}
      size={size}
      fullWidth={fullWidth}
      placeholder={placeholder}
      helperText={helperText}
      disabled={disabled}
      onClick={(e) => !disabled && onOpen(e.currentTarget)}
      InputLabelProps={{ shrink: true }}
      InputProps={{
        readOnly: true,
        startAdornment: (
          <InputAdornment position="start">
            <CalendarMonthOutlinedIcon sx={{ color: brand.blue600, fontSize: 19 }} />
          </InputAdornment>
        ),
      }}
      inputProps={{
        style: { cursor: disabled ? 'default' : 'pointer' },
        onKeyDown: (e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            onOpen(e.currentTarget.closest('.MuiInputBase-root') || e.currentTarget);
          }
        },
      }}
      sx={{ width: fullWidth ? undefined : 180, maxWidth: '100%', bgcolor: '#fff', borderRadius: '10px', ...sx }}
    />
  );
}

export function DateRangeInput({
  start,
  end,
  onChange, 
  startLabel = 'Start',
  endLabel = 'End',
  minDate,
  maxDate,
  size = 'small',
  sx,
  fieldSx,
  disabled,
  inGrid = false, 
  tzRef, 
}) {
  const { todayIn } = useOrgTz();
  const [anchor, setAnchor] = useState(null);
  const [step, setStep] = useState('start'); 
  const [hover, setHover] = useState('');
  const open = Boolean(anchor);

  const openAt = (el, which) => {
    setStep(which === 'end' && start ? 'end' : 'start');
    setHover('');
    setAnchor(el);
  };

  function pick(day) {
    if (step === 'start' || !start) {
      onChange({ start: day, end: end && end >= day ? end : '' });
      setStep('end');
    } else if (day < start) {
      onChange({ start: day, end: '' });
    } else {
      onChange({ start, end: day });
      setAnchor(null);
    }
  }

 
  const endMin = step === 'end' && start ? (minDate && minDate > start ? minDate : start) : minDate;

  const startField = (
    <PickerField
      label={startLabel}
      placeholder="Select date"
      value={pretty(start)}
      size={size}
      disabled={disabled}
      fullWidth={inGrid}
      sx={fieldSx}
      onOpen={(el) => openAt(el, 'start')}
    />
  );
  const endField = (
    <PickerField
      label={endLabel}
      placeholder="Select date"
      value={pretty(end)}
      size={size}
      disabled={disabled}
      fullWidth={inGrid}
      sx={fieldSx}
      onOpen={(el) => openAt(el, 'end')}
    />
  );
  const popover = (
    <Popover
      open={open}
      anchorEl={anchor}
      onClose={() => setAnchor(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: paperSx } }}
    >
      <Calendar
        start={start}
        end={end}
        hover={step === 'end' ? hover : ''}
        today={todayIn(tzRef)}
        min={endMin}
        max={maxDate}
        onPick={pick}
        onHover={setHover}
      />
    </Popover>
  );


  if (inGrid) {
    return (
      <>
        {startField}
        {endField}
        {popover}
      </>
    );
  }
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', maxWidth: '100%', ...sx }}>
      {startField}
      <Typography variant="body2" sx={{ color: brand.slate500 }}>
        to
      </Typography>
      {endField}
      {popover}
    </Box>
  );
}


export function DateInput({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  isDateDisabled,
  size = 'small',
  sx,
  helperText,
  disabled,
  fullWidth,
}) {
  const { todayIn } = useOrgTz();
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <PickerField
        label={label}
        placeholder="Select date"
        value={pretty(value)}
        size={size}
        sx={sx}
        helperText={helperText}
        disabled={disabled}
        fullWidth={fullWidth}
        onOpen={setAnchor}
      />
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: paperSx } }}
      >
        <Calendar
          start={value}
          end=""
          today={todayIn()}
          min={minDate}
          max={maxDate}
          isDateDisabled={isDateDisabled}
          onPick={(day) => {
            onChange(day);
            setAnchor(null);
          }}
        />
      </Popover>
    </>
  );
}


const pad2 = (n) => String(n).padStart(2, '0');

const WHEEL_ITEM_H = 36;
const WHEEL_ROWS = 5; 

function WheelColumn({ items, selected, onSelect, label, width = 72, disabled }) {
  const ref = useRef(null);
  const lock = useRef(false); 
  const lockTimer = useRef(null);
  const drag = useRef(null);
  const clamp = (i) => Math.max(0, Math.min(items.length - 1, i));

  const moveTo = (idx, smooth) => {
    const el = ref.current;
    if (!el) return;
    lock.current = true;
    clearTimeout(lockTimer.current);
    el.scrollTo({ top: idx * WHEEL_ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
    lockTimer.current = setTimeout(() => (lock.current = false), smooth ? 350 : 60);
  };

  
  useEffect(() => {
    const el = ref.current;
    if (!el || drag.current) return;
    if (Math.round(el.scrollTop / WHEEL_ITEM_H) !== selected) moveTo(selected, false);

  }, [selected, items.length]);
  useEffect(() => () => clearTimeout(lockTimer.current), []);

  const onScroll = () => {
    if (lock.current || disabled) return;
    const idx = clamp(Math.round(ref.current.scrollTop / WHEEL_ITEM_H));
    if (idx !== selected) onSelect(idx);
  };

  const onPointerDown = (e) => {
    if (disabled || e.pointerType === 'touch') return; 
    drag.current = { y: e.clientY, top: ref.current.scrollTop, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.abs(e.clientY - d.y) <= 3) return; 
      d.moved = true;
      ref.current.style.scrollSnapType = 'none';
      ref.current.setPointerCapture?.(e.pointerId);
    }
    ref.current.scrollTop = d.top - (e.clientY - d.y);
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved) {
      drag.current = null;
      return;
    }
    ref.current.style.scrollSnapType = '';
    const idx = clamp(Math.round(ref.current.scrollTop / WHEEL_ITEM_H));
    setTimeout(() => (drag.current = null), 0);
    moveTo(idx, true);
    if (idx !== selected) onSelect(idx);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
    if (step) {
      e.preventDefault();
      const idx = clamp(selected + step);
      onSelect(idx);
      moveTo(idx, true);
    }
  };

  return (
    <Box
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onScroll={onScroll}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      sx={{
        position: 'relative',
        zIndex: 1,
        width,
        height: WHEEL_ITEM_H * WHEEL_ROWS,
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        outline: 'none',
        cursor: disabled ? 'default' : 'grab',
        userSelect: 'none',
        opacity: disabled ? 0.45 : 1,
        py: `${WHEEL_ITEM_H * Math.floor(WHEEL_ROWS / 2)}px`,
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent)',
        maskImage: 'linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent)',
        '&:focus-visible': { boxShadow: `0 0 0 2px ${brand.blue600}33`, borderRadius: '10px' },
      }}
    >
      {items.map((text, i) => (
        <Box
          key={text}
          role="option"
          aria-selected={i === selected}
          onClick={() => {
            if (disabled || drag.current?.moved) return;
            onSelect(i);
            moveTo(i, true);
          }}
          sx={{
            height: WHEEL_ITEM_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            scrollSnapAlign: 'center',
            fontSize: i === selected ? 18 : 15,
            fontWeight: i === selected ? 700 : 500,
            fontVariantNumeric: 'tabular-nums',
            color: i === selected ? brand.blue600 : brand.slate500,
            transition: 'color .12s, font-size .12s',
          }}
        >
          {text}
        </Box>
      ))}
    </Box>
  );
}

const HOUR_ITEMS = Array.from({ length: 12 }, (_, i) => pad2(i + 1)); 
const MIN_ITEMS = Array.from({ length: 60 }, (_, i) => pad2(i)); 
const AMPM_ITEMS = ['AM', 'PM'];

export function DateTimeInput({ label, value, onChange, size = 'small', sx, helperText, disabled, fullWidth }) {
  const { todayIn } = useOrgTz();
  const [anchor, setAnchor] = useState(null);
  const day = value ? String(value).slice(0, 10) : '';
  const time = value && String(value).length >= 16 ? String(value).slice(11, 16) : '';

  const h24 = time ? Number(time.slice(0, 2)) : 9;
  const min = time ? Number(time.slice(3, 5)) : 0;
  const isPm = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const emit = (d, h, m) => onChange(`${d}T${pad2(h)}:${pad2(m)}`);
  const setHour12 = (h) => emit(day, (h % 12) + (isPm ? 12 : 0), min);
  const setMinute = (m) => emit(day, h24, m);
  const setAmPm = (pm) => emit(day, (h24 % 12) + (pm ? 12 : 0), min);

  const shown = day ? `${pretty(day)}, ${pad2(h24)}:${pad2(min)}` : '';

  return (
    <>
      <PickerField
        label={label}
        placeholder="Select date & time"
        value={shown}
        size={size}
        sx={sx}
        helperText={helperText}
        disabled={disabled}
        fullWidth={fullWidth}
        onOpen={setAnchor}
      />
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: paperSx } }}
      >
        <Calendar
          start={day}
          end=""
          today={todayIn()}
          onPick={(d) => emit(d, h24, min)}
        />
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: brand.slate200 }}>
          <Typography variant="body2" sx={{ color: brand.slate500, mb: 0.5 }}>
            Time
          </Typography>
          <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '50%',
                height: WHEEL_ITEM_H,
                transform: 'translateY(-50%)',
                borderRadius: '10px',
                bgcolor: brand.blueSoft,
              }}
            />
            <WheelColumn label="Hour" items={HOUR_ITEMS} selected={h12 - 1} onSelect={(i) => setHour12(i + 1)} disabled={!day} />
            <Typography fontWeight={700} sx={{ position: 'relative', zIndex: 1, color: brand.slate500 }}>:</Typography>
            <WheelColumn label="Minute" items={MIN_ITEMS} selected={min} onSelect={setMinute} disabled={!day} />
            <WheelColumn label="AM or PM" items={AMPM_ITEMS} selected={isPm ? 1 : 0} onSelect={(i) => setAmPm(i === 1)} disabled={!day} width={64} />
          </Box>
          {!day && (
            <Typography variant="caption" sx={{ color: brand.slate500 }}>
              Pick a date first
            </Typography>
          )}
        </Box>
        {/* Sticky so Clear / Done stay visible when the picker has to scroll on short screens. */}
        <Box
          sx={{
            mt: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            position: 'sticky',
            bottom: 0,
            zIndex: 2,
            bgcolor: 'background.paper',
            mx: -2,
            px: 2,
            mb: -2,
            pb: 2,
            pt: 0.5,
          }}
        >
          <Button
            size="small"
            disabled={!value}
            onClick={() => {
              onChange('');
              setAnchor(null);
            }}
          >
            Clear
          </Button>
          <Button size="small" variant="contained" onClick={() => setAnchor(null)}>
            Done
          </Button>
        </Box>
      </Popover>
    </>
  );
}


export const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'last24', label: 'Last 24 Hours' },
  { key: 'last3', label: 'Last 3 Days' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'month', label: 'Last 1 Month' },
  { key: 'year', label: 'Last 1 Year' },
  { key: 'custom', label: 'Custom Range' },
  { key: 'all', label: 'All Time' },
];

export function presetRange(key, todayStr) {
  const t = parseDay(todayStr);
  switch (key) {
    case 'today':
      return { from: todayStr, to: todayStr };
    case 'last24': 
      return { from: toDay(addDays(t, -1)), to: todayStr };
    case 'last3':
      return { from: toDay(addDays(t, -2)), to: todayStr };
    case 'last7':
      return { from: toDay(addDays(t, -6)), to: todayStr };
    case 'month':
      return { from: toDay(subMonths(t, 1)), to: todayStr };
    case 'year':
      return { from: toDay(subYears(t, 1)), to: todayStr };
    default:
      return null;
  }
}

function inferPreset(from, to, todayStr, emptyMeans) {
  if (!from && !to) return emptyMeans === 'today' ? 'today' : 'all';
  if (!from || !to) return 'custom';
  const hit = ['today', 'last24', 'last3', 'last7', 'month', 'year'].find((k) => {
    const r = presetRange(k, todayStr);
    return r.from === from && r.to === to;
  });

  return hit && !(emptyMeans === 'today' && hit === 'today') ? hit : 'custom';
}

export function DateRangeFilter({ from, to, onChange, emptyMeans = 'all', sx, tzRef }) {
  const { todayIn } = useOrgTz();
  const todayStr = todayIn(tzRef);
  const [customMode, setCustomMode] = useState(false);
  const lastEmit = useRef(`${from}|${to}`);


  useEffect(() => {
    if (`${from}|${to}` !== lastEmit.current) setCustomMode(false);
  }, [from, to]);

  const emit = (r) => {
    lastEmit.current = `${r.from}|${r.to}`;
    onChange(r);
  };

  const value = customMode ? 'custom' : inferPreset(from, to, todayStr, emptyMeans);
  const presets = DATE_PRESETS.filter((p) => !(emptyMeans === 'today' && p.key === 'all'));
  const label = presets.find((p) => p.key === value)?.label || 'Custom Range';

  function choose(key) {
    if (key === 'custom') {
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    if (key === 'all') return emit({ from: '', to: '' });
    if (key === 'today' && emptyMeans === 'today') return emit({ from: '', to: '' });
    emit(presetRange(key, todayStr));
  }

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', ...sx }}>
      <TextField
        select
        size="small"
        label="Date filter"
        value={value}
        onChange={(e) => choose(e.target.value)}
        InputLabelProps={{ shrink: true }}
        SelectProps={{
          renderValue: () => label,
          MenuProps: { slotProps: { paper: { sx: { mt: 0.75, borderRadius: '14px', border: '1px solid', borderColor: brand.slate200, boxShadow: shadow.lg, minWidth: 200 } } } },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <FilterAltOutlinedIcon sx={{ color: brand.blue600, fontSize: 19 }} />
            </InputAdornment>
          ),
        }}
        sx={{ minWidth: 190, bgcolor: '#fff', borderRadius: '10px' }}
      >
        {presets.map((p) => (
          <MenuItem key={p.key} value={p.key} sx={{ gap: 1.25, fontWeight: p.key === value ? 700 : 500 }}>
            <CheckIcon sx={{ fontSize: 18, color: brand.blue600, visibility: p.key === value ? 'visible' : 'hidden' }} />
            {p.label}
          </MenuItem>
        ))}
      </TextField>

      {value === 'custom' && (
        <DateRangeInput start={from} end={to} tzRef={tzRef} onChange={({ start, end }) => emit({ from: start, to: end })} />
      )}
    </Box>
  );
}
