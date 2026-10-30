import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { endOfDay, format, formatDistanceToNow, startOfDay } from 'date-fns';
import TimelineIcon from '@mui/icons-material/Timeline';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PlaceIcon from '@mui/icons-material/Place';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import NotesIcon from '@mui/icons-material/Notes';
import DownloadIcon from '@mui/icons-material/Download';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import api from '../services/api';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import InitialsAvatar from '../components/InitialsAvatar';
import FilterBar from '../components/FilterBar';
import { DateRangeFilter } from '../components/DatePickers';
import { TableEmpty, TableFooterBar, TableSpinner } from '../components/TableStates';
import { usePageSize } from '../hooks/usePageSize';
import { brand, tintForString } from '../theme/theme';
import { exportRowsToCsv } from '../utils/exportCsv';
import { useOrgTz } from '../hooks/useOrgTz';
import { activityMessage, earlyMinutes } from '../utils/activityText';


const TYPES = [
  { key: 'punch_in', label: 'Punch in', icon: <LoginIcon fontSize="small" /> },
  { key: 'punch_out', label: 'Punch out', icon: <LogoutIcon fontSize="small" /> },
  { key: 'break_start', label: 'Break start', icon: <LocalCafeIcon fontSize="small" /> },
  { key: 'break_end', label: 'Break end', icon: <LocalCafeIcon fontSize="small" /> },
  { key: 'location', label: 'Location', icon: <PlaceIcon fontSize="small" /> },
  { key: 'task_update', label: 'Task update', icon: <EditNoteIcon fontSize="small" /> },
  { key: 'selfie', label: 'Selfie', icon: <PhotoCameraIcon fontSize="small" /> },
  { key: 'leave_request', label: 'Leave request', icon: <BeachAccessIcon fontSize="small" /> },
  { key: 'other', label: 'Other', icon: <NotesIcon fontSize="small" /> },
];
const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.key, t]));
const FILTER_TYPES = TYPES.filter((t) => t.key !== 'location' && t.key !== 'selfie');

export default function ActivitiesPage() {
  const { fz, todayIn, ctxTz } = useOrgTz();
  const live = useSelector((s) => s.live.events);
  const isAllOrgs = !!useSelector((s) => s.auth.orgOverride?.allOrgs);
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('activities', 10);
  const [loading, setLoading] = useState(true);


  const [range, setRange] = useState(() => ({ from: todayIn(), to: todayIn() }));
  const [dateTouched, setDateTouched] = useState(false);
  const [type, setType] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [counts, setCounts] = useState(null);
  const [preview, setPreview] = useState(null);


  useEffect(() => {
    if (!dateTouched) setRange({ from: todayIn(), to: todayIn() });

  }, [ctxTz, dateTouched]);


  const dayRange = useMemo(() => {
    const r = {};
    if (range.from) r.from = range.from;
    if (range.to) r.to = range.to;
    return r;
  }, [range.from, range.to]);
  const date = `${range.from}|${range.to}`; 

  async function load() {
    setLoading(true);
    try {
      const params = { page, limit: pageSize, ...dayRange };
      if (type) params.type = type;
      if (employeeId) params.employeeId = employeeId;
      const { data } = await api.get('/activities', { params });
      setRows(data.data.items);
      setTotal(data.data.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadCounts() {
    const base = { ...dayRange };
    if (employeeId) base.employeeId = employeeId;
    try {

      const { data } = await api.get('/activities/counts', { params: base });
      setCounts(data.data);
    } catch {
      setCounts(null);
    }
  }

  useEffect(() => {
    api
      .get('/employees', { params: { limit: 1000, fields: 'name,employeeId' } })
      .then((r) => setEmployees(r.data.data.items))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    load();

  }, [page, pageSize, date, type, employeeId]);


  useEffect(() => {
    loadCounts();

  }, [date, employeeId]);

  useEffect(() => {
    setPage(1);
  }, [date, type, employeeId]);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage(1);
  }

  const liveEvents = live.filter((e) => e.kind === 'activity').slice(0, 4);

  function exportCsv() {
    exportRowsToCsv(
      `activities-${range.from || 'all'}${range.to && range.to !== range.from ? `_to_${range.to}` : ''}-page-${page}.csv`,
      [
        { label: 'Time', value: (r) => (r.timestamp ? fz(r.timestamp, 'yyyy-MM-dd HH:mm', r) : '') },
        { label: 'Employee', value: (r) => r.employeeId?.name },
        { label: 'Code', value: (r) => r.employeeId?.employeeId },
        { label: 'Type', value: (r) => TYPE_MAP[r.activityType]?.label || r.activityType },
        { label: 'Message', value: (r) => activityMessage(r) },
        {
          label: 'Location',
          value: (r) => (r.location ? `${r.location.lat}, ${r.location.lng}` : ''),
        },
      ],
      rows
    );
  }

  return (
    <Box>
      <PageHeader
        title="Activity monitoring"
        subtitle="Every action employees log through the Telegram bot"
        actions={
          <>
            <DateRangeFilter
              from={range.from}
              to={range.to}
              emptyMeans="all"
              onChange={(r) => {
                setDateTouched(true);
                setRange(r);
              }}
            />
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={rows.length === 0}>
              Export
            </Button>
          </>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
        }}
      >
        <StatCard
          icon={<TimelineIcon />}
          iconBg={brand.blueSoft}
          iconFg={brand.blue600}
          accent={brand.blue600}
          title="Total activities"
          value={counts?.total ?? '—'}
          sub={
            range.from && range.to
              ? range.from === range.to
                ? format(new Date(`${range.from}T00:00:00`), 'EEEE, MMM d')
                : `${format(new Date(`${range.from}T00:00:00`), 'MMM d')} – ${format(new Date(`${range.to}T00:00:00`), 'MMM d, yyyy')}`
              : 'All dates'
          }
          loading={!counts}
          onClick={() => { const p = new URLSearchParams(); if (dayRange.from) p.set('from', dayRange.from); if (dayRange.to) p.set('to', dayRange.to); if (employeeId) p.set('employeeId', employeeId); navigate(`/details/activities?${p}`); }}
        />
        <StatCard
          icon={<LoginIcon />}
          iconBg={brand.greenSoft}
          iconFg={brand.green}
          accent={brand.green}
          title="Punch ins"
          value={counts?.punchIn ?? '—'}
          sub="Shift starts logged"
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ type: 'punch_in' }); if (dayRange.from) p.set('from', dayRange.from); if (dayRange.to) p.set('to', dayRange.to); if (employeeId) p.set('employeeId', employeeId); navigate(`/details/activities?${p}`); }}
        />
        <StatCard
          icon={<LogoutIcon />}
          iconBg={brand.redSoft}
          iconFg={brand.red}
          accent={brand.red}
          title="Punch outs"
          value={counts?.punchOut ?? '—'}
          sub="Shift ends logged"
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ type: 'punch_out' }); if (dayRange.from) p.set('from', dayRange.from); if (dayRange.to) p.set('to', dayRange.to); if (employeeId) p.set('employeeId', employeeId); navigate(`/details/activities?${p}`); }}
        />
        <StatCard
          icon={<LocalCafeIcon />}
          iconBg={brand.orangeSoft}
          iconFg={brand.orange}
          accent={brand.orange}
          title="Breaks started"
          value={counts?.breaks ?? '—'}
          sub="Break start events"
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ type: 'break_start' }); if (dayRange.from) p.set('from', dayRange.from); if (dayRange.to) p.set('to', dayRange.to); if (employeeId) p.set('employeeId', employeeId); navigate(`/details/activities?${p}`); }}
        />
        <StatCard
          icon={<EditNoteIcon />}
          iconBg={brand.purpleSoft}
          iconFg={brand.purple}
          accent={brand.purple}
          title="Task updates"
          value={counts?.tasks ?? '—'}
          sub="Notes sent by employees"
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ type: 'task_update' }); if (dayRange.from) p.set('from', dayRange.from); if (dayRange.to) p.set('to', dayRange.to); if (employeeId) p.set('employeeId', employeeId); navigate(`/details/activities?${p}`); }}
        />
      </Box>

      {liveEvents.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, borderColor: brand.blue400 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <FiberManualRecordIcon sx={{ fontSize: 10, color: brand.green }} />
            <Typography variant="subtitle2">Live</Typography>
            <Typography variant="caption" color="text.secondary">
              streaming from the bot
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {liveEvents.map((e) => (
              <Typography variant="body2" key={e.id}>
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {TYPE_MAP[e.payload?.activityType]?.label || 'Activity'}
                </Box>
                {' — '}
                {e.payload?.employeeName || e.payload?.employeeId?.name || 'employee'}
                <Typography component="span" variant="caption" color="text.secondary">
                  {' '}
                  at {fz(e.payload?.timestamp || e.at, 'HH:mm:ss', e.payload?.organizationId)}
                </Typography>
              </Typography>
            ))}
          </Box>
        </Paper>
      )}

      <FilterBar>
        <TextField
          select
          size="small"
          label="Activity type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          sx={{ minWidth: 190 }}
        >
          <MenuItem value="">All types</MenuItem>
          {FILTER_TYPES.map((t) => (
            <MenuItem key={t.key} value={t.key}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Employee"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          sx={{ minWidth: 210 }}
        >
          <MenuItem value="">All employees</MenuItem>
          {employees.map((e) => (
            <MenuItem key={e._id} value={e._id}>
              {e.name}
            </MenuItem>
          ))}
        </TextField>
      </FilterBar>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Employee</TableCell>
                {isAllOrgs && <TableCell>Company</TableCell>}
                <TableCell>Type</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Proof</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={isAllOrgs ? 7 : 6} />
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={isAllOrgs ? 7 : 6}
                  icon={<TimelineIcon />}
                  title="No activity logged for this day"
                  hint="Try another date, or clear the type and employee filters."
                />
              ) : (
                rows.map((r) => {
                  const t = TYPE_MAP[r.activityType];
                  const tint = tintForString(r.activityType || '');
                  return (
                    <TableRow key={r._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                          {r.timestamp ? fz(r.timestamp, 'hh:mm a', r) : '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                          {r.timestamp
                            ? formatDistanceToNow(new Date(r.timestamp), { addSuffix: true })
                            : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <InitialsAvatar name={r.employeeId?.name} size={32} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {r.employeeId?.name || 'Unknown'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                              {r.employeeId?.employeeId || ''}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      {isAllOrgs && (
                        <TableCell>
                          <Chip
                            size="small"
                            label={r.employeeId?.organizationId?.name || '—'}
                            sx={{ bgcolor: brand.slate100, color: 'text.secondary' }}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip
                          size="small"
                          icon={t?.icon}
                          label={t?.label || r.activityType}
                          sx={{
                            bgcolor: tint.bg,
                            color: tint.fg,
                            '& .MuiChip-icon': { color: `${tint.fg} !important`, fontSize: 15 },
                          }}
                        />
                        {earlyMinutes(r) > 0 && (
                          <Chip size="small" label={`Early ${earlyMinutes(r)}m`} sx={{ ml: 0.75, bgcolor: brand.redSoft, color: brand.red, height: 22 }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Tooltip title={activityMessage(r) || ''}>
                          <Typography variant="body2" noWrap>
                            {activityMessage(r) || <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {r.location?.lat != null ? (
                          <Tooltip title={`${r.location.lat}, ${r.location.lng}`}>
                            <Box
                              component="a"
                              href={`https://www.google.com/maps?q=${r.location.lat},${r.location.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                color: 'primary.main',
                                textDecoration: 'none',
                              }}
                            >
                              <PlaceIcon sx={{ fontSize: 16 }} />
                              <Typography variant="caption" fontWeight={600}>
                                Map
                              </Typography>
                            </Box>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.image ? (
                          <Box
                            onClick={() => setPreview(r.image)}
                            sx={{
                              width: 46,
                              height: 46,
                              borderRadius: '10px',
                              overflow: 'hidden',
                              border: '1px solid',
                              borderColor: 'divider',
                              cursor: 'pointer',
                              transition: 'transform .15s ease',
                              '&:hover': { transform: 'scale(1.06)' },
                            }}
                          >
                            <Box
                              component="img"
                              src={r.image}
                              alt="Activity proof"
                              loading="lazy"
                              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TableFooterBar
          page={page}
          pageSize={pageSize}
          total={total}
          noun="activities"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>

      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md">
        <DialogContent sx={{ p: 0, lineHeight: 0 }}>
          {preview && (
            <Box
              component="img"
              src={preview}
              alt="Activity proof"
              sx={{ display: 'block', maxWidth: '100%', maxHeight: '80vh' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}