import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  CircularProgress,
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
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimerIcon from '@mui/icons-material/Timer';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import EditNoteIcon from '@mui/icons-material/EditNote';
import TimelineIcon from '@mui/icons-material/Timeline';
import TelegramIcon from '@mui/icons-material/Telegram';
import api from '../services/api';
import { setOrgOverride } from '../redux/slices/authSlice';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusChip from '../components/StatusChip';
import InitialsAvatar from '../components/InitialsAvatar';
import { TableEmpty, TableSpinner } from '../components/TableStates';
import { DateRangeFilter, presetRange } from '../components/DatePickers';
import { brand } from '../theme/theme';
import { formatShiftTiming, to12h } from '../utils/time';
import { formatBalance } from '../utils/leave';
import { useOrgTz } from '../hooks/useOrgTz';


const ATT_PAGE = 31;
const LEAVE_PAGE = 20;
const ACT_PAGE = 50;

export default function EmployeeProfilePage() {
  const { fz, fd, tzFor, todayIn } = useOrgTz();
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const fromAllOrgs = !!location.state?.fromAllOrgs;

  function goBackToEmployees() {
    if (fromAllOrgs) {
      dispatch(setOrgOverride({ id: 'ALL', name: 'All Companies', slug: null, active: true, allOrgs: true }));
    }
    navigate('/employees');
  }


  const [rangeSel, setRangeSel] = useState(() => presetRange('last7', todayIn()));
  const touchedRange = useRef(false);

  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [totals, setTotals] = useState({ attendance: 0, leaves: 0, activities: 0 });
  const [loadingMore, setLoadingMore] = useState({ attendance: false, leaves: false, activities: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null); 
  const rangeTz = tzFor(employee);
  useEffect(() => {
    if (!touchedRange.current) setRangeSel(presetRange('last7', todayIn(employee)));
  }, [rangeTz]);

  const range = useMemo(() => {
    if (!rangeSel.from && !rangeSel.to) return { from: '', to: '' };
    if (!rangeSel.from || !rangeSel.to) return null;
    return { from: rangeSel.from, to: rangeSel.to };
  }, [rangeSel, rangeTz]);

  const epoch = useRef(0);

  useEffect(() => {
    if (!range) {
      setLoading(false);
      return;
    }
    const mine = ++epoch.current;
    const isStale = () => epoch.current !== mine;
    setLoading(true);
    setError('');
    setLoadingMore({ attendance: false, leaves: false, activities: false });
    (async () => {
      try {

        const [empRes, sumRes, attRes, leaveRes, actRes] = await Promise.allSettled([
          api.get(`/employees/${employeeId}`),
          api.get(`/employees/${employeeId}/summary`, { params: { from: range.from, to: range.to } }),
          api.get('/attendance', { params: { employeeId, from: range.from, to: range.to, page: 1, limit: ATT_PAGE } }),
          api.get('/leaves', { params: { employeeId, from: range.from, to: range.to, page: 1, limit: LEAVE_PAGE } }),
          api.get('/activities', { params: { employeeId, from: range.from, to: range.to, page: 1, limit: ACT_PAGE } }),
        ]);
        if (isStale()) return;
        const failed = [empRes, sumRes, attRes, leaveRes, actRes].find((r) => r.status === 'rejected');
        if (failed) throw failed.reason;
        setEmployee(empRes.value.data.data);
        setSummary(sumRes.value.data.data);
        const att = attRes.value.data.data;
        const lv = leaveRes.value.data.data;
        const ac = actRes.value.data.data;
        setAttendance(att.items || []);
        setLeaves(lv.items || []);
        setActivities(ac.items || []);
        setTotals({ attendance: att.total || 0, leaves: lv.total || 0, activities: ac.total || 0 });
      } catch (e) {
        if (!isStale()) {
          setEmployee(null);
          setError(
            e.response?.status === 404
              ? "This employee wasn't found in the organization currently being viewed."
              : e.response?.data?.message || 'Could not load employee details'
          );
        }
      } finally {
        if (!isStale()) setLoading(false);
      }
    })();
    return () => {

      if (epoch.current === mine) epoch.current += 1;
    };

  }, [employeeId, range?.from, range?.to]);


  async function loadMore(kind) {
    if (!range || loadingMore[kind]) return;
    const mine = epoch.current;
    const cfg = {
      attendance: { url: '/attendance', size: ATT_PAGE, list: attendance, set: setAttendance },
      leaves: { url: '/leaves', size: LEAVE_PAGE, list: leaves, set: setLeaves },
      activities: { url: '/activities', size: ACT_PAGE, list: activities, set: setActivities },
    }[kind];
    const page = Math.floor(cfg.list.length / cfg.size) + 1;
    setLoadingMore((m) => ({ ...m, [kind]: true }));
    try {
      const { data } = await api.get(cfg.url, {
        params: { employeeId, from: range.from, to: range.to, page, limit: cfg.size },
      });
      if (epoch.current !== mine) return;
      const next = data.data.items || [];

      cfg.set((cur) => {
        const seen = new Set(cur.map((r) => r._id));
        return [...cur, ...next.filter((r) => !seen.has(r._id))];
      });
      setTotals((t) => ({ ...t, [kind]: data.data.total ?? t[kind] }));
    } catch (e) {
      if (epoch.current === mine) setError(e.response?.data?.message || 'Could not load more records');
    } finally {
      if (epoch.current === mine) setLoadingMore((m) => ({ ...m, [kind]: false }));
    }
  }

  const breakPairs = useMemo(() => pairBreaks(summary?.breaks || []), [summary]);

  const stats = useMemo(
    () => ({
      present: summary?.present ?? 0,
      absent: summary?.absent ?? 0,
      onLeave: summary?.onLeave ?? 0,
      late: summary?.late ?? 0,
      overtimeCount: summary?.overtimeCount ?? 0,
      totalHours: summary?.totalHours ?? 0,
      overtimeHours: summary?.overtimeHours ?? 0,
      tasks: summary?.tasks ?? 0,
      activities: summary?.activities ?? 0,
    }),
    [summary]
  );

  if (error) {
    return (
      <Box>
        <Button
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={goBackToEmployees}
          sx={{ mb: 1, color: 'text.secondary', pl: 0.5, '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }}
        >
          Back to employees
        </Button>
        <PageHeader title="Employee details" />
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        size="small"
        startIcon={<ArrowBackIcon fontSize="small" />}
        onClick={goBackToEmployees}
        sx={{ mb: 1, color: 'text.secondary', pl: 0.5, '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }}
      >
        Back to employees
      </Button>
      <PageHeader
        title={loading ? 'Loading…' : employee?.name || 'Employee'}
        subtitle={
          !loading && employee
            ? [employee.employeeId, employee.department, employee.role, employee.organizationId?.name]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      />

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <DateRangeFilter
          from={rangeSel.from}
          to={rangeSel.to}
          emptyMeans="all"
          tzRef={employee}
          onChange={(r) => {
            touchedRange.current = true;
            setRangeSel(r);
          }}
        />
      </Paper>

      {!range && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Pick a start and end date to view records for that range.
        </Alert>
      )}

      {/* Profile card */}
      <Paper sx={{ p: 2.5, mb: 2 }}>
        {loading ? (
          <Box sx={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <InitialsAvatar name={employee?.name} src={employee?.profilePhoto} size={64} />
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="h6" fontWeight={700}>
                {employee?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {employee?.email || employee?.phone || '—'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <StatusChip status={employee?.active ? 'active' : 'inactive'} />
                {employee?.telegramId ? (
                  <Chip size="small" icon={<TelegramIcon sx={{ fontSize: 15 }} />} label="Telegram linked" sx={{ bgcolor: brand.blueSoft, color: brand.blue600 }} />
                ) : (
                  <StatusChip status="pending" />
                )}
              </Box>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, minWidth: 260 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Shift</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatShiftTiming(employee?.shiftTiming) || 'Not set'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Casual Leave</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatBalance(employee?.clBalance, employee?.clTotal)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Sick Leave</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatBalance(employee?.slBalance, employee?.slTotal)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Joined</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {employee?.createdAt ? fz(employee.createdAt, 'dd MMM yyyy', employee) : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Breaks</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {['morning', 'lunch', 'evening']
                    .filter((k) => employee?.breakTimings?.[k]?.start)
                    .map((k) => to12h(employee.breakTimings[k].start))
                    .join(', ') || 'Not set'}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Stat cards — all clickable except Total hours */}
      <Box sx={{ display: 'grid', gap: 2, mb: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
        <StatCard icon={<PeopleAltIcon />} iconBg={brand.blueSoft} iconFg={brand.blue600} accent={brand.blue600} title="Present days" value={stats.present} loading={loading} onClick={() => setDetail({ key: 'present', title: 'Present days' })} />
        <StatCard icon={<EventBusyIcon />} iconBg={brand.redSoft} iconFg={brand.red} accent={brand.red} title="Absent days" value={stats.absent} loading={loading} onClick={() => setDetail({ key: 'absent', title: 'Absent days' })} />
        <StatCard icon={<BeachAccessIcon />} iconBg={brand.purpleSoft} iconFg={brand.purple} accent={brand.purple} title="On leave" value={stats.onLeave} loading={loading} onClick={() => setDetail({ key: 'on_leave', title: 'On leave' })} />
        <StatCard icon={<AccessTimeIcon />} iconBg={brand.orangeSoft} iconFg={brand.orange} accent={brand.orange} title="Late days" value={stats.late} loading={loading} onClick={() => setDetail({ key: 'late', title: 'Late days' })} />
        <StatCard icon={<CheckCircleIcon />} iconBg={brand.greenSoft} iconFg={brand.green} accent={brand.green} title="Total hours" value={`${stats.totalHours}h`} loading={loading} />
        <StatCard icon={<TimerIcon />} iconBg={brand.tealSoft} iconFg={brand.teal} accent={brand.teal} title="Overtime" value={`${stats.overtimeHours}h`} sub={`${stats.overtimeCount} day${stats.overtimeCount === 1 ? '' : 's'}`} loading={loading} onClick={() => setDetail({ key: 'overtime', title: 'Overtime' })} />
        <StatCard icon={<EditNoteIcon />} iconBg={brand.pinkSoft} iconFg={brand.pink} accent={brand.pink} title="Tasks" value={stats.tasks} loading={loading} onClick={() => setDetail({ key: 'tasks', title: 'Task updates' })} />
        <StatCard icon={<TimelineIcon />} iconBg={brand.slate100} iconFg={brand.slate700} accent={brand.slate400} title="Activities" value={stats.activities} loading={loading} onClick={() => setDetail({ key: 'activities', title: 'All activity' })} />
      </Box>

      {/* Attendance */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ p: 2.25, pb: 1.5 }}>
          <Typography variant="subtitle1">Attendance</Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>In time</TableCell>
                <TableCell>Out time</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={5} />
              ) : attendance.length === 0 ? (
                <TableEmpty colSpan={5} icon={<EventAvailableIcon />} title="No attendance in this range" />
              ) : (
                attendance
                  .slice()
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((r) => (
                    <TableRow key={r._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                          {fz(r.date, 'dd MMM yyyy', r)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {r.punchIn ? (
                          <Typography variant="body2" whiteSpace="nowrap">{fz(r.punchIn, 'hh:mm a', r)}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.punchOut ? (
                          <Typography variant="body2" whiteSpace="nowrap">{fz(r.punchOut, 'hh:mm a', r)}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{r.totalHours ? `${r.totalHours}h` : '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={r.status} />
                        {r.status === 'on_leave' && r.notes && (
                          <Tooltip title={r.notes}>
                            <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ mt: 0.25, maxWidth: 200 }}>
                              {r.notes}
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <LoadMoreRow
          shown={attendance.length}
          total={totals.attendance}
          loading={loadingMore.attendance}
          hidden={loading}
          onClick={() => loadMore('attendance')}
        />
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, mb: 2 }}>
        {/* Breaks */}
        <Paper>
          <Box sx={{ p: 2.25, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalCafeIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1">Breaks</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Start</TableCell>
                  <TableCell>End</TableCell>
                  <TableCell>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableSpinner colSpan={3} />
                ) : breakPairs.length === 0 ? (
                  <TableEmpty colSpan={3} icon={<LocalCafeIcon />} title="No breaks in this range" />
                ) : (
                  breakPairs.map((b) => (
                    <TableRow key={b.id} hover>
                      <TableCell>
                        <Typography variant="body2" whiteSpace="nowrap">
                          {b.start ? fz(b.start, 'dd MMM, hh:mm a', employee) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {b.end ? (
                          <Typography variant="body2" whiteSpace="nowrap">{fz(b.end, 'dd MMM, hh:mm a', employee)}</Typography>
                        ) : (
                          <Chip size="small" label="Ongoing" sx={{ bgcolor: brand.orangeSoft, color: '#C9720A' }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {b.minutes != null ? `${b.minutes} min` : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Leaves */}
        <Paper>
          <Box sx={{ p: 2.25, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BeachAccessIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1">Leaves</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>From</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableSpinner colSpan={4} />
                ) : leaves.length === 0 ? (
                  <TableEmpty colSpan={4} icon={<BeachAccessIcon />} title="No leaves in this range" />
                ) : (
                  leaves.map((l) => (
                    <TableRow key={l._id} hover>
                      <TableCell><Typography variant="body2" whiteSpace="nowrap">{fd(l.startDate, 'dd MMM yyyy')}</Typography></TableCell>
                      <TableCell><Typography variant="body2" whiteSpace="nowrap">{fd(l.endDate, 'dd MMM yyyy')}</Typography></TableCell>
                      <TableCell sx={{ maxWidth: 160 }}>
                        <Tooltip title={l.reason || ''}>
                          <Typography variant="body2" noWrap>{l.reason || '—'}</Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell><StatusChip status={l.status} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <LoadMoreRow
          shown={leaves.length}
          total={totals.leaves}
          loading={loadingMore.leaves}
          hidden={loading}
          onClick={() => loadMore('leaves')}
        />
        </Paper>
      </Box>

      {/* Task updates / activities */}
      <Paper>
        <Box sx={{ p: 2.25, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditNoteIcon fontSize="small" color="primary" />
          <Typography variant="subtitle1">Task updates & activity</Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={3} />
              ) : activities.length === 0 ? (
                <TableEmpty colSpan={3} icon={<EditNoteIcon />} title="No activity in this range" />
              ) : (
                activities
                  .slice()
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .map((a) => (
                    <TableRow key={a._id} hover>
                      <TableCell>
                        <Typography variant="body2" whiteSpace="nowrap">{fz(a.timestamp, 'dd MMM, hh:mm a', a)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={a.activityType.replace('_', ' ')} sx={{ bgcolor: brand.slate100, color: 'text.secondary', textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Tooltip title={a.message || ''}>
                          <Typography variant="body2" noWrap>{a.message || '—'}</Typography>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <LoadMoreRow
          shown={activities.length}
          total={totals.activities}
          loading={loadingMore.activities}
          hidden={loading}
          onClick={() => loadMore('activities')}
        />
      </Paper>

      <DetailDialog
        detail={detail}
        onClose={() => setDetail(null)}
        employeeId={employeeId}
        range={range}
        leaves={leaves}
        activities={activities}
        totals={totals}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        shiftStart={employee?.shiftTiming ? formatShiftTiming(employee.shiftTiming).split(' – ')[0] : null}
      />
    </Box>
  );
}


function LoadMoreRow({ shown, total, loading, hidden, onClick }) {
  if (hidden || !total || shown >= total) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, p: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        Showing {shown} of {total}
      </Typography>
      <Button size="small" onClick={onClick} disabled={loading} startIcon={loading ? <CircularProgress size={14} /> : null}>
        Load more
      </Button>
    </Box>
  );
}

const DIALOG_PAGE = 50;
const DIALOG_QUERY = {
  present: { url: '/attendance', params: { status: 'present,late' } },
  absent: { url: '/attendance', params: { status: 'absent' } },
  late: { url: '/attendance', params: { late: 'true' } },
  overtime: { url: '/attendance', params: { hasOvertime: 'true' } },
  tasks: { url: '/activities', params: { type: 'task_update' } },
};


function useDialogRows(detail, employeeId, range) {
  const key = detail?.key;
  const spec = DIALOG_QUERY[key];
  const [state, setState] = useState({ key: null, rows: [], total: 0, loading: false });
  const token = useRef(0);
  const from = range?.from;
  const to = range?.to;

  async function fetchPage(page, base) {
    const mine = token.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data } = await api.get(spec.url, {
        params: { employeeId, from, to, page, limit: DIALOG_PAGE, ...spec.params },
      });
      if (token.current !== mine) return;
      const items = data.data.items || [];
      setState({ key, rows: [...base, ...items], total: data.data.total || 0, loading: false });
    } catch {
      if (token.current === mine) setState((s) => ({ ...s, key, loading: false }));
    }
  }

  useEffect(() => {
    token.current += 1;
    if (!spec) {
      setState({ key: null, rows: [], total: 0, loading: false });
      return undefined;
    }
    setState({ key, rows: [], total: 0, loading: true });
    fetchPage(1, []);
    return () => {
      token.current += 1;
    };

  }, [key, employeeId, from, to]);

  const current = state.key === key;
  return {
    rows: current ? state.rows : [],
    total: current ? state.total : 0,
    loading: state.loading,
    initial: !current || (state.loading && state.rows.length === 0),
    loadMore: () => !state.loading && fetchPage(Math.floor(state.rows.length / DIALOG_PAGE) + 1, state.rows),
  };
}


function pairBreaks(activities) {
  const sorted = [...activities]
    .filter((a) => a.activityType === 'break_start' || a.activityType === 'break_end')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const pairs = [];
  let openStart = null;
  sorted.forEach((a) => {
    if (a.activityType === 'break_start') {
      openStart = a;
    } else if (a.activityType === 'break_end') {
      if (openStart) {
        pairs.push({
          id: `${openStart._id}-${a._id}`,
          start: openStart.timestamp,
          end: a.timestamp,
          minutes: Math.round((new Date(a.timestamp) - new Date(openStart.timestamp)) / 60000),
        });
        openStart = null;
      } else {
        pairs.push({ id: a._id, start: null, end: a.timestamp, minutes: null });
      }
    }
  });
  if (openStart) {
    pairs.push({ id: openStart._id, start: openStart.timestamp, end: null, minutes: null });
  }
  return pairs.sort((a, b) => new Date(b.start || b.end) - new Date(a.start || a.end));
}

function DetailDialog({
  detail,
  onClose,
  employeeId,
  range,
  leaves,
  activities,
  totals,
  loadingMore,
  onLoadMore,
  shiftStart,
}) {
  const { fz, fd } = useOrgTz();
  const own = useDialogRows(detail, employeeId, range);
  const presentRows = own.rows;
  const absentRows = own.rows;
  const lateRows = own.rows;
  const overtimeRows = own.rows;
  const taskRows = own.rows;
  if (!detail) return null;

  let head = [];
  let rows = [];

  if (detail.key === 'present') {
    head = ['Date', 'In time', 'Out time', 'Hours', 'Status'];
    rows = presentRows
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((r) => [
        fz(r.date, 'dd MMM yyyy', r),
        r.punchIn ? fz(r.punchIn, 'hh:mm a', r) : '—',
        r.punchOut ? fz(r.punchOut, 'hh:mm a', r) : '—',
        r.totalHours ? `${r.totalHours}h` : '—',
        <StatusChip key="s" status={r.status} />,
      ]);
  } else if (detail.key === 'absent') {
    head = ['Date', 'Status'];
    rows = absentRows
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((r) => [fz(r.date, 'dd MMM yyyy', r), <StatusChip key="s" status={r.status} />]);
  } else if (detail.key === 'on_leave') {
    head = ['From', 'To', 'Reason', 'Status'];
    rows = leaves.map((l) => [
      fd(l.startDate, 'dd MMM yyyy'),
      fd(l.endDate, 'dd MMM yyyy'),
      l.reason || '—',
      <StatusChip key="s" status={l.status} />,
    ]);
  } else if (detail.key === 'late') {
    head = ['Date', 'Punch-in', 'Expected', 'Delay'];
    rows = lateRows
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((r) => [
        fz(r.date, 'dd MMM yyyy', r),
        r.punchIn ? fz(r.punchIn, 'hh:mm a', r) : '—',
        shiftStart || '—',
        `${r.lateMinutes} min`,
      ]);
  } else if (detail.key === 'overtime') {
    head = ['Date', 'Overtime'];
    rows = overtimeRows
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((r) => [fz(r.date, 'dd MMM yyyy', r), `${r.overtime}h`]);
  } else if (detail.key === 'tasks') {
    head = ['Date & time', 'Message'];
    rows = taskRows
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map((a) => [fz(a.timestamp, 'dd MMM yyyy, hh:mm a', a), a.message || '—']);
  } else if (detail.key === 'activities') {
    head = ['Date & time', 'Type', 'Message'];
    rows = activities
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map((a) => [
        fz(a.timestamp, 'dd MMM yyyy, hh:mm a', a),
        <Chip key="t" size="small" label={a.activityType.replace('_', ' ')} sx={{ bgcolor: brand.slate100, color: 'text.secondary', textTransform: 'capitalize' }} />,
        a.message || '—',
      ]);
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {detail.title}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {head.map((h) => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && own.initial ? (
                <TableSpinner colSpan={head.length} />
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={head.length} title={`No ${detail.title.toLowerCase()} in this range`} />
              ) : (
                rows.map((row, i) => (

                  <TableRow key={i} hover>
                    {row.map((cell, j) => (

                      <TableCell key={j}>
                        {typeof cell === 'string' ? <Typography variant="body2">{cell}</Typography> : cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {detail.key === 'on_leave' ? (
          <LoadMoreRow shown={leaves.length} total={totals.leaves} loading={loadingMore.leaves} onClick={() => onLoadMore('leaves')} />
        ) : detail.key === 'activities' ? (
          <LoadMoreRow shown={activities.length} total={totals.activities} loading={loadingMore.activities} onClick={() => onLoadMore('activities')} />
        ) : (
          <LoadMoreRow shown={own.rows.length} total={own.total} loading={own.loading} hidden={own.initial} onClick={own.loadMore} />
        )}
      </DialogContent>
    </Dialog>
  );
}