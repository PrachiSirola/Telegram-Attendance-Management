import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Bar,
  BarChart,
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
import { format } from 'date-fns';
import DescriptionIcon from '@mui/icons-material/Description';
import GridOnIcon from '@mui/icons-material/GridOn';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimerIcon from '@mui/icons-material/Timer';
import ApartmentIcon from '@mui/icons-material/Apartment';
import api from '../services/api';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import { TableEmpty, TableSpinner } from '../components/TableStates';
import { DateRangeFilter, presetRange } from '../components/DatePickers';
import { brand, tintForString } from '../theme/theme';
import { useOrgTz } from '../hooks/useOrgTz';

const EXPORTS = [
  { kind: 'excel', label: 'Excel', icon: <GridOnIcon />, ext: 'xlsx', color: brand.green, bg: brand.greenSoft },
  { kind: 'csv', label: 'CSV', icon: <DescriptionIcon />, ext: 'csv', color: brand.blue600, bg: brand.blueSoft },
  { kind: 'pdf', label: 'PDF', icon: <PictureAsPdfIcon />, ext: 'pdf', color: brand.red, bg: brand.redSoft },
];

export default function ReportsPage() {
  const { fz, todayIn } = useOrgTz();
  const navigate = useNavigate();
  const isAllOrgs = !!useSelector((s) => s.auth.orgOverride?.allOrgs);
  // Default = Last 1 Month (organization-timezone days), like the Date filter preset.
  const [from, setFrom] = useState(() => presetRange('month', todayIn()).from);
  const [to, setTo] = useState(() => presetRange('month', todayIn()).to);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const params = useMemo(() => {
    // Nothing picked = All Time; only
    // one end picked = incomplete, so no report yet.
    if (!from && !to) return { period: 'all' };
    if (!from || !to) return null;
    return { from, to };
  }, [from, to]);

  useEffect(() => {
    if (!params) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get('/reports/summary', { params })
      .then((r) => {
        if (!cancelled) setReport(r.data.data);
      })
      .catch((e) => {
        if (!cancelled) {
          setReport(null);
          setError(e.response?.data?.message || 'Could not load the report');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  async function download(kind, ext) {
    if (!params) return;
    setDownloading(kind);
    setError('');
    try {
      const res = await api.get(`/reports/export/${kind}`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${fz(new Date(), 'yyyy-MM-dd')}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setToast(`${kind.toUpperCase()} report downloaded`);
    } catch (e) {
      setError(e.response?.data?.message || `Could not generate the ${kind} report`);
    } finally {
      setDownloading('');
    }
  }

  const departments = useMemo(() => {
    const source = isAllOrgs ? report?.byOrganization : report?.byDepartment;
    if (!source) return [];
    return Object.entries(source)
      .map(([name, v]) => ({
        name,
        present: v.present,
        late: v.late,
        overtime: Math.round(v.overtime * 100) / 100,
        onTime: Math.max(0, v.present - v.late),
      }))
      .sort((a, b) => b.present - a.present);
  }, [report, isAllOrgs]);

  const punctuality = useMemo(() => {
    if (!report) return [];
    const late = report.lateTotal || 0;
    const onTime = Math.max(0, (report.records || 0) - late);
    return [
      { name: 'On time', value: onTime, color: brand.green },
      { name: 'Late', value: late, color: brand.orange },
    ].filter((d) => d.value > 0);
  }, [report]);

  const maxPresent = departments.length ? Math.max(...departments.map((d) => d.present)) : 0;
  const rangeLabel = report?.range
    ? `${fz(report.range.start, 'dd MMM yyyy')} – ${fz(report.range.end, 'dd MMM yyyy')}`
    : '';

  return (
    <Box>
      <PageHeader
        title="Reports"
        subtitle="Attendance summaries and downloadable exports"
        actions={
          rangeLabel && (
            <Chip
              label={rangeLabel}
              sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', fontWeight: 600 }}
            />
          )
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Same "Date filter" dropdown + Start/End calendar as the Attendance page. */}
        <DateRangeFilter from={from} to={to} emptyMeans="all" onChange={({ from: f, to: t }) => { setFrom(f); setTo(t); }} />

        <Box sx={{ flex: 1 }} />

        {EXPORTS.map((x) => (
          <Button
            key={x.kind}
            variant="outlined"
            startIcon={downloading === x.kind ? <CircularProgress size={16} color="inherit" /> : x.icon}
            disabled={!params || !!downloading}
            onClick={() => download(x.kind, x.ext)}
            sx={{ color: x.color, borderColor: 'divider', '&:hover': { borderColor: x.color } }}
          >
            {downloading === x.kind ? 'Preparing…' : x.label}
          </Button>
        ))}
      </Paper>

      {!params && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Pick a start and end date to generate a custom report.
        </Alert>
      )}

      {downloading && <LinearProgress sx={{ mb: 2 }} />}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        }}
      >
        <StatCard
          icon={<AssessmentIcon />}
          iconBg={brand.blueSoft}
          iconFg={brand.blue600}
          accent={brand.blue600}
          title="Attendance records"
          value={report?.records ?? '—'}
          sub="In the selected range"
          loading={loading && !!params}
          onClick={() => { if (!params) return; const p = new URLSearchParams(params); navigate(`/details/attendance?${p}`); }}
        />
        <StatCard
          icon={<AccessTimeIcon />}
          iconBg={brand.orangeSoft}
          iconFg={brand.orange}
          accent={brand.orange}
          title="Late arrivals"
          value={report?.lateTotal ?? '—'}
          sub={
            report?.records
              ? `${Math.round((report.lateTotal / report.records) * 100)}% of records`
              : ''
          }
          loading={loading && !!params}
          onClick={() => { if (!params) return; const p = new URLSearchParams(params); p.set('status', 'late'); navigate(`/details/attendance?${p}`); }}
        />
        <StatCard
          icon={<TimerIcon />}
          iconBg={brand.purpleSoft}
          iconFg={brand.purple}
          accent={brand.purple}
          title="Overtime hours"
          value={report?.overtimeTotal ?? '—'}
          sub="Total across the range"
          loading={loading && !!params}
          onClick={() => { if (!params) return; const p = new URLSearchParams(params); p.set('hasOvertime', 'true'); navigate(`/details/attendance?${p}`); }}
        />
        <StatCard
          icon={<ApartmentIcon />}
          iconBg={brand.tealSoft}
          iconFg={brand.teal}
          accent={brand.teal}
          title={isAllOrgs ? 'Companies' : 'Departments'}
          value={departments.length || '—'}
          sub={isAllOrgs ? 'With recorded attendance' : 'With recorded attendance'}
          loading={loading && !!params}
          onClick={() => navigate('/details/departments')}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.8fr 1fr' }, gap: 2, mb: 2 }}>
        <Paper sx={{ p: 2.5, minHeight: 360, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle1">
            {isAllOrgs ? 'Attendance by company' : 'Attendance by department'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            On-time versus late punch-ins
          </Typography>
          <Box sx={{ flex: 1, minHeight: 270 }}>
            {loading && params ? (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : departments.length === 0 ? (
              <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  No attendance recorded in this range.
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departments} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} stroke={brand.slate300} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke={brand.slate500} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke={brand.slate500} width={44} />
                  <RTooltip
                    cursor={{ fill: brand.blueSofter }}
                    contentStyle={{ borderRadius: 12, border: `1px solid ${brand.slate200}`, fontSize: 13 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                  <Bar dataKey="onTime" name="On time" stackId="a" fill={brand.blue500} radius={[0, 0, 0, 0]} maxBarSize={46} />
                  <Bar dataKey="late" name="Late" stackId="a" fill={brand.orange} radius={[6, 6, 0, 0]} maxBarSize={46} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Paper>

        <Paper sx={{ p: 2.5, minHeight: 360, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle1">Punctuality</Typography>
          <Typography variant="body2" color="text.secondary">
            Across {report?.records ?? 0} records
          </Typography>
          {loading && params ? (
            <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={32} />
            </Box>
          ) : punctuality.length === 0 ? (
            <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Nothing to summarize yet.
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ height: 230, mt: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={punctuality} dataKey="value" innerRadius="62%" outerRadius="92%" paddingAngle={punctuality.length > 1 ? 2 : 0}>
                      {punctuality.map((d) => (
                        <Cell key={d.name} fill={d.color} stroke="none" />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={{ borderRadius: 12, border: `1px solid ${brand.slate200}`, fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {punctuality.map((d) => (
                  <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

      <Paper>
        <Box sx={{ p: 2.5, pb: 1.5 }}>
          <Typography variant="subtitle1">
            {isAllOrgs ? 'Company breakdown' : 'Department breakdown'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Calculated live from attendance records in the selected range
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{isAllOrgs ? 'Company' : 'Department'}</TableCell>
                <TableCell>Present</TableCell>
                <TableCell>Late</TableCell>
                <TableCell>Overtime (h)</TableCell>
                <TableCell sx={{ width: '30%' }}>Share of attendance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && params ? (
                <TableSpinner colSpan={5} />
              ) : departments.length === 0 ? (
                <TableEmpty
                  colSpan={5}
                  icon={<ApartmentIcon />}
                  title={isAllOrgs ? 'No company data for this range' : 'No department data for this range'}
                  hint="Pick a wider period, or wait for punches to come in."
                />
              ) : (
                departments.map((d) => {
                  const tint = tintForString(d.name);
                  const pct = maxPresent ? Math.round((d.present / maxPresent) * 100) : 0;
                  return (
                    <TableRow key={d.name} hover>
                      <TableCell>
                        <Chip size="small" label={d.name} sx={{ bgcolor: tint.bg, color: tint.fg }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {d.present}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={d.late > 0 ? 'warning.main' : 'text.secondary'} fontWeight={600}>
                          {d.late}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{d.overtime}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              flex: 1,
                              bgcolor: brand.slate100,
                              '& .MuiLinearProgress-bar': { bgcolor: tint.fg },
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 34 }}>
                            {pct}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

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