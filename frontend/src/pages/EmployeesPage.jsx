import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
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
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Switch,
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
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TelegramIcon from '@mui/icons-material/Telegram';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PersonIcon from '@mui/icons-material/Person';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import ApartmentIcon from '@mui/icons-material/Apartment';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import api from '../services/api';
import { setOrgOverride } from '../redux/slices/authSlice';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import StatusChip from '../components/StatusChip';
import InitialsAvatar from '../components/InitialsAvatar';
import FilterBar from '../components/FilterBar';
import { TableEmpty, TableFooterBar, TableSpinner } from '../components/TableStates';
import { usePageSize } from '../hooks/usePageSize';
import { brand, tintForString } from '../theme/theme';
import { exportRowsToCsv } from '../utils/exportCsv';
import {
  TIME_SLOTS,
  breakWindowSlots,
  endTime,
  formatShiftTiming,
  parseShiftTiming,
  to12h,
} from '../utils/time';
import { useOrgTz } from '../hooks/useOrgTz';


const BREAKS = [
  { key: 'morning', label: 'Morning break', durationMins: 15 },
  { key: 'lunch', label: 'Lunch break', durationMins: 30 },
  { key: 'evening', label: 'Evening break', durationMins: 15 },
];

const emptyBreakTimings = () => ({
  morning: { start: '' },
  lunch: { start: '' },
  evening: { start: '' },
});

const emptyForm = {
  name: '',
  employeeId: '',
  email: '',
  phone: '',
  department: '',
  role: '',
  shiftStart: '',
  shiftEnd: '',
  breakTimings: emptyBreakTimings(),
};

const DEFAULT_DEPARTMENTS = [
  'Engineering / IT',
  'Sales & Marketing',
  'Operations',
  'Human Resources (HR)',
  'Finance & Accounts',
];

const DEFAULT_ROLES = [
  'Software Engineer',
  'Sales Executive',
  'Operations Associate',
  'HR Specialist',
  'Accountant',
  'Team Lead',
  'Project Manager',
  'Admin',
];

export default function EmployeesPage() {
  const { fz } = useOrgTz();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const orgOverride = useSelector((s) => s.auth.orgOverride);
  const isAllOrgs = !!orgOverride?.allOrgs;

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('employees', 10);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState(location.state?.q || '');
  const [department, setDepartment] = useState('');

  const [status, setStatus] = useState(() => {
    if (location.state?.q) return '';
    try {
      const saved = localStorage.getItem('employeesStatusFilter');
      if (saved === 'all') return '';
      if (saved === 'active' || saved === 'inactive') return saved;
    } catch {
    }
    return 'active';
  });
  function changeStatus(value) {
    setStatus(value);
    try {
      localStorage.setItem('employeesStatusFilter', value || 'all');
    } catch {

    }
  }
  const statsSeq = useRef(0);
  const [sort, setSort] = useState('recent');

  const [stats, setStats] = useState(null);
  const [departments, setDepartments] = useState([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deptSelect, setDeptSelect] = useState('');
  const [roleSelect, setRoleSelect] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [shiftOpen, setShiftOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [inviteFor, setInviteFor] = useState(null);
  const [toast, setToast] = useState('');
  const [orgDefaults, setOrgDefaults] = useState({ shiftTiming: '', breakTimings: emptyBreakTimings() });
  const [usingCustomTiming, setUsingCustomTiming] = useState(false);

  const [menuRow, setMenuRow] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  async function loadStats() {
    try {

      const params = {};
      if (q) params.q = q;
      if (department) params.department = department;
      if (status) params.active = status === 'active';
      const seq = ++statsSeq.current;
      const { data } = await api.get('/employees/stats', { params });
      if (seq !== statsSeq.current) return; // a newer filter's answer is on its way
      const totalCount = data.data.total;
      const activeCount = data.data.active;
      const deptList = data.data.departments || [];
      setDepartments(deptList);
      setStats({
        total: totalCount,
        active: activeCount,
        inactive: Math.max(0, totalCount - activeCount),
        departments: data.data.shownDepartments ?? deptList.length,
      });
    } catch {

    }
  }

  async function load() {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (q) params.q = q;
      if (department) params.department = department;
      if (status) params.active = status === 'active';
      const { data } = await api.get('/employees', { params });
      let items = data.data.items;
      if (sort === 'name_asc') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
      if (sort === 'name_desc') items = [...items].sort((a, b) => b.name.localeCompare(a.name));
      setRows(items);
      setTotal(data.data.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get('/organizations/current')
      .then((r) => {
        const { shiftTiming, breakTimings } = r.data.data;
        setOrgDefaults({
          shiftTiming: shiftTiming || '',
          breakTimings: {
            morning: { start: breakTimings?.morning?.start || '' },
            lunch: { start: breakTimings?.lunch?.start || '' },
            evening: { start: breakTimings?.evening?.start || '' },
          },
        });
      })
      .catch(() => {

      });
  }, []);

  useEffect(() => {
    load();

  }, [page, pageSize, q, department, status, sort]);

  useEffect(() => {
    setPage(1);
  }, [q, department, status]);


  useEffect(() => {
    loadStats();

  }, [q, department, status]);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage(1);
  }

  function openEmployeeProfile(row) {
    if (isAllOrgs && row.organizationId?._id) {
      dispatch(
        setOrgOverride({
          id: row.organizationId._id,
          name: row.organizationId.name,
          slug: row.organizationId.slug,
          active: true,
        })
      );
    }
    navigate(`/employees/${row._id}`, { state: { fromAllOrgs: isAllOrgs } });
  }


  const [idState, setIdState] = useState('ready');
  function loadNextId() {
    setIdState('loading');
    api
      .get('/employees/next-id')
      .then((r) => {
        setForm((f) => ({ ...f, employeeId: r.data.data.employeeId }));
        setIdState('ready');
      })
      .catch((e) => {
        setForm((f) => ({ ...f, employeeId: '' }));
        setIdState(e.response?.status === 400 ? 'noorg' : 'error');
        setFormError(e.response?.data?.message || 'Could not generate an employee ID. Please try again.');
      });
  }

  function openCreate() {
    setEditing(null);
    setFormError('');
    setForm(emptyForm);
    loadNextId();
    setDeptSelect('');
    setRoleSelect('');
    setUsingCustomTiming(false);
    setOpen(true);
  }

  function openEdit(row) {
    setMenuAnchor(null);
    if (!row) return;
    const { start, end } = parseShiftTiming(row.shiftTiming);
    const hasCustomBreaks = !!(
      row.breakTimings?.morning?.start ||
      row.breakTimings?.lunch?.start ||
      row.breakTimings?.evening?.start
    );
    const hasCustom = !!(start && end) || hasCustomBreaks;
    setEditing(row);
    setFormError('');
    setUsingCustomTiming(hasCustom);

    const deptMatch = DEFAULT_DEPARTMENTS.find(
      (d) => d.toLowerCase() === (row.department || '').toLowerCase()
    );
    setDeptSelect(deptMatch || (row.department ? 'Other' : ''));

    const roleMatch = DEFAULT_ROLES.find(
      (r) => r.toLowerCase() === (row.role || '').toLowerCase()
    );
    setRoleSelect(roleMatch || (row.role ? 'Other' : ''));

    setForm({
      name: row.name || '',
      employeeId: row.employeeId || '',
      email: row.email || '',
      phone: row.phone || '',
      department: row.department || '',
      role: row.role || '',
      shiftStart: start,
      shiftEnd: end,
      breakTimings: {
        morning: { start: row.breakTimings?.morning?.start || '' },
        lunch: { start: row.breakTimings?.lunch?.start || '' },
        evening: { start: row.breakTimings?.evening?.start || '' },
      },
    });
    setOpen(true);
  }

  function enableCustomTiming() {
    setUsingCustomTiming(true);
    const { start, end } = parseShiftTiming(orgDefaults.shiftTiming);
    setForm((f) => ({
      ...f,
      shiftStart: f.shiftStart || start,
      shiftEnd: f.shiftEnd || end,
      breakTimings:
        f.breakTimings.morning.start || f.breakTimings.lunch.start || f.breakTimings.evening.start
          ? f.breakTimings
          : orgDefaults.breakTimings,
    }));
  }

  function resetToOrgDefault() {
    setUsingCustomTiming(false);
    setForm((f) => ({ ...f, shiftStart: '', shiftEnd: '', breakTimings: emptyBreakTimings() }));
  }

  async function saveEmployee() {
    setSaving(true);
    setFormError('');
    try {
      const shiftTiming =
        usingCustomTiming && form.shiftStart && form.shiftEnd
          ? `${form.shiftStart}–${form.shiftEnd}`
          : '';
      const breakTimings = usingCustomTiming ? form.breakTimings : emptyBreakTimings();
      const { shiftStart, shiftEnd, employeeId: _employeeId, breakTimings: _ignored, ...rest } = form;

      if (editing) {

        await api.patch(`/employees/${editing._id}`, { ...rest, shiftTiming, breakTimings });
        setToast(`${form.name} updated`);
      } else {

        const { data } = await api.post('/employees', { ...rest, shiftTiming, breakTimings });
        const link = data.meta?.registrationLink;
        if (link) {
          try {
            await navigator.clipboard.writeText(link);
          } catch {

          }
          setInviteFor({ name: data.data?.name || form.name, url: link });
        } else {
          setToast(`${form.name} added`);
        }
      }
      setOpen(false);
      setForm(emptyForm);
      setEditing(null);
      await Promise.all([load(), loadStats()]);
    } catch (e) {
      setFormError(e.response?.data?.message || e.message || 'Could not save employee');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    setTogglingId(row._id);
    try {
      await api.patch(`/employees/${row._id}`, { active: !row.active });
      await Promise.all([load(), loadStats()]);
    } catch (e) {
      setToast(e.response?.data?.message || 'Could not update status');
    } finally {
      setTogglingId(null);
    }
  }

  async function copyInvite(row) {
    setMenuAnchor(null);
    if (!row) return;
    try {
      const { data } = await api.get(`/employees/${row._id}/registration-link`);
      const url = data.data.inviteUrl;
      try {
        await navigator.clipboard.writeText(url);
      } catch {

      }
      setInviteFor({ name: row.name, url });
    } catch (e) {
      setToast(e.response?.data?.message || 'Could not fetch invite link');
    }
  }

  async function deleteEmployee() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/employees/${confirmDelete._id}`);
      setToast(`${confirmDelete.name} removed`);
      setConfirmDelete(null);
      await Promise.all([load(), loadStats()]);
    } catch (e) {
      setToast(e.response?.data?.message || 'Could not delete employee');
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    exportRowsToCsv(
      `employees-page-${page}.csv`,
      [
        { label: 'Code', value: (r) => r.employeeId },
        { label: 'Name', value: (r) => r.name },
        { label: 'Email', value: (r) => r.email },
        { label: 'Phone', value: (r) => r.phone },
        { label: 'Department', value: (r) => r.department },
        { label: 'Role', value: (r) => r.role },
        { label: 'Shift', value: (r) => formatShiftTiming(r.shiftTiming) },
        { label: 'Telegram', value: (r) => (r.telegramId ? 'Linked' : 'Pending') },
        { label: 'Status', value: (r) => (r.active ? 'Active' : 'Inactive') },
      ],
      rows
    );
  }

  const shiftLabel =
    form.shiftStart && form.shiftEnd ? `${to12h(form.shiftStart)} – ${to12h(form.shiftEnd)}` : '';

  return (
    <Box>
      <PageHeader
        title="Employees"
        subtitle="Manage your organization's people, shifts and Telegram access"
        actions={
          <>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={rows.length === 0}>
              Export
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add employee
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
          icon={<PeopleAltIcon />}
          iconBg={brand.blueSoft}
          iconFg={brand.blue600}
          accent={brand.blue600}
          title="Total employees"
          value={stats?.total ?? '—'}
          sub="On the roster"
          loading={!stats}
          onClick={() => navigate('/details/employees?filter=all')}
        />
        <StatCard
          icon={<PersonIcon />}
          iconBg={brand.greenSoft}
          iconFg={brand.green}
          accent={brand.green}
          title="Active"
          value={stats?.active ?? '—'}
          sub={stats?.total ? `${Math.round((stats.active / stats.total) * 100)}% of total` : ''}
          loading={!stats}
          onClick={() => navigate('/details/employees?filter=active')}
        />
        <StatCard
          icon={<PersonOffIcon />}
          iconBg={brand.orangeSoft}
          iconFg={brand.orange}
          accent={brand.orange}
          title="Inactive"
          value={stats?.inactive ?? '—'}
          sub={stats?.total ? `${Math.round((stats.inactive / stats.total) * 100)}% of total` : ''}
          loading={!stats}
          onClick={() => navigate('/details/employees?filter=inactive')}
        />
        <StatCard
          icon={<ApartmentIcon />}
          iconBg={brand.purpleSoft}
          iconFg={brand.purple}
          accent={brand.purple}
          title="Departments"
          value={stats?.departments ?? '—'}
          sub="Distinct departments"
          loading={!stats}
          onClick={() => navigate('/details/departments')}
        />
      </Box>

      <FilterBar>
        <TextField
          size="small"
          placeholder="Search by name, email or code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, minWidth: 240 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          label="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">All departments</MenuItem>
          {departments.map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => changeStatus(e.target.value)}
          sx={{ minWidth: 145 }}
        >
          <MenuItem value="">All status</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Sort by"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          sx={{ minWidth: 165 }}
        >
          <MenuItem value="recent">Recently added</MenuItem>
          <MenuItem value="name_asc">Name (A–Z)</MenuItem>
          <MenuItem value="name_desc">Name (Z–A)</MenuItem>
        </TextField>
      </FilterBar>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Employee</TableCell>
                {isAllOrgs && <TableCell>Company</TableCell>}
                <TableCell>Department</TableCell>
                <TableCell>Shift</TableCell>
                <TableCell>Telegram</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={isAllOrgs ? 9 : 8} />
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={isAllOrgs ? 9 : 8}
                  icon={<PeopleAltIcon />}
                  title="No employees match these filters"
                  hint="Try clearing the search or adding a new employee."
                />
              ) : (
                rows.map((r) => {
                  const tint = tintForString(r.department || '');
                  return (
                    <TableRow
                      key={r._id}
                      hover
                      onClick={() => openEmployeeProfile(r)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.employeeId}
                          sx={{ bgcolor: brand.blueSoft, color: brand.blue600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <InitialsAvatar name={r.name} src={r.profilePhoto} size={36} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {r.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                              {r.email || r.role || '—'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      {isAllOrgs && (
                        <TableCell>
                          <Chip
                            size="small"
                            label={r.organizationId?.name || '—'}
                            sx={{ bgcolor: brand.slate100, color: 'text.secondary' }}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {r.department ? (
                          <Chip size="small" label={r.department} sx={{ bgcolor: tint.bg, color: tint.fg }} />
                        ) : (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" whiteSpace="nowrap">
                          {formatShiftTiming(r.shiftTiming) || (
                            <Typography component="span" variant="body2" color="text.disabled">
                              Not set
                            </Typography>
                          )}
                        </Typography>
                        {(r.breakTimings?.morning?.start ||
                          r.breakTimings?.lunch?.start ||
                          r.breakTimings?.evening?.start) && (
                          <Tooltip
                            title={BREAKS.filter((b) => r.breakTimings?.[b.key]?.start)
                              .map(
                                (b) =>
                                  `${b.label}: ${to12h(r.breakTimings[b.key].start)} (${
                                    r.breakTimings[b.key].durationMins ?? b.durationMins
                                  } min)`
                              )
                              .join(' · ')}
                          >
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mt: 0.25,
                                color: 'text.secondary',
                                cursor: 'default',
                              }}
                            >
                              <LocalCafeIcon sx={{ fontSize: 13 }} />
                              <Typography variant="caption">
                                {BREAKS.filter((b) => r.breakTimings?.[b.key]?.start).length} breaks
                              </Typography>
                            </Box>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.telegramId ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'primary.main' }}>
                            <TelegramIcon sx={{ fontSize: 16 }} />
                            <Typography variant="body2" fontWeight={600}>
                              Linked
                            </Typography>
                          </Box>
                        ) : (
                          <StatusChip status="pending" />
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Switch
                            size="small"
                            checked={!!r.active}
                            disabled={togglingId === r._id}
                            onChange={() => toggleActive(r)}
                          />
                          <StatusChip status={r.active ? 'active' : 'inactive'} />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
                          {r.createdAt
                            ? fz(r.createdAt, 'dd MMM yyyy', r)
                            : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="View details">
                          <IconButton size="small" onClick={() => openEmployeeProfile(r)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Copy Telegram invite">
                          <IconButton size="small" onClick={() => copyInvite(r)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setMenuRow(r);
                            setMenuAnchor(e.currentTarget);
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
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
          noun="employees"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => openEdit(menuRow)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit employee</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => copyInvite(menuRow)}>
          <ListItemIcon>
            <TelegramIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy Telegram invite</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setConfirmDelete(menuRow);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete employee</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create / edit employee */}
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add employee'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>
              {formError}
            </Alert>
          )}

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, mt: 1 }}>
            Details
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            <TextField
              label="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              size="small"
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
            <TextField
              label="Employee ID"
              value={form.employeeId || (idState === 'loading' ? 'Generating…' : '')}
              size="small"
              InputProps={{ readOnly: true }}
              disabled={!!editing}
              error={!editing && idState === 'error'}
              helperText={
                editing
                  ? 'Employee ID cannot be changed'
                  : idState === 'noorg'
                    ? 'Select a single company to generate its ID'
                    : idState === 'error'
                      ? 'Could not generate an ID — reopen this form to try again'
                      : 'Generated automatically — cannot be edited'
              }
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              size="small"
            />
            <TextField
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              size="small"
            />
            <TextField
              select
              label="Department"
              value={deptSelect}
              onChange={(e) => {
                const val = e.target.value;
                setDeptSelect(val);
                if (val !== 'Other') {
                  setForm((f) => ({ ...f, department: val }));
                } else {
                  setForm((f) => ({
                    ...f,
                    department: DEFAULT_DEPARTMENTS.includes(f.department) ? '' : f.department,
                  }));
                }
              }}
              size="small"
              SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}
            >
              <MenuItem value="">
                <em>Select department</em>
              </MenuItem>
              {DEFAULT_DEPARTMENTS.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
              <Divider sx={{ my: 0.5 }} />
              <MenuItem value="Other">
                <em>+ Other (Custom department)</em>
              </MenuItem>
            </TextField>

            <TextField
              select
              label="Role"
              value={roleSelect}
              onChange={(e) => {
                const val = e.target.value;
                setRoleSelect(val);
                if (val !== 'Other') {
                  setForm((f) => ({ ...f, role: val }));
                } else {
                  setForm((f) => ({
                    ...f,
                    role: DEFAULT_ROLES.includes(f.role) ? '' : f.role,
                  }));
                }
              }}
              size="small"
              SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}
            >
              <MenuItem value="">
                <em>Select role</em>
              </MenuItem>
              {DEFAULT_ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
              <Divider sx={{ my: 0.5 }} />
              <MenuItem value="Other">
                <em>+ Other (Custom role)</em>
              </MenuItem>
            </TextField>

            {deptSelect === 'Other' && (
              <TextField
                label="Custom Department *"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Enter department name"
                size="small"
                autoFocus
              />
            )}
            {roleSelect === 'Other' && (
              <TextField
                label="Custom Role *"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Enter role title"
                size="small"
                autoFocus={deptSelect !== 'Other'}
              />
            )}
          </Box>

          {!usingCustomTiming ? (
            <Box
              sx={{
                mt: 3,
                p: 2.25,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '14px',
                bgcolor: brand.slate100,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <ScheduleIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2">Using organization default</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Shift: {formatShiftTiming(orgDefaults.shiftTiming) || 'Not set'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Breaks:{' '}
                  {BREAKS.filter((b) => orgDefaults.breakTimings[b.key]?.start)
                    .map((b) => `${b.label} ${to12h(orgDefaults.breakTimings[b.key].start)}`)
                    .join(' · ') || 'Not set'}
                </Typography>
              </Box>
              <Tooltip title="Set a different schedule for this employee">
                <IconButton size="small" onClick={enableCustomTiming} sx={{ flexShrink: 0 }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3 }}>
                <TextField
                  label="Shift timing"
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
                <Button size="small" onClick={resetToOrgDefault} sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                  Reset to default
                </Button>
              </Box>

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
                  Pick a start time — each break has a fixed duration.
                  {form.shiftStart && form.shiftEnd
                    ? ' Options are limited to the shift window.'
                    : ' Set a shift to narrow these options.'}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: 2,
                  }}
                >
                  {BREAKS.map((b) => {
                    const start = form.breakTimings[b.key].start;
                    const windowWidth = b.key === 'lunch' ? 30 : Math.min(b.durationMins * 2, 30);
                    const windowSlots = breakWindowSlots(form.shiftStart, form.shiftEnd, b.durationMins, b.key);
                    const windowEnd = endTime(start, windowWidth);
                    return (
                      <TextField
                        key={b.key}
                        select
                        label={b.label}
                        value={start}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            breakTimings: {
                              ...form.breakTimings,
                              [b.key]: { start: e.target.value },
                            },
                          })
                        }
                        helperText={
                          windowEnd
                            ? `${b.durationMins} min break, any time in this window`
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
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={saveEmployee}
            disabled={!form.name.trim() || saving || (!editing && !form.employeeId)}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ color: '#FFFFFF', '&.Mui-disabled': { color: '#FFFFFF' } }}
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add employee'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Shift picker */}
      <Dialog open={shiftOpen} onClose={() => setShiftOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Shift timing</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2, mt: 1 }}>
            Overnight shifts are supported — set an end time earlier than the start.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              select
              label="Shift start"
              value={form.shiftStart}
              onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
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
              value={form.shiftEnd}
              onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
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
          <Button onClick={() => setForm({ ...form, shiftStart: '', shiftEnd: '' })}>Clear</Button>
          <Button
            variant="contained"
            onClick={() => {
              // Drop any break window that no longer fully fits the chosen shift.
              const breakTimings = Object.fromEntries(
                BREAKS.map((b) => {
                  const valid = new Set(
                    breakWindowSlots(form.shiftStart, form.shiftEnd, b.durationMins, b.key).map((s) => s.value)
                  );
                  const current = form.breakTimings[b.key].start;
                  return [b.key, { start: valid.has(current) ? current : '' }];
                })
              );
              setForm({ ...form, breakTimings });
              setShiftOpen(false);
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invite link */}
      <Dialog open={!!inviteFor} onClose={() => setInviteFor(null)} fullWidth maxWidth="sm">
        <DialogTitle>Telegram invite for {inviteFor?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Send this link to the employee. Opening it in Telegram links their account and unlocks
            the bot menu. It&apos;s been copied to your clipboard.
          </Typography>
          <Paper
            variant="outlined"
            sx={{ p: 1.5, bgcolor: brand.slate100, wordBreak: 'break-all', border: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="body2" fontFamily="monospace">
              {inviteFor?.url}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteFor.url);
                setToast('Invite link copied');
              } catch {
                setToast('Copy failed — select the link manually');
              }
            }}
          >
            Copy again
          </Button>
          <Button variant="contained" onClick={() => setInviteFor(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {confirmDelete?.name}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This removes the employee record permanently. Their attendance and activity history
            stays in the database. To keep the record but block access, switch them to inactive
            instead.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={deleteEmployee}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
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