import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
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
import { differenceInCalendarDays, format } from 'date-fns';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import DoneIcon from '@mui/icons-material/Done';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../services/api';
import { formatBalance } from '../utils/leave';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import StatusChip from '../components/StatusChip';
import InitialsAvatar from '../components/InitialsAvatar';
import FilterBar from '../components/FilterBar';
import { TableEmpty, TableFooterBar, TableSpinner } from '../components/TableStates';
import { DateRangeInput } from '../components/DatePickers';
import { usePageSize } from '../hooks/usePageSize';
import { brand } from '../theme/theme';
import { exportRowsToCsv } from '../utils/exportCsv';
import { useOrgTz } from '../hooks/useOrgTz';

function isShort(l) {
  if (l.leaveType === 'Other') return false;
  const bal = l.leaveType === 'Casual Leave' ? l.employeeId?.clBalance : l.employeeId?.slBalance;
  return (bal ?? 0) < leaveDays(l);
}

function leaveDays(l) {
  return differenceInCalendarDays(new Date(l.endDate), new Date(l.startDate)) + 1;
}

function leaveTypeLabel(leaveType) {
  if (leaveType === 'Casual Leave') return '🟡 Casual Leave';
  if (leaveType === 'Sick Leave') return '🤒 Sick Leave';
  return '📄 Other';
}

function isAdminRoleLeave(l) {
  return (l.employeeId?.role || '').trim().toLowerCase() === 'admin';
}

export default function LeavesPage() {
  const { fz, fd } = useOrgTz();
  const navigate = useNavigate();
  const isAllOrgs = !!useSelector((s) => s.auth.orgOverride?.allOrgs);
  const admin = useSelector((s) => s.auth.admin);
  const isSuperAdmin = admin?.role === 'super_admin';
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('leaves', 10);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [counts, setCounts] = useState(null);

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ employeeId: '', startDate: '', endDate: '', leaveType: '', reason: '' });
  const [employeeLeaves, setEmployeeLeaves] = useState([]);
  const [applyError, setApplyError] = useState('');
  const [applying, setApplying] = useState(false);

  const [decision, setDecision] = useState(null); 
  const [decisionError, setDecisionError] = useState('');
  const [approveAs, setApproveAs] = useState('paid'); 
  const [deciding, setDeciding] = useState(false);
  const [toast, setToast] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (status) params.status = status;
      if (employeeId) params.employeeId = employeeId;
      const { data } = await api.get('/leaves', { params });
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
    const base = employeeId ? { employeeId } : {};
    try {

      const { data } = await api.get('/leaves/counts', { params: base });
      setCounts(data.data);
    } catch {
      setCounts(null);
    }
  }

  useEffect(() => {
    api
      .get('/employees', {
        params: { limit: 1000, active: true, fields: 'name,employeeId,department,clBalance,clTotal,slBalance,slTotal' },
      })
      .then((r) => setEmployees(r.data.data.items))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    load();

  }, [page, pageSize, status, employeeId]);

  useEffect(() => {
    loadCounts();

  }, [employeeId]);

  useEffect(() => {
    setPage(1);
  }, [status, employeeId]);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage(1);
  }

  async function submitApply() {
    setApplying(true);
    setApplyError('');
    try {
      await api.post('/leaves/apply', applyForm);
      setApplyOpen(false);
      setApplyForm({ employeeId: '', startDate: '', endDate: '', leaveType: '', reason: '' });
      setToast('Leave request submitted');
      await Promise.all([load(), loadCounts()]);
    } catch (e) {
      setApplyError(e.response?.data?.message || e.message || 'Could not submit leave request');
    } finally {
      setApplying(false);
    }
  }

  async function confirmDecision() {
    if (!decision) return;
    setDeciding(true);
    setDecisionError('');
    try {
      const body =
        decision.action === 'approve' && isShort(decision.row) ? { approveAs } : undefined;
      await api.post(`/leaves/${decision.row._id}/${decision.action}`, body);
      setToast(decision.action === 'approve' ? 'Leave approved' : 'Leave rejected');
      setDecision(null);
      await Promise.all([load(), loadCounts()]);
    } catch (e) {
      setDecisionError(e.response?.data?.message || e.message || 'Could not update this request');
    } finally {
      setDeciding(false);
    }
  }

  function exportCsv() {
    exportRowsToCsv(
      `leaves-page-${page}.csv`,
      [
        { label: 'Employee', value: (r) => r.employeeId?.name },
        { label: 'Code', value: (r) => r.employeeId?.employeeId },
        { label: 'Department', value: (r) => r.employeeId?.department },
        { label: 'From', value: (r) => fd(r.startDate, 'yyyy-MM-dd') },
        { label: 'To', value: (r) => fd(r.endDate, 'yyyy-MM-dd') },
        { label: 'Days', value: (r) => leaveDays(r) },
        { label: 'Reason', value: (r) => r.reason },
        { label: 'Status', value: (r) => r.status },
        {
          label: 'Applied on',
          value: (r) => (r.createdAt ? fz(r.createdAt, 'yyyy-MM-dd', r) : ''),
        },
      ],
      rows
    );
  }

  const applyValid =
    applyForm.employeeId && applyForm.startDate && applyForm.endDate && applyForm.leaveType && applyForm.reason.trim();

  useEffect(() => {
    if (!applyOpen || !applyForm.employeeId) {
      setEmployeeLeaves([]);
      return;
    }
    api
      .get('/leaves', { params: { employeeId: applyForm.employeeId, limit: 100 } })
      .then((r) => setEmployeeLeaves(r.data.data.items || []))
      .catch(() => setEmployeeLeaves([]));
  }, [applyOpen, applyForm.employeeId]);


  const overlapError =
    applyForm.startDate && applyForm.endDate && employeeLeaves.length > 0
      ? (() => {
          const newStart = new Date(applyForm.startDate);
          const newEnd = new Date(applyForm.endDate);
          const clash = employeeLeaves.some(
            (l) => new Date(l.startDate) <= newEnd && new Date(l.endDate) >= newStart
          );
          return clash ? 'You have already submitted a leave request for this date.' : '';
        })()
      : '';

  return (
    <Box>
      <PageHeader
        title="Leave management"
        subtitle="Review requests and manage balances"
        actions={
          <>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={rows.length === 0}>
              Export
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setApplyOpen(true)}>
              Apply for employee
            </Button>
          </>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        }}
      >
        <StatCard
          icon={<BeachAccessIcon />}
          iconBg={brand.blueSoft}
          iconFg={brand.blue600}
          accent={brand.blue600}
          title="Total requests"
          value={counts?.total ?? '—'}
          sub={employeeId ? 'For selected employee' : 'All employees'}
          loading={!counts}
          onClick={() => { const p = new URLSearchParams(); if (employeeId) p.set('employeeId', employeeId); navigate(`/details/leaves?${p}`); }}
        />
        <StatCard
          icon={<HourglassEmptyIcon />}
          iconBg={brand.orangeSoft}
          iconFg={brand.orange}
          accent={brand.orange}
          title="Pending"
          value={counts?.pending ?? '—'}
          sub="Waiting on your decision"
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ status: 'pending' }); if (employeeId) p.set('employeeId', employeeId); navigate(`/details/leaves?${p}`); }}
        />
        <StatCard
          icon={<CheckCircleIcon />}
          iconBg={brand.greenSoft}
          iconFg={brand.green}
          accent={brand.green}
          title="Approved"
          value={counts?.approved ?? '—'}
          sub="Deducted from balance"
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ status: 'approved' }); if (employeeId) p.set('employeeId', employeeId); navigate(`/details/leaves?${p}`); }}
        />
        <StatCard
          icon={<CancelIcon />}
          iconBg={brand.redSoft}
          iconFg={brand.red}
          accent={brand.red}
          title="Rejected"
          value={counts?.rejected ?? '—'}
          sub="Declined requests"
          loading={!counts}
          onClick={() => { const p = new URLSearchParams({ status: 'rejected' }); if (employeeId) p.set('employeeId', employeeId); navigate(`/details/leaves?${p}`); }}
        />
      </Box>

      <FilterBar>
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: 165 }}
        >
          <MenuItem value="">All status</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="approved">Approved</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
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
                <TableCell>Employee</TableCell>
                {isAllOrgs && <TableCell>Company</TableCell>}
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Days</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Casual Leave</TableCell>
                <TableCell>Sick Leave</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={isAllOrgs ? 9 : 8} />
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={isAllOrgs ? 9 : 8}
                  icon={<BeachAccessIcon />}
                  title="No leave requests match these filters"
                  hint="Employees can request leave straight from the Telegram bot."
                />
              ) : (
                rows.map((r) => {
                  const days = leaveDays(r);
                  return (
                    <TableRow key={r._id} hover>
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
                        <Typography variant="body2" whiteSpace="nowrap">
                          {fd(r.startDate, 'dd MMM yyyy')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" whiteSpace="nowrap">
                          {fd(r.endDate, 'dd MMM yyyy')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={`${days} day${days > 1 ? 's' : ''}`}
                          sx={{ bgcolor: brand.blueSoft, color: brand.blue600 }}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Tooltip title={r.reason || ''}>
                          <Typography variant="body2" noWrap>
                            {r.reason || <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>}
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption" color="text.secondary" display="block" noWrap>
                          {leaveTypeLabel(r.leaveType)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                          {formatBalance(r.employeeId?.clBalance, r.employeeId?.clTotal)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                          {formatBalance(r.employeeId?.slBalance, r.employeeId?.slTotal)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={r.status} />
                        {r.status === 'approved' && r.approvalType && r.approvalType !== 'normal' && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                            {r.approvalType === 'unpaid' ? 'Unpaid' : 'Override – Paid'}
                          </Typography>
                        )}
                        {r.createdAt && (
                          <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.25 }}>
                            {fz(r.createdAt, 'dd MMM', r)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {r.status === 'pending' && isAdminRoleLeave(r) && !isSuperAdmin ? (
                          <Tooltip title="Only the Super Admin can approve or reject this employee's leave requests.">
                            <Typography variant="caption" color="text.disabled">
                              Awaiting Super Admin
                            </Typography>
                          </Tooltip>
                        ) : r.status === 'pending' ? (
                          <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end' }}>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<DoneIcon />}
                              onClick={() => {
                                setDecisionError('');
                                setApproveAs('paid'); setDecision({ row: r, action: 'approve' });
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CloseIcon />}
                              onClick={() => {
                                setDecisionError('');
                                setDecision({ row: r, action: 'reject' });
                              }}
                              sx={{ borderColor: 'error.light', color: 'error.main' }}
                            >
                              Reject
                            </Button>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            {r.decidedAt ? `Decided ${fz(r.decidedAt, 'dd MMM', r)}` : 'Closed'}
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
          noun="requests"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>

      {/* Approve / reject confirmation */}
      <Dialog open={!!decision} onClose={() => !deciding && setDecision(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {decision?.action === 'approve' ? 'Approve leave request?' : 'Reject leave request?'}
        </DialogTitle>
        <DialogContent>
          {decisionError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDecisionError('')}>
              {decisionError}
            </Alert>
          )}
          {decision && (
            <>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                <strong>{decision.row.employeeId?.name}</strong> —{' '}
                {fd(decision.row.startDate, 'dd MMM')} to{' '}
                {fd(decision.row.endDate, 'dd MMM yyyy')} (
                {leaveDays(decision.row)} day
                {leaveDays(decision.row) > 1 ? 's' : ''})
              </Typography>
              {decision.action === 'approve' && isShort(decision.row) ? (
                <>
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    Leave balance is{' '}
                    {formatBalance(
                      decision.row.leaveType === 'Casual Leave'
                        ? decision.row.employeeId?.clBalance
                        : decision.row.employeeId?.slBalance,
                      decision.row.leaveType === 'Casual Leave'
                        ? decision.row.employeeId?.clTotal
                        : decision.row.employeeId?.slTotal
                    )}
                    , which is not enough for this request.
                  </Alert>
                  <FormControl>
                    <FormLabel sx={{ fontSize: 13 }}>Approve as:</FormLabel>
                    <RadioGroup value={approveAs} onChange={(e) => setApproveAs(e.target.value)}>
                      <FormControlLabel value="paid" control={<Radio size="small" />} label="Paid Leave (override)" />
                      <FormControlLabel value="unpaid" control={<Radio size="small" />} label="Unpaid Leave" />
                    </RadioGroup>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Neither option changes the employee's leave balance. Your name and the time are recorded.
                  </Typography>
                </>
              ) : (
              <Typography variant="body2" color="text.secondary">
                {decision.action === 'approve'
                  ? decision.row.leaveType === 'Other'
                    ? "Approving marks this as Unpaid Leave — it isn't tracked against any balance. The employee is notified on Telegram."
                    : `Approving deducts ${leaveDays(decision.row)} day${
                        leaveDays(decision.row) > 1 ? 's' : ''
                      } from their ${decision.row.leaveType || 'leave'} balance (currently ${formatBalance(
                        decision.row.leaveType === 'Casual Leave'
                          ? decision.row.employeeId?.clBalance
                          : decision.row.employeeId?.slBalance,
                        decision.row.leaveType === 'Casual Leave'
                          ? decision.row.employeeId?.clTotal
                          : decision.row.employeeId?.slTotal
                      )}). The employee is notified on Telegram.`
                  : 'The employee is notified on Telegram. Their leave balance is unchanged.'}
              </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecision(null)} disabled={deciding}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={decision?.action === 'approve' ? 'primary' : 'error'}
            onClick={confirmDecision}
            disabled={deciding}
            startIcon={deciding ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {deciding ? 'Saving…' : decision?.action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apply on behalf */}
      <Dialog open={applyOpen} onClose={() => !applying && setApplyOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Apply for leave on behalf of an employee</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {applyError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApplyError('')}>
              {applyError}
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
            <TextField
              select
              label="Employee"
              size="small"
              value={applyForm.employeeId}
              onChange={(e) => setApplyForm({ ...applyForm, employeeId: e.target.value })}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            >
              {employees.map((e) => (
                <MenuItem key={e._id} value={e._id}>
                  {e.name}
                  {e.clBalance != null || e.slBalance != null
                    ? ` — CL ${formatBalance(e.clBalance, e.clTotal)} · SL ${formatBalance(e.slBalance, e.slTotal)}`
                    : ''}
                </MenuItem>
              ))}
            </TextField>
            <DateRangeInput
              inGrid
              startLabel="Start date"
              endLabel="End date"
              start={applyForm.startDate}
              end={applyForm.endDate}
              onChange={({ start, end }) => setApplyForm({ ...applyForm, startDate: start, endDate: end })}
            />
            <TextField
              select
              label="Leave type"
              size="small"
              value={applyForm.leaveType}
              onChange={(e) => setApplyForm({ ...applyForm, leaveType: e.target.value })}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            >
              <MenuItem value="Casual Leave">🟡 Casual Leave</MenuItem>
              <MenuItem value="Sick Leave">🤒 Sick Leave</MenuItem>
              <MenuItem value="Other">📄 Other</MenuItem>
            </TextField>
            <TextField
              label="Reason"
              size="small"
              multiline
              minRows={2}
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
          </Box>
          {overlapError && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {overlapError}
            </Alert>
          )}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
            The request is created as pending, exactly like one submitted from the bot. Approve it
            from the table to deduct the days.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyOpen(false)} disabled={applying}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitApply}
            disabled={!applyValid || !!overlapError || applying}
            startIcon={applying ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ color: '#FFFFFF', '&.Mui-disabled': { color: '#FFFFFF' } }}
          >
            {applying ? 'Submitting…' : 'Submit request'}
          </Button>
        </DialogActions>
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