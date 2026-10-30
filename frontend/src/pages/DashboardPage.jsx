import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isAfter,
  startOfDay,
} from 'date-fns';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import EditNoteIcon from '@mui/icons-material/EditNote';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import PlaceIcon from '@mui/icons-material/Place';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import NotesIcon from '@mui/icons-material/Notes';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import api from '../services/api';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import InitialsAvatar from '../components/InitialsAvatar';
import { DateRangeFilter } from '../components/DatePickers';
import EmptyState from '../components/EmptyState';
import { brand, shadow } from '../theme/theme';
import { toZonedWall } from '../utils/tz';
import { useOrgTz } from '../hooks/useOrgTz';
import { activityMessage, earlyMinutes } from '../utils/activityText';

const ACTIVITY_ICON = {
  punch_in: <LoginIcon fontSize="small" />,
  punch_out: <LogoutIcon fontSize="small" />,
  break_start: <LocalCafeIcon fontSize="small" />,
  break_end: <LocalCafeIcon fontSize="small" />,
  leave_request: <BeachAccessIcon fontSize="small" />,
  task_update: <EditNoteIcon fontSize="small" />,
  location: <PlaceIcon fontSize="small" />,
  selfie: <PhotoCameraIcon fontSize="small" />,
  other: <NotesIcon fontSize="small" />,
};

const ACTIVITY_LABEL = {
  punch_in: 'Punch in',
  punch_out: 'Punch out',
  break_start: 'Break start',
  break_end: 'Break end',
  location: 'Location',
  task_update: 'Task update',
  selfie: 'Selfie',
  leave_request: 'Leave request',
  other: 'Activity',
};

export default function DashboardPage() {
  const { fz, fd, todayIn, ctxTz } = useOrgTz();
  const navigate = useNavigate();
  const admin = useSelector((s) => s.auth.admin);
  const isSuperAdmin = admin?.role === 'super_admin';
  const [orgCount, setOrgCount] = useState(null); 
  const showCreateOrgBanner = isSuperAdmin && orgCount === 0;
  const [summary, setSummary] = useState(null);
  const [report, setReport] = useState(null);
  const [activities, setActivities] = useState([]);
  const [leavesRaw, setLeavesRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: '', to: '' });

  useEffect(() => {
    if (!isSuperAdmin) return;
    api
      .get('/organizations')
      .then((r) => setOrgCount(Array.isArray(r.data.data) ? r.data.data.length : 0))
      .catch(() => setOrgCount(null));
  }, [isSuperAdmin]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const dateParams = {};
        if (filters.from) dateParams.from = filters.from;
        if (filters.to) dateParams.to = filters.to;
        const hasCustomRange = !!(filters.from || filters.to);
        const [dash, rep, acts, leavesRes] = await Promise.all([
          api.get('/dashboard/summary', { params: dateParams }),
          api.get('/reports/summary', { params: hasCustomRange ? dateParams : { period: 'monthly' } }),
          api.get('/activities', { params: { limit: 6 } }),
          api.get('/leaves', { params: { status: 'approved', limit: 40 } }),
        ]);
        if (cancelled) return;
        setSummary(dash.data.data);
        setReport(rep.data.data);
        setActivities(acts.data.data?.items || []);
        setLeavesRaw(leavesRes.data.data?.items || []);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters]);
  const leaves = useMemo(
    () =>
      leavesRaw
        .filter((l) => fd(l.endDate, 'yyyy-MM-dd') >= todayIn(l))
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        .slice(0, 5),
    [leavesRaw, fd, todayIn]
  );
  const trend = useMemo(() => {
    if (!report?.trend || !report?.range) return [];
    const start = startOfDay(toZonedWall(new Date(report.range.start), ctxTz));
    const end = startOfDay(toZonedWall(new Date(report.range.end), ctxTz));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || isAfter(start, end)) {
      return [];
    }
    const buckets = new Map(
      eachDayOfInterval({ start, end }).map((d) => [
        format(d, 'yyyy-MM-dd'),
        { day: format(d, 'MMM d'), present: 0, late: 0 },
      ])
    );
    report.trend.forEach((t) => {
      const bucket = buckets.get(t.date);
      if (!bucket) return;
      bucket.present += t.present;
      bucket.late += t.late;
    });
    return [...buckets.values()];
  }, [report, ctxTz]);

  const donutData = useMemo(() => {
    if (!summary) return [];
    const onTime = Math.max(0, summary.presentToday - summary.lateToday);
    return [
      { name: 'On time', value: onTime, color: brand.green },
      { name: 'Late', value: summary.lateToday, color: brand.orange },
      { name: 'On leave', value: summary.onLeaveToday || 0, color: brand.blue600 },
      { name: 'Absent', value: summary.absentToday, color: brand.red },
    ].filter((d) => d.value > 0);
  }, [summary]);
  const attendanceRate =
    summary && summary.attendanceRate != null ? Math.round(summary.attendanceRate) : null;
  const isRange = !!(filters.from || filters.to);

  function goToDetails(category) {
    if (category === 'total') {
      navigate('/details/employees?filter=all');
      return;
    }
    const q = new URLSearchParams({ category });
    if (filters.from) q.set('from', filters.from);
    if (filters.to) q.set('to', filters.to);
    navigate(`/details/attendance?${q.toString()}`);
  }

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your organization"
        actions={
          <>
            <Chip
              icon={<CalendarMonthIcon sx={{ fontSize: 17 }} />}
              label={fz(new Date(), 'EEEE, MMMM d, yyyy')}
              sx={{
                bgcolor: '#fff',
                border: `1px solid ${brand.cardBorder}`,
                boxShadow: shadow.xs,
                fontWeight: 600,
                height: 38,
                borderRadius: '12px',
                '& .MuiChip-icon': { color: brand.slate700 },
              }}
            />
            <Button variant="contained" startIcon={<DescriptionOutlinedIcon fontSize="small" />} onClick={() => navigate('/reports')}>
              Generate report
            </Button>
          </>
        }
      />

      {showCreateOrgBanner && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" variant="outlined" onClick={() => navigate('/organizations')}>
              Create organization
            </Button>
          }
        >
          There are no organizations in the system yet. As Super Admin you have access to every organization —
          create your first one to get started managing it.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <DateRangeFilter
          emptyMeans="today"
          from={filters.from}
          to={filters.to}
          onChange={({ from, to }) => setFilters({ ...filters, from, to })}
        />
        {(filters.from || filters.to) && (
          <Button size="small" startIcon={<RestartAltIcon />} onClick={() => setFilters({ from: '', to: '' })}>
            Reset to today
          </Button>
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            xl: 'repeat(6, 1fr)',
          },
        }}
      >
        <StatCard
          icon={<PeopleAltIcon />}
          iconBg={brand.blueSoft}
          iconFg={brand.blue600}
          accent={brand.blue600}
          title="Total employees"
          value={summary?.totalEmployees ?? '—'}
          sub="Active on the roster"
          loading={loading}
          onClick={() => goToDetails('total')}
        />
        <StatCard
          icon={<CheckCircleIcon />}
          iconBg={brand.greenSoft}
          iconFg={brand.green}
          accent={brand.green}
          title="Present today"
          value={summary?.presentToday ?? '—'}
          sub={
            attendanceRate === null
              ? 'Punched in today'
              : `${attendanceRate}% of ${isRange ? 'eligible days' : 'the team'}`
          }
          loading={loading}
          onClick={() => goToDetails('present')}
        />
        {/* One card for Absent + On leave (they used to be two). Approved leave is never counted as absence. */}
        <StatCard
          icon={<EventBusyIcon />}
          iconBg={brand.redSoft}
          iconFg={brand.red}
          accent={brand.red}
          title="Absent / On leave"
          value={summary ? (summary.absentToday || 0) + (summary.onLeaveToday || 0) : '—'}
          sub={summary ? `${summary.absentToday || 0} absent · ${summary.onLeaveToday || 0} on leave` : ''}
          loading={loading}
          onClick={() => goToDetails('absentOrLeave')}
        />
        <StatCard
          icon={<AccessTimeIcon />}
          iconBg={brand.orangeSoft}
          iconFg={brand.orange}
          accent={brand.orange}
          title="Late arrivals"
          value={summary?.lateToday ?? '—'}
          sub="Punched in after shift start"
          loading={loading}
          onClick={() => goToDetails('late')}
        />
        <StatCard
          icon={<LocalCafeIcon />}
          iconBg={brand.purpleSoft}
          iconFg={brand.purple}
          accent={brand.purple}
          title="Still clocked in"
          value={summary?.activeEmployees ?? '—'}
          sub="Yet to punch out"
          loading={loading}
          onClick={() => goToDetails('active')}
        />
        <StatCard
          icon={<LogoutIcon />}
          iconBg={brand.redSoft}
          iconFg={brand.red}
          accent={brand.red}
          title="Early punch-out"
          value={summary?.earlyLeaveToday ?? '—'}
          sub="Left before shift end"
          loading={loading}
          onClick={() => goToDetails('earlyLeave')}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.9fr 1fr' },
          gap: 2,
          mb: 2,
        }}
      >
        {/* Daily attendance trend */}
        <Paper sx={{ p: 2.5, minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ mb: 1 }}>
            <Typography variant="subtitle1">
              {filters.from || filters.to ? 'Attendance for the selected range' : 'Attendance this month'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {report?.range
                ? `${fz(report.range.start, fz(report.range.start, 'yyyy') === fz(report.range.end, 'yyyy') ? 'MMM d' : 'MMM d, yyyy')} – ${fz(report.range.end, 'MMM d, yyyy')} · ${report.records} records`
                : 'Daily punch-ins and late arrivals'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 300 }}>
            {loading ? (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : trend.length === 0 ? (
              <EmptyBlock message="No attendance recorded this month yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={brand.blue500} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={brand.blue500} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gLate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={brand.orange} stopOpacity={0.26} />
                      <stop offset="100%" stopColor={brand.orange} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} stroke={brand.slate300} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    stroke={brand.slate500}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    stroke={brand.slate500}
                    width={44}
                  />
                  <RTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${brand.slate200}`,
                      boxShadow: '0 12px 28px -8px rgba(17,26,46,.14)',
                      fontSize: 13,
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                  <Area
                    type="monotone"
                    dataKey="present"
                    name="Punched in"
                    stroke={brand.blue500}
                    strokeWidth={2.5}
                    fill="url(#gPresent)"
                  />
                  <Area
                    type="monotone"
                    dataKey="late"
                    name="Late"
                    stroke={brand.orange}
                    strokeWidth={2.5}
                    fill="url(#gLate)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Paper>

        {/* Today's split */}
        <Paper sx={{ p: 2.5, minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle1">{isRange ? 'Attendance in range' : 'Today\u2019s attendance'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {isRange
              ? `${summary?.eligibleRecords ?? 0} eligible records · ${summary?.totalEmployees ?? 0} employees`
              : `Across ${summary?.totalEmployees ?? 0} employees`}
          </Typography>

          {loading ? (
            <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={32} />
            </Box>
          ) : donutData.length === 0 ? (
            <EmptyBlock message="Nothing recorded today yet." />
          ) : (
            <>
              <Box sx={{ position: 'relative', height: 230, mt: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      innerRadius="66%"
                      outerRadius="94%"
                      paddingAngle={donutData.length > 1 ? 2 : 0}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {donutData.map((d) => (
                        <Cell key={d.name} fill={d.color} stroke="none" />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: `1px solid ${brand.slate200}`,
                        fontSize: 13,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700}>
                      {attendanceRate === null ? '—' : `${attendanceRate}%`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      present
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {donutData.map((d) => (
                  <Box
                    key={d.name}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: d.color }} />
                      <Typography variant="body2">{d.name}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700}>
                      {d.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
        <Paper sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1">Recent activity</Typography>
            <Button size="small" onClick={() => navigate('/activities')}>
              View all
            </Button>
          </Box>
          <Divider sx={{ mb: 0.5 }} />
          {loading ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} /></Box>
          ) : activities.length === 0 ? (
            <EmptyBlock dense message="No activity logged yet." />
          ) : (
            activities.map((a) => (
              <Box key={a._id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.15, '&:not(:last-child)': { borderBottom: `1px solid ${brand.slate200}` } }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '11px',
                    bgcolor: brand.blueSoft,
                    color: 'primary.main',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {ACTIVITY_ICON[a.activityType] || ACTIVITY_ICON.other}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {a.employeeId?.name || 'Employee'}
                    <Typography component="span" variant="body2" color="text.secondary">
                      {' · '}
                      {ACTIVITY_LABEL[a.activityType] || a.activityType}
                    </Typography>
                  </Typography>
                  {activityMessage(a) && (
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {activityMessage(a)}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  {a.timestamp && (
                    <Typography variant="caption" color="text.disabled" whiteSpace="nowrap" display="block">
                      {fz(a.timestamp, 'dd MMM yyyy, hh:mm a', a)}
                    </Typography>
                  )}
                  {earlyMinutes(a) > 0 && (
                    <Chip size="small" label={`Early ${earlyMinutes(a)}m`} sx={{ mt: 0.25, bgcolor: brand.redSoft, color: brand.red, height: 20 }} />
                  )}
                </Box>
              </Box>
            ))
          )}
        </Paper>

        <Paper sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1">Upcoming leaves</Typography>
            <Button size="small" onClick={() => navigate('/leaves')}>
              View all
            </Button>
          </Box>
          <Divider sx={{ mb: 0.5 }} />
          {loading ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} /></Box>
          ) : leaves.length === 0 ? (
            <EmptyBlock dense message="No approved upcoming leaves." />
          ) : (
            leaves.map((l) => {
              const days = differenceInCalendarDays(new Date(l.endDate), new Date(l.startDate)) + 1;
              return (
                <Box key={l._id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.15, '&:not(:last-child)': { borderBottom: `1px solid ${brand.slate200}` } }}>
                  <InitialsAvatar name={l.employeeId?.name} src={l.employeeId?.profilePhoto} size={36} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {l.employeeId?.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {l.reason || 'Leave'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" whiteSpace="nowrap" display="block">
                      {fd(l.startDate, 'MMM d')} – {fd(l.endDate, 'MMM d')}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${days} day${days > 1 ? 's' : ''}`}
                      sx={{ mt: 0.5, bgcolor: brand.blueSoft, color: brand.blue600 }}
                    />
                  </Box>
                </Box>
              );
            })
          )}
        </Paper>
      </Box>
    </Box>
  );
}

function EmptyBlock({ message, dense }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'grid',
        placeItems: 'center',
        py: dense ? 1 : 3,
        minHeight: dense ? 0 : 200,
      }}
    >
      <EmptyState dense title={message} />
    </Box>
  );
}