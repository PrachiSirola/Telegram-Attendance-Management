import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
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
import { format } from 'date-fns';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LogoutIcon from '@mui/icons-material/Logout';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import EditIcon from '@mui/icons-material/Edit';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PlaceIcon from '@mui/icons-material/Place';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CloseIcon from '@mui/icons-material/Close';
import api from '../services/api';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import StatusChip from '../components/StatusChip';
import InitialsAvatar from '../components/InitialsAvatar';
import FilterBar from '../components/FilterBar';
import { DateRangeFilter, DateTimeInput } from '../components/DatePickers';
import { TableEmpty, TableFooterBar, TableSpinner } from '../components/TableStates';
import { usePageSize } from '../hooks/usePageSize';
import { brand } from '../theme/theme';
import { exportRowsToCsv } from '../utils/exportCsv';
import { useOrgTz } from '../hooks/useOrgTz';

function truncateWords(text, n = 5) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length <= n) return words.join(' ');
  return `${words.slice(0, n).join(' ')}...`;
}

const STATUSES = ['present', 'absent', 'late', 'half_day', 'on_leave', 'pending', 'day_off'];
const STATUS_LABEL = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  half_day: 'Half day',
  on_leave: 'On leave',
  pending: 'Pending',
  day_off: 'Day off',
};

const emptyFilters = { from: '', to: '', employeeId: '', status: '' };

const OFF_TYPE_LABEL = { weekly_off: 'Weekly Off', festival: 'Holiday', other: 'Day Off' };

function buildDisplayRows(rows, offDays) {
  const off = offDays.map((o) => ({ __offDay: true, key: 'off-' + o._id, time: new Date(o.date).getTime(), offDay: o }));
  const recs = rows.map((r) => ({ __offDay: false, key: r._id, time: r.date ? new Date(r.date).getTime() : 0, row: r }));
  const all = [...off, ...recs];
  return all.sort((a, b) => b.time - a.time || (b.__offDay ? 1 : 0) - (a.__offDay ? 1 : 0));
}

function offDayScopeText(o) {
  if (o.scope === 'department') return o.departments?.length ? `Department: ${o.departments.join(', ')}` : '';
  if (o.scope === 'employee') return o.employees?.length ? `Employees: ${o.employees.join(', ')}` : '';
  return '';
}

export default function AttendancePage() {
  const { fz, tzFor, toIso, todayIn } = useOrgTz();
  const navigate = useNavigate();
  const isAllOrgs = !!useSelector((s) => s.auth.orgOverride?.allOrgs);
  const [rows, setRows] = useState([]);
  const [offDays, setOffDays] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('attendance', 10);
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState([]);
  const todayStr = todayIn();
  const [filters, setFilters] = useState(() => ({ ...emptyFilters, from: todayStr, to: todayStr }));
  const defaultDay = useRef(todayStr);
  useEffect(() => {
    if (defaultDay.current === todayStr) return;
    const prev = defaultDay.current;
    defaultDay.current = todayStr;
    setFilters((f) => (f.from === prev && f.to === prev ? { ...f, from: todayStr, to: todayStr } : f));
  }, [todayStr]);
  const [counts, setCounts] = useState(null);

  const [correct, setCorrect] = useState(null);
  const [correctForm, setCorrectForm] = useState({});
  const [shiftStart, setShiftStart] = useState(null);
  const [shiftEnd, setShiftEnd] = useState(null);
  const [correctInitial, setCorrectInitial] = useState({ punchIn: '', punchOut: '' });
  const [correctError, setCorrectError] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);

  const [menuRow, setMenuRow] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [proofRow, setProofRow] = useState(null);
  const [fullNote, setFullNote] = useState(null); 

  const [markOpen, setMarkOpen] = useState(false);
  const [markEmployee, setMarkEmployee] = useState('');
  const [markError, setMarkError] = useState('');
  const [markLoading, setMarkLoading] = useState('');
  const [toast, setToast] = useState('');
  const [confirmPunchOut, setConfirmPunchOut] = useState(false);
  const [confirmPunchIn, setConfirmPunchIn] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = { page, limit: pageSize, groupOffDays: true, liveAbsent: true };
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.employeeId) params.employeeId = filters.employeeId;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/attendance', { params });
      setRows(data.data.items);
      setOffDays(data.data.offDays || []);
      setTotal(data.data.total);
    } catch {
      setRows([]);
      setOffDays([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadCounts() {
    const base = { excludeOffDays: true, liveAbsent: true };
    if (filters.from) base.from = filters.from;
    if (filters.to) base.to = filters.to;
    if (filters.employeeId) base.employeeId = filters.employeeId;
    try {
      const { data } = await api.get('/attendance/counts', { params: base });
      setCounts(data.data);
    } catch {
      setCounts(null);
    }
  }

  useEffect(() => {
    api
      .get('/employees', { params: { limit: 1000, active: true, fields: 'name,employeeId,department' } })
      .then((r) => setEmployees(r.data.data.items))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    load();

  }, [page, pageSize, filters]);


  useEffect(() => {
    loadCounts();

  }, [filters.from, filters.to, filters.employeeId]);

  useEffect(() => {
    setPage(1);
  }, [filters.from, filters.to, filters.employeeId, filters.status]);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage(1);
  }

  function openCorrect(row) {
    setMenuAnchor(null);
    if (!row) return;
    setCorrectError('');
    setCorrect(row);
    const initIn = row.punchIn ? fz(row.punchIn, "yyyy-MM-dd'T'HH:mm", row) : '';
    const initOut = row.punchOut ? fz(row.punchOut, "yyyy-MM-dd'T'HH:mm", row) : '';
    setCorrectInitial({ punchIn: initIn, punchOut: initOut });
    setShiftStart(null);
    setShiftEnd(null);
    api
      .get(`/attendance/${row._id}/shift`)
      .then((r) => {
        setShiftStart(r.data.data.shiftStart || null);
        setShiftEnd(r.data.data.shiftEnd || null);
      })
      .catch(() => {
        setShiftStart(null);
        setShiftEnd(null);
      });
    setCorrectForm({
      punchIn: initIn,
      punchOut: initOut,
      status: row.status || 'present',
      lateMinutes: row.lateMinutes ?? 0,
      earlyLeaveMinutes: row.earlyLeaveMinutes ?? 0,
      overtime: row.overtime ?? 0,
      notes: row.notes || '',
    });
  }


  const wallMs = (w) => {
    const [d, t = '00:00'] = String(w).split('T');
    const [y, mo, da] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    return Date.UTC(y, mo - 1, da, h, mi);
  };
  const keepLateStatus = (status, late) => (['present', 'late'].includes(status) ? (late > 0 ? 'late' : 'present') : status);


  const shiftEndMs = (refWall) => {
    if (!shiftEnd || !refWall) return null;
    const day = refWall.slice(0, 10);
    const end = wallMs(`${day}T${shiftEnd}`);
    const overnight = shiftStart && wallMs(`${day}T${shiftEnd}`) <= wallMs(`${day}T${shiftStart}`);
    return overnight ? end + 86400000 : end;
  };
  const earlyFor = (inWall, outWall) => {
    const end = shiftEndMs(inWall || outWall);
    return end == null || !outWall ? 0 : Math.max(0, Math.round((end - wallMs(outWall)) / 60000));
  };


  function changePunchOut(v) {
    setCorrectForm((f) => ({ ...f, punchOut: v, earlyLeaveMinutes: v && shiftEnd ? earlyFor(f.punchIn, v) : v ? f.earlyLeaveMinutes : 0 }));
  }


  function changeEarly(raw) {
    setCorrectForm((f) => {
      const next = { ...f, earlyLeaveMinutes: raw };
      const n = raw === '' ? 0 : Number(raw);
      const end = shiftEndMs(f.punchIn || f.punchOut);
      if (end != null && Number.isFinite(n) && n >= 0 && (f.punchOut || n > 0)) {
        next.punchOut = new Date(end - Math.round(n) * 60000).toISOString().slice(0, 16);
      }
      return next;
    });
  }


  function changePunchIn(v) {
    setCorrectForm((f) => {
      const next = { ...f, punchIn: v };
      if (v && f.punchOut && shiftEnd) next.earlyLeaveMinutes = earlyFor(v, f.punchOut);
      if (v && shiftStart) {
        const late = Math.max(0, Math.round((wallMs(v) - wallMs(`${v.slice(0, 10)}T${shiftStart}`)) / 60000));
        next.lateMinutes = late;
        next.status = keepLateStatus(f.status, late);
      }
      return next;
    });
  }


  function changeLate(raw) {
    setCorrectForm((f) => {
      const next = { ...f, lateMinutes: raw };
      const n = raw === '' ? 0 : Number(raw);
      if (f.punchIn && shiftStart && Number.isFinite(n) && n >= 0) {
        const late = Math.round(n);
        next.punchIn = new Date(wallMs(`${f.punchIn.slice(0, 10)}T${shiftStart}`) + late * 60000).toISOString().slice(0, 16);
        next.status = keepLateStatus(f.status, late);
      }
      return next;
    });
  }

  async function saveCorrect() {
    setSavingCorrection(true);
    setCorrectError('');
    try {
      await api.patch(`/attendance/${correct._id}/correct`, {
        ...(correctForm.punchIn !== correctInitial.punchIn && {
          punchIn: correctForm.punchIn ? toIso(correctForm.punchIn, correct) : null,
        }),
        ...(correctForm.punchOut !== correctInitial.punchOut && {
          punchOut: correctForm.punchOut ? toIso(correctForm.punchOut, correct) : null,
        }),
        status: correctForm.status,
        lateMinutes: Number(correctForm.lateMinutes) || 0,
        earlyLeaveMinutes: Number(correctForm.earlyLeaveMinutes) || 0,
        overtime: Number(correctForm.overtime) || 0,
        notes: correctForm.notes,
      });
      setCorrect(null);
      setToast('Attendance record updated');
      await Promise.all([load(), loadCounts()]);
    } catch (e) {
      setCorrectError(e.response?.data?.message || e.message || 'Could not save correction');
    } finally {
      setSavingCorrection(false);
    }
  }

  async function markPunch(kind) {
    setMarkError('');
    setMarkLoading(kind);
    try {
      await api.post(`/attendance/${kind}`, { employeeId: markEmployee });
      setMarkOpen(false);
      setMarkEmployee('');
      setToast(kind === 'punch-in' ? 'Punch-in recorded' : 'Punch-out recorded');
      await Promise.all([load(), loadCounts()]);
    } catch (e) {
      setMarkError(e.response?.data?.message || e.message || 'Could not record punch');
    } finally {
      setMarkLoading('');
    }
  }

  function exportCsv() {
    exportRowsToCsv(
      `attendance-page-${page}.csv`,
      [
        { label: 'Date', value: (r) => (r.date ? fz(r.date, 'yyyy-MM-dd', r) : '') },
        { label: 'Employee', value: (r) => r.employeeId?.name },
        { label: 'Code', value: (r) => r.employeeId?.employeeId },
        { label: 'Department', value: (r) => r.employeeId?.department },
        { label: 'In', value: (r) => (r.punchIn ? fz(r.punchIn, 'HH:mm', r) : '') },
        { label: 'Out', value: (r) => (r.punchOut ? fz(r.punchOut, 'HH:mm', r) : '') },
        { label: 'Hours', value: (r) => r.totalHours },
        { label: 'Late (min)', value: (r) => r.lateMinutes },
        { label: 'Early leave (min)', value: (r) => r.earlyLeaveMinutes || 0 },
        { label: 'Overtime (h)', value: (r) => r.overtime },
        { label: 'Status', value: (r) => STATUS_LABEL[r.status] || r.status },
        { label: 'Notes', value: (r) => r.notes || '' },
      ],
      rows
    );
  }

  const isTodayOnly = filters.from === todayStr && filters.to === todayStr;

  const filtersActive = !(isTodayOnly && !filters.employeeId && !filters.status);
  const anyFilterSet = !!(filters.from || filters.to || filters.employeeId || filters.status);

  return (
    <Box>
      <PageHeader
        title="Attendance"
        subtitle="Monitor and correct daily attendance records"
        actions={
          <>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={rows.length === 0}>
              Export
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setMarkOpen(true)}>
              Mark attendance
            </Button>
          </>
        }
      />

      <FilterBar>
        <DateRangeFilter
          from={filters.from}
          to={filters.to}
          onChange={({ from, to }) => setFilters({ ...filters, from, to })}
        />
        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          options={employees}
          getOptionLabel={(e) => e.name || ''}
          isOptionEqualToValue={(a, b) => a._id === b._id}
          value={employees.find((e) => e._id === filters.employeeId) || null}
          onChange={(_, value) => setFilters({ ...filters, employeeId: value?._id || '' })}
          renderInput={(params) => <TextField {...params} label="Employee" placeholder="Search employees…" />}
        />
        <TextField
          select
          label="Status"
          size="small"
          sx={{ minWidth: 155 }}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <MenuItem value="">All status</MenuItem>
          {STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </MenuItem>
          ))}
        </TextField>
        {filtersActive && (
          <Button size="small" startIcon={<RestartAltIcon />} onClick={() => setFilters({ ...emptyFilters, from: todayStr, to: todayStr })}>
            Reset
          </Button>
        )}
      </FilterBar>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
        }}
      >
        <StatCard
          icon={<PeopleAltIcon />}
          iconBg={brand.blueSoft}
          iconFg={brand.blue600}
          accent={brand.blue600}
          title="Records"
          value={counts?.total ?? '—'}
          sub={!filtersActive ? 'Today' : anyFilterSet ? 'Matching your filters' : 'All time'}
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ category: 'all', match: 'counts' }); if (filters.from) p.set('from', filters.from); if (filters.to) p.set('to', filters.to); if (filters.employeeId) p.set('employeeId', filters.employeeId); navigate(`/details/attendance?${p}`); }}
        />
        <StatCard
          icon={<CheckCircleIcon />}
          iconBg={brand.greenSoft}
          iconFg={brand.green}
          accent={brand.green}
          title="Present"
          value={counts?.present ?? '—'}
          sub={counts?.total ? `${Math.round((counts.present / counts.total) * 100)}% of records` : ''}
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ category: 'present', match: 'counts' }); if (filters.from) p.set('from', filters.from); if (filters.to) p.set('to', filters.to); if (filters.employeeId) p.set('employeeId', filters.employeeId); navigate(`/details/attendance?${p}`); }}
        />
        <StatCard
          icon={<EventBusyIcon />}
          iconBg={brand.redSoft}
          iconFg={brand.red}
          accent={brand.red}
          title="Absent"
          value={counts?.absent ?? '—'}
          sub={counts?.total ? `${Math.round((counts.absent / counts.total) * 100)}% of records` : ''}
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ category: 'absent', match: 'counts' }); if (filters.from) p.set('from', filters.from); if (filters.to) p.set('to', filters.to); if (filters.employeeId) p.set('employeeId', filters.employeeId); navigate(`/details/attendance?${p}`); }}
        />
        <StatCard
          icon={<AccessTimeIcon />}
          iconBg={brand.orangeSoft}
          iconFg={brand.orange}
          accent={brand.orange}
          title="Late"
          value={counts?.late ?? '—'}
          sub={counts?.total ? `${Math.round((counts.late / counts.total) * 100)}% of records` : ''}
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ category: 'late', match: 'counts' }); if (filters.from) p.set('from', filters.from); if (filters.to) p.set('to', filters.to); if (filters.employeeId) p.set('employeeId', filters.employeeId); navigate(`/details/attendance?${p}`); }}
        />
        <StatCard
          icon={<LogoutIcon />}
          iconBg={brand.redSoft}
          iconFg={brand.red}
          accent={brand.red}
          title="Early punch-out"
          value={counts?.earlyLeave ?? '—'}
          sub={counts?.total ? `${Math.round(((counts.earlyLeave || 0) / counts.total) * 100)}% of records` : ''}
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ category: 'earlyLeave', match: 'counts' }); if (filters.from) p.set('from', filters.from); if (filters.to) p.set('to', filters.to); if (filters.employeeId) p.set('employeeId', filters.employeeId); navigate(`/details/attendance?${p}`); }}
        />
      </Box>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Employee</TableCell>
                {isAllOrgs && <TableCell>Company</TableCell>}
                <TableCell>In time</TableCell>
                <TableCell>Out time</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={isAllOrgs ? 9 : 8} />
              ) : rows.length === 0 && offDays.length === 0 ? (
                <TableEmpty
                  colSpan={isAllOrgs ? 9 : 8}
                  icon={<EventAvailableIcon />}
                  title="No attendance records match these filters"
                  hint="Punches arrive automatically when employees use the Telegram bot."
                />
              ) : (
                buildDisplayRows(rows, offDays).map((item) => {
                  if (item.__offDay) {
                    const o = item.offDay;
                    const typeText = OFF_TYPE_LABEL[o.type] || 'Day Off';
                    const scopeText = offDayScopeText(o);
                    return (
                      <TableRow key={item.key} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                            {fz(o.date, 'dd MMM yyyy', o)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {fz(o.date, 'EEEE', o)}
                          </Typography>
                        </TableCell>
                        <TableCell colSpan={isAllOrgs ? 8 : 7}>
                          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                            <StatusChip status="day_off" label={o.label} />
                            {o.label !== typeText && (
                              <Typography variant="body2" color="text.secondary">
                                {typeText}
                              </Typography>
                            )}
                            {scopeText && (
                              <Typography variant="body2" color="text.secondary">
                                · {scopeText}
                              </Typography>
                            )}
                            {isAllOrgs && o.organizationName && (
                              <Chip size="small" label={o.organizationName} sx={{ bgcolor: brand.slate100, color: 'text.secondary' }} />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  const r = item.row;
                  return (
                  <TableRow key={r._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                        {r.date ? fz(r.date, 'dd MMM yyyy', r) : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {r.date ? fz(r.date, 'EEEE', r) : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <InitialsAvatar name={r.employeeId?.name} size={34} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {r.employeeId?.name || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {[r.employeeId?.employeeId, r.employeeId?.department]
                              .filter(Boolean)
                              .join(' · ') || '—'}
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
                      {r.punchIn ? (
                        <>
                          <Typography variant="body2" whiteSpace="nowrap">
                            {fz(r.punchIn, 'hh:mm a', r)}
                          </Typography>
                          {r.lateMinutes > 0 ? (
                            <Chip
                              size="small"
                              label={`Late ${r.lateMinutes}m`}
                              sx={{ mt: 0.25, bgcolor: brand.orangeSoft, color: '#C9720A', height: 20 }}
                            />
                          ) : (
                            <Typography variant="caption" color="success.main">
                              On time
                            </Typography>
                          )}
                        </>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                      {r.punchInLocation && (
                        <Tooltip
                          title={`${r.punchInLocation.lat.toFixed(5)}, ${r.punchInLocation.lng.toFixed(5)}`}
                        >
                          <PlaceIcon sx={{ fontSize: 13, color: 'text.disabled', ml: 0.5 }} />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.punchOut ? (
                        <Typography variant="body2" whiteSpace="nowrap">
                          {fz(r.punchOut, 'hh:mm a', r)}
                        </Typography>
                      ) : r.punchIn ? (
                        <StatusChip status="yet_to_checkout" />
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                      {r.punchOut && r.earlyLeaveMinutes > 0 && (
                        <Chip
                          size="small"
                          label={`Early ${r.earlyLeaveMinutes}m`}
                          sx={{ mt: 0.25, bgcolor: brand.redSoft, color: brand.red, height: 20 }}
                        />
                      )}
                      {r.overtime > 0 && (
                        <Typography variant="caption" color="secondary.main" display="block">
                          +{r.overtime}h overtime
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                        {r.totalHours ? `${r.totalHours}h` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={r.status} />
                      {r.virtual && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                          Not punched in yet
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      {r.notes ? (
                        <Typography
                          variant="body2"
                          onClick={() => setFullNote(r)}
                          sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {truncateWords(r.notes)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {/* A live "not punched in yet" row has no record to correct. */}
                      {!r.virtual && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setMenuRow(r);
                            setMenuAnchor(e.currentTarget);
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
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
          noun="records"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setProofRow(menuRow);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <VerifiedUserIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View punch-in proof</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openCorrect(menuRow)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Correct record</ListItemText>
        </MenuItem>
      </Menu>

      {/* Punch-in proof */}
      <Dialog open={!!proofRow} onClose={() => setProofRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Punch-in proof
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
            {proofRow?.employeeId?.name}
            {proofRow?.date ? ` · ${fz(proofRow.date, 'dd MMM yyyy', proofRow)}` : ''}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {!proofRow?.punchIn ? (
            <Alert severity="info">No punch-in recorded for this day.</Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {proofRow.selfieImage ? (
                <Box
                  component="img"
                  src={proofRow.selfieImage}
                  alt="Punch-in selfie"
                  sx={{
                    width: '100%',
                    maxHeight: 260,
                    objectFit: 'cover',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    py: 4,
                    textAlign: 'center',
                    bgcolor: brand.slate100,
                    borderRadius: '12px',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No selfie captured for this punch-in
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Punch-in time</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {fz(proofRow.punchIn, 'dd MMM yyyy, hh:mm a', proofRow)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">IP address</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {proofRow.ipAddress || 'Not available'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Location</Typography>
                  {proofRow.punchInLocation ? (
                    <Typography variant="body2" fontWeight={600}>
                      <Box
                        component="a"
                        href={`https://www.google.com/maps?q=${proofRow.punchInLocation.lat},${proofRow.punchInLocation.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ color: 'primary.main', textDecoration: 'none' }}
                      >
                        View on map
                      </Box>
                    </Typography>
                  ) : (
                    <Typography variant="body2" fontWeight={600}>Not captured</Typography>
                  )}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Office geofence</Typography>
                  <Box sx={{ mt: 0.25 }}>
                    {proofRow.withinGeofence === true && (
                      <Chip size="small" label="Within range" sx={{ bgcolor: brand.greenSoft, color: brand.green }} />
                    )}
                    {proofRow.withinGeofence === false && (
                      <Chip size="small" label="Outside range" sx={{ bgcolor: brand.redSoft, color: brand.red }} />
                    )}
                    {proofRow.withinGeofence == null && (
                      <Chip size="small" label="Not checked" sx={{ bgcolor: brand.slate100, color: 'text.secondary' }} />
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProofRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Correction dialog */}
      <Dialog open={!!correct} onClose={() => !savingCorrection && setCorrect(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          Correct attendance
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
            {correct?.employeeId?.name}
            {correct?.date ? ` · ${fz(correct.date, 'dd MMM yyyy', correct)}` : ''}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {correctError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCorrectError('')}>
              {correctError}
            </Alert>
          )}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              mt: 1,
            }}
          >
            <DateTimeInput
              fullWidth
              label="Punch in"
              helperText={`Time zone: ${tzFor(correct)}`}
              value={correctForm.punchIn || ''}
              onChange={changePunchIn}
            />
            <DateTimeInput
              fullWidth
              label="Punch out"
              value={correctForm.punchOut || ''}
              onChange={changePunchOut}
            />
            <TextField
              select
              label="Status"
              size="small"
              value={correctForm.status || ''}
              onChange={(e) => setCorrectForm({ ...correctForm, status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Late minutes"
              type="number"
              size="small"
              value={correctForm.lateMinutes ?? ''}
              inputProps={{ min: 0 }}
              onChange={(e) => changeLate(e.target.value)}
            />
            <TextField
              label="Early leave (min)"
              type="number"
              size="small"
              value={correctForm.earlyLeaveMinutes ?? ''}
              inputProps={{ min: 0 }}
              onChange={(e) => changeEarly(e.target.value)}
            />
            <TextField
              label="Overtime (hours)"
              type="number"
              size="small"
              value={correctForm.overtime ?? ''}
              onChange={(e) => setCorrectForm({ ...correctForm, overtime: e.target.value })}
            />
            <TextField
              label="Notes"
              size="small"
              value={correctForm.notes || ''}
              onChange={(e) => setCorrectForm({ ...correctForm, notes: e.target.value })}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCorrect(null)} disabled={savingCorrection}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={saveCorrect}
            disabled={savingCorrection}
            startIcon={savingCorrection ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {savingCorrection ? 'Saving…' : 'Save correction'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark attendance */}
      <Dialog open={markOpen} onClose={() => !markLoading && setMarkOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Mark attendance</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {markError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMarkError('')}>
              {markError}
            </Alert>
          )}
          <TextField
            select
            fullWidth
            label="Employee"
            size="small"
            sx={{ mt: 1 }}
            value={markEmployee}
            onChange={(e) => setMarkEmployee(e.target.value)}
          >
            {employees.map((e) => (
              <MenuItem key={e._id} value={e._id}>
                {e.name}
                {e.department ? ` — ${e.department}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
            Records today&apos;s punch for the selected employee, exactly as the Telegram bot would.
            Late minutes and worked hours are calculated automatically.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarkOpen(false)} disabled={!!markLoading}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            disabled={!markEmployee || !!markLoading}
            onClick={() => setConfirmPunchOut(true)}
            startIcon={markLoading === 'punch-out' ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {markLoading === 'punch-out' ? 'Recording…' : 'Punch out'}
          </Button>
          <Button
            variant="contained"
            disabled={!markEmployee || !!markLoading}
            onClick={() => setConfirmPunchIn(true)}
            startIcon={markLoading === 'punch-in' ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ color: '#FFFFFF', '&.Mui-disabled': { color: '#FFFFFF' } }}
          >
            {markLoading === 'punch-in' ? 'Recording…' : 'Punch in'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm punch in — same prompt as punch out; no selfie / location is requested. */}
      <Dialog open={confirmPunchIn} onClose={() => setConfirmPunchIn(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1">Are you sure you want to punch in?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmPunchIn(false)} disabled={!!markLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirmPunchIn(false);
              markPunch('punch-in');
            }}
            disabled={!!markLoading}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm punch out */}
      <Dialog open={confirmPunchOut} onClose={() => setConfirmPunchOut(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1">Are you sure you want to punch out?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmPunchOut(false)} disabled={!!markLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirmPunchOut(false);
              markPunch('punch-out');
            }}
            disabled={!!markLoading}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!fullNote} onClose={() => setFullNote(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {fullNote?.employeeId?.name || 'Unknown'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {fullNote?.date ? fz(fullNote.date, 'dd MMM yyyy', fullNote) : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setFullNote(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {fullNote?.notes}
          </Typography>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToast('')} sx={{ width: '100%' }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}