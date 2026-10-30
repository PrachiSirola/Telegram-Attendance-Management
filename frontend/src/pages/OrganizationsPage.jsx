import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Avatar,
  AvatarGroup,
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
import { format } from 'date-fns';
import ApartmentIcon from '@mui/icons-material/Apartment';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import GroupIcon from '@mui/icons-material/Group';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LockResetIcon from '@mui/icons-material/LockReset';
import api from '../services/api';
import ShiftBreakPicker from '../components/ShiftBreakPicker';
import TimezoneSelect from '../components/TimezoneSelect';
import { setOrgTimezones } from '../redux/slices/tzSlice';
import OfficeLocationPicker from '../components/OfficeLocationPicker';
import PasswordFields from '../components/PasswordFields';
import { parseShiftTiming } from '../utils/time';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import StatusChip from '../components/StatusChip';
import InitialsAvatar from '../components/InitialsAvatar';
import FilterBar from '../components/FilterBar';
import { TableEmpty, TableFooterBar, TableSpinner } from '../components/TableStates';
import { usePageSize } from '../hooks/usePageSize';
import { brand, tintForString } from '../theme/theme';
import { setOrgOverride } from '../redux/slices/authSlice';
import { useOrgTz } from '../hooks/useOrgTz';


export default function OrganizationsPage() {
  const { fz } = useOrgTz();
  const currentOrg = useSelector((s) => s.auth.organization);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [orgs, setOrgs] = useState([]);
  const [adminsByOrg, setAdminsByOrg] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('organizations', 10);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    timezone: 'Asia/Kolkata',
    shiftStart: '10:00',
    shiftEnd: '19:00',
    breakTimings: { morning: { start: '' }, lunch: { start: '' }, evening: { start: '' } },
    officeAddress: '',
    officeLat: '',
    officeLng: '',
    officeRadius: '500',
    sundayOff: false,
    locationSharingEnabled: false,
    imageCaptureEnabled: false,
  });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [editOrg, setEditOrg] = useState(null);
  const [editOrgForm, setEditOrgForm] = useState({
    name: '',
    slug: '',
    timezone: 'Asia/Kolkata',
    shiftStart: '',
    shiftEnd: '',
    breakTimings: { morning: { start: '' }, lunch: { start: '' }, evening: { start: '' } },
    officeAddress: '',
    officeLat: '',
    officeLng: '',
    officeRadius: '500',
    sundayOff: false,
    locationSharingEnabled: false,
    imageCaptureEnabled: false,
  });
  const [editOrgError, setEditOrgError] = useState('');
  const [savingOrgEdit, setSavingOrgEdit] = useState(false);
  const [confirmEditOrg, setConfirmEditOrg] = useState(false);

  const [togglingOrgId, setTogglingOrgId] = useState(null);
  const [sendingReportId, setSendingReportId] = useState(null);


  const [manageOrg, setManageOrg] = useState(null);
  const [manageAdmins, setManageAdmins] = useState([]);
  const [manageLoading, setManageLoading] = useState(false);

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    canEditOrgFeatureToggles: false,
  });
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [adminPasswordValid, setAdminPasswordValid] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);

  const [editAdmin, setEditAdmin] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    active: true,
    canEditOrgFeatureToggles: false,
  });
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [editPasswordValid, setEditPasswordValid] = useState(true);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [toast, setToast] = useState('');
  const [resetTfaAdmin, setResetTfaAdmin] = useState(null);
  const [resettingTfa, setResettingTfa] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/organizations');
      const items = data.data || [];
      setOrgs(items);
      dispatch(setOrgTimezones(items.map((o) => ({ id: o._id, timezone: o.timezone || 'Asia/Kolkata' }))));

      const results = await Promise.all(
        items.map((o) =>
          api
            .get(`/organizations/${o._id}/admins`)
            .then((r) => [o._id, r.data.data || []])
            .catch(() => [o._id, []])
        )
      );
      setAdminsByOrg(Object.fromEntries(results));
    } catch {
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orgs.filter((o) => {
      if (statusFilter === 'active' && !o.active) return false;
      if (statusFilter === 'inactive' && o.active) return false;
      if (!term) return true;
      return (
        o.name?.toLowerCase().includes(term) || o.slug?.toLowerCase().includes(term)
      );
    });
  }, [orgs, q, statusFilter]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage((p) => Math.min(p, Math.max(1, Math.ceil(filtered.length / size))));
  }

  const stats = useMemo(() => {
    const totalAdmins = Object.values(adminsByOrg).reduce((sum, list) => sum + list.length, 0);
    return {
      total: orgs.length,
      active: orgs.filter((o) => o.active).length,
      inactive: orgs.filter((o) => !o.active).length,
      admins: totalAdmins,
    };
  }, [orgs, adminsByOrg]);

  const SLUG_PATTERN = /^[a-z0-9-]+$/;

  async function createOrg() {
    const slug = createForm.slug.trim().toLowerCase();
    if (!slug) {
      setCreateError('Slug is required');
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      setCreateError('Slug may only contain lowercase letters, numbers, and hyphens');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/organizations', {
        name: createForm.name.trim(),
        slug,
        timezone: createForm.timezone,
        shiftTiming:
          createForm.shiftStart && createForm.shiftEnd
            ? `${createForm.shiftStart}-${createForm.shiftEnd}`
            : undefined,
        breakTimings: createForm.breakTimings,
        sundayOff: createForm.sundayOff,
        locationSharingEnabled: createForm.locationSharingEnabled,
        imageCaptureEnabled: createForm.imageCaptureEnabled,
        officeLocation: {
          address: createForm.officeAddress,
          lat: createForm.officeLat,
          lng: createForm.officeLng,
          radiusMeters: createForm.officeRadius,
        },
      });
      setCreateOpen(false);
      setCreateForm({
        name: '',
        slug: '',
        timezone: 'Asia/Kolkata',
        shiftStart: '10:00',
        shiftEnd: '19:00',
        breakTimings: { morning: { start: '' }, lunch: { start: '' }, evening: { start: '' } },
        officeAddress: '',
        officeLat: '',
        officeLng: '',
        officeRadius: '500',
        sundayOff: false,
        locationSharingEnabled: false,
        imageCaptureEnabled: false,
      });
      setToast('Organization created');
      await load();
    } catch (e) {
      setCreateError(e.response?.data?.message || e.message || 'Could not create organization');
    } finally {
      setCreating(false);
    }
  }

  function openEditOrg(org) {
    setEditOrgError('');
    setEditOrg(org);
    const { start, end } = parseShiftTiming(org.shiftTiming);
    setEditOrgForm({
      name: org.name || '',
      slug: org.slug || '',
      timezone: org.timezone || 'Asia/Kolkata',
      shiftStart: start || '',
      shiftEnd: end || '',
      breakTimings: {
        morning: { start: org.breakTimings?.morning?.start || '' },
        lunch: { start: org.breakTimings?.lunch?.start || '' },
        evening: { start: org.breakTimings?.evening?.start || '' },
      },
      officeAddress: org.officeLocation?.address ?? '',
      officeLat: org.officeLocation?.lat ?? '',
      officeLng: org.officeLocation?.lng ?? '',
      officeRadius: org.officeLocation?.radiusMeters ?? '500',
      sundayOff: !!org.sundayOff,
      locationSharingEnabled: !!org.locationSharingEnabled,
      imageCaptureEnabled: !!org.imageCaptureEnabled,
    });
  }

  function requestSaveOrgEdit() {
    const name = editOrgForm.name.trim();
    const slug = editOrgForm.slug.trim().toLowerCase();
    if (!name) {
      setEditOrgError('Organization name is required');
      return;
    }
    if (!slug) {
      setEditOrgError('Slug is required');
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      setEditOrgError('Slug may only contain lowercase letters, numbers, and hyphens');
      return;
    }
    setEditOrgError('');
    setConfirmEditOrg(true);
  }

  async function saveOrgEdit() {
    const name = editOrgForm.name.trim();
    const slug = editOrgForm.slug.trim().toLowerCase();
    setConfirmEditOrg(false);
    setSavingOrgEdit(true);
    setEditOrgError('');
    try {
      const { data: saved } = await api.patch(`/organizations/${editOrg._id}`, {
        name,
        slug,
        timezone: editOrgForm.timezone,
        shiftTiming:
          editOrgForm.shiftStart && editOrgForm.shiftEnd
            ? `${editOrgForm.shiftStart}-${editOrgForm.shiftEnd}`
            : '',
        breakTimings: editOrgForm.breakTimings,
        sundayOff: editOrgForm.sundayOff,
        locationSharingEnabled: editOrgForm.locationSharingEnabled,
        imageCaptureEnabled: editOrgForm.imageCaptureEnabled,
        officeLocation: {
          address: editOrgForm.officeAddress,
          lat: editOrgForm.officeLat,
          lng: editOrgForm.officeLng,
          radiusMeters: editOrgForm.officeRadius,
        },
      });
      setEditOrg(null);
      const reclassified = saved?.reclassifiedCount || 0;
      const removedManual = saved?.removedManualEntriesCount || 0;
      const notes = [];
      if (reclassified > 0) {
        notes.push(`${reclassified} past Sunday Absent record${reclassified > 1 ? 's were' : ' was'} corrected to Day Off`);
      }
      if (removedManual > 0) {
        notes.push(
          `${removedManual} manual Sunday off-day entr${removedManual > 1 ? 'ies were' : 'y was'} removed as redundant`
        );
      }
      setToast(notes.length ? `Organization updated. ${notes.join('; ')}.` : 'Organization updated');
      await load();
    } catch (e) {
      setEditOrgError(e.response?.data?.message || e.message || 'Could not update organization');
    } finally {
      setSavingOrgEdit(false);
    }
  }

  async function sendTestReport(org) {
    setSendingReportId(org._id);
    try {
      await api.post(`/organizations/${org._id}/send-test-report`);
      setToast(`Test report sent for ${org.name}`);
    } catch (e) {
      setToast(e.response?.data?.message || e.message || 'Could not send test report');
    } finally {
      setSendingReportId(null);
    }
  }

  async function toggleOrgActive(org) {
    setTogglingOrgId(org._id);
    try {
      await api.patch(`/organizations/${org._id}`, { active: !org.active });
      setToast(org.active ? 'Organization deactivated' : 'Organization activated');
      await load();
    } catch (e) {
      setToast(e.response?.data?.message || e.message || 'Could not update organization status');
    } finally {
      setTogglingOrgId(null);
    }
  }

  async function openManage(org) {
    setManageOrg(org);
    setManageLoading(true);
    try {
      const { data } = await api.get(`/organizations/${org._id}/admins`);
      setManageAdmins(data.data || []);
    } catch {
      setManageAdmins([]);
    } finally {
      setManageLoading(false);
    }
  }

  async function addAdmin() {
    setSavingAdmin(true);
    setAdminError('');
    try {
      await api.post(`/organizations/${manageOrg._id}/admins`, adminForm);
      setAdminOpen(false);
      setAdminForm({ name: '', email: '', password: '', role: 'admin', canEditOrgFeatureToggles: false });
      setAdminConfirmPassword('');
      setToast('Admin added');
      await Promise.all([openManage(manageOrg), load()]);
    } catch (e) {
      setAdminError(e.response?.data?.message || e.message || 'Could not add admin');
    } finally {
      setSavingAdmin(false);
    }
  }

  async function saveAdminEdit() {
    setSavingEdit(true);
    setEditError('');
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email,

        active: editForm.active,
        canEditOrgFeatureToggles: editForm.canEditOrgFeatureToggles,
      };
      if (editForm.password) payload.password = editForm.password;
      await api.patch(`/organizations/${manageOrg._id}/admins/${editAdmin._id}`, payload);
      setEditAdmin(null);
      setToast('Admin updated');
      await openManage(manageOrg);
    } catch (e) {
      setEditError(e.response?.data?.message || e.message || 'Could not update admin');
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmResetTwoFactor() {
    if (!resetTfaAdmin || !manageOrg) return;
    setResettingTfa(true);
    try {
      await api.post(`/organizations/${manageOrg._id}/admins/${resetTfaAdmin._id}/reset-2fa`);
      setToast(`Two-factor authentication reset for ${resetTfaAdmin.name}`);
      setResetTfaAdmin(null);
      await openManage(manageOrg);
    } catch (e) {
      setToast(e.response?.data?.message || e.message || 'Could not reset two-factor authentication');
      setResetTfaAdmin(null);
    } finally {
      setResettingTfa(false);
    }
  }

  return (
    <Box>
      <PageHeader
        title="Organizations"
        subtitle="Manage tenants and their admin accounts"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New organization
          </Button>
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
          icon={<ApartmentIcon />}
          iconBg={brand.blueSoft}
          iconFg={brand.blue600}
          accent={brand.blue600}
          title="Organizations"
          value={loading ? '—' : stats.total}
          sub="Tenants on this instance"
          loading={loading}
          onClick={() => navigate('/details/organizations?filter=all')}
        />
        <StatCard
          icon={<CheckCircleIcon />}
          iconBg={brand.greenSoft}
          iconFg={brand.green}
          accent={brand.green}
          title="Active"
          value={loading ? '—' : stats.active}
          sub="Accepting logins"
          loading={loading}
          onClick={() => navigate('/details/organizations?filter=active')}
        />
        <StatCard
          icon={<BlockIcon />}
          iconBg={brand.redSoft}
          iconFg={brand.red}
          accent={brand.red}
          title="Inactive"
          value={loading ? '—' : stats.inactive}
          sub="Sign-in disabled"
          loading={loading}
          onClick={() => navigate('/details/organizations?filter=inactive')}
        />
        <StatCard
          icon={<GroupIcon />}
          iconBg={brand.purpleSoft}
          iconFg={brand.purple}
          accent={brand.purple}
          title="Admin accounts"
          value={loading ? '—' : stats.admins}
          sub="Across all organizations"
          loading={loading}
          onClick={() => navigate('/details/organizations?filter=admins')}
        />
      </Box>

      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: '0.05em' }}>
              ALL COMPANIES
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              View combined data across every organization in one aggregated dashboard.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<OpenInNewIcon />}
            onClick={() => {
              dispatch(setOrgOverride({ id: 'ALL', name: 'All Companies', slug: null, active: true, allOrgs: true }));
              navigate('/');
            }}
            sx={{ flexShrink: 0 }}
          >
            Open dashboard
          </Button>
        </Box>
      </Paper>

      <FilterBar>
        <TextField
          size="small"
          placeholder="Search by name or slug…"
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
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 155 }}
        >
          <MenuItem value="">All status</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </TextField>
      </FilterBar>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Organization</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Admins</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSpinner colSpan={6} />
              ) : pageRows.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  icon={<ApartmentIcon />}
                  title="No organizations match these filters"
                  hint="Create one to onboard a new tenant."
                />
              ) : (
                pageRows.map((o) => {
                  const tint = tintForString(o.name || '');
                  const admins = adminsByOrg[o._id] || [];
                  const isCurrent = currentOrg?.slug && o.slug === currentOrg.slug;
                  return (
                    <TableRow
                      key={o._id}
                      hover
                      onClick={() => {
                        dispatch(setOrgOverride({ id: o._id, name: o.name, slug: o.slug, active: o.active }));
                        navigate('/');
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: '11px',
                              bgcolor: tint.bg,
                              color: tint.fg,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <ApartmentIcon fontSize="small" />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {o.name}{' '}
                              <Box
                                component="span"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '0.78em',
                                  color: o.active ? 'success.main' : 'text.disabled',
                                }}
                              >
                                ({o.active ? 'Active' : 'Inactive'})
                              </Box>
                            </Typography>
                            {o.officeLocation?.address && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 260 }}
                                title={o.officeLocation.address}
                              >
                                <LocationOnIcon sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />
                                {o.officeLocation.address}
                              </Typography>
                            )}
                            {isCurrent && (
                              <Chip
                                size="small"
                                label="You"
                                sx={{ height: 18, fontSize: '0.65rem', bgcolor: brand.blueSoft, color: brand.blue600, mt: 0.5 }}
                              />
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={o.slug || '—'}
                          sx={{ bgcolor: brand.slate100, color: 'text.secondary', fontFamily: 'monospace' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {admins.length > 0 ? (
                            <AvatarGroup
                              max={4}
                              sx={{
                                '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.7rem', borderColor: '#fff' },
                              }}
                            >
                              {admins.map((a) => (
                                <Tooltip key={a._id} title={`${a.name} · ${a.email}`}>
                                  <Avatar
                                    sx={{
                                      bgcolor: tintForString(a.name).bg,
                                      color: tintForString(a.name).fg,
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {a.name?.slice(0, 2).toUpperCase()}
                                  </Avatar>
                                </Tooltip>
                              ))}
                            </AvatarGroup>
                          ) : (
                            <Typography variant="body2" color="text.disabled">
                              None
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {o.adminCount ?? admins.length}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={o.active ? 'active' : 'inactive'} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
                          {o.createdAt ? fz(o.createdAt, 'dd MMM yyyy', o) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<OpenInNewIcon />}
                            onClick={() => {
                              dispatch(setOrgOverride({ id: o._id, name: o.name, slug: o.slug }));
                              navigate('/');
                            }}
                          >
                            Open dashboard
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ManageAccountsIcon />}
                            onClick={() => openManage(o)}
                          >
                            Manage admins
                          </Button>
                          <Tooltip title="Edit organization">
                            <IconButton size="small" onClick={() => openEditOrg(o)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Send today's attendance report now (test)">
                            <span>
                              <IconButton
                                size="small"
                                disabled={sendingReportId === o._id}
                                onClick={() => sendTestReport(o)}
                              >
                                {sendingReportId === o._id ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <SendIcon fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={o.active ? 'Deactivate organization' : 'Activate organization'}>
                            <span>
                              <Switch
                                size="small"
                                checked={!!o.active}
                                disabled={togglingOrgId === o._id}
                                onChange={() => toggleOrgActive(o)}
                              />
                            </span>
                          </Tooltip>
                        </Box>
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
          total={filtered.length}
          noun="organizations"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </Paper>

      {/* Create organization */}
      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New organization</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {createError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCreateError('')}>
              {createError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Organization name"
              size="small"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
            <TextField
              label="Slug"
              size="small"
              value={createForm.slug}
              onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
              helperText="Lowercase letters, numbers and hyphens — admins use this to sign in."
              required
            />
            <TimezoneSelect
              value={createForm.timezone || 'Asia/Kolkata'}
              onChange={(tz) => setCreateForm({ ...createForm, timezone: tz })}
              helperText="Search any timezone. Sets this organization's working day, shift, report and attendance times."
            />
            <ShiftBreakPicker
              label="Default shift timing"
              value={createForm}
              onChange={(next) => setCreateForm({ ...createForm, ...next })}
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Switch
                checked={createForm.sundayOff}
                onChange={(e) => setCreateForm({ ...createForm, sundayOff: e.target.checked })}
              />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Sunday Off
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Every Sunday is automatically a weekly off for this organization's employees — no need to add it in
                  Set Leaves.
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Switch
                checked={createForm.locationSharingEnabled}
                onChange={(e) => setCreateForm({ ...createForm, locationSharingEnabled: e.target.checked })}
              />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Location Sharing
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Employees must share their location during punch-in on Telegram. If an office location is set
                  below, punch-in is blocked outside the allowed radius.
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Switch
                checked={createForm.imageCaptureEnabled}
                onChange={(e) => setCreateForm({ ...createForm, imageCaptureEnabled: e.target.checked })}
              />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Image Capture
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Employees must send a selfie photo during punch-in on Telegram.
                </Typography>
              </Box>
            </Box>
            <OfficeLocationPicker
              address={createForm.officeAddress}
              lat={createForm.officeLat}
              lng={createForm.officeLng}
              radiusMeters={createForm.officeRadius}
              onChange={({ address, lat, lng, radiusMeters }) =>
                setCreateForm((prev) => ({
                  ...prev,
                  officeAddress: address,
                  officeLat: lat,
                  officeLng: lng,
                  officeRadius: radiusMeters,
                }))
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={createOrg}
            disabled={!createForm.name.trim() || !createForm.slug.trim() || creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ color: '#FFFFFF', '&.Mui-disabled': { color: '#FFFFFF' } }}
          >
            {creating ? 'Creating…' : 'Create organization'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit organization */}
      <Dialog open={!!editOrg} onClose={() => !savingOrgEdit && setEditOrg(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit organization</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {editOrgError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditOrgError('')}>
              {editOrgError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Organization name"
              size="small"
              value={editOrgForm.name}
              onChange={(e) => setEditOrgForm({ ...editOrgForm, name: e.target.value })}
              required
            />
            <TextField
              label="Slug"
              size="small"
              value={editOrgForm.slug}
              onChange={(e) => setEditOrgForm({ ...editOrgForm, slug: e.target.value })}
              helperText="Lowercase letters, numbers and hyphens — admins sign in with this."
              required
            />
            <TimezoneSelect
              value={editOrgForm.timezone || 'Asia/Kolkata'}
              onChange={(tz) => setEditOrgForm({ ...editOrgForm, timezone: tz })}
              helperText="Search any timezone. Sets this organization's working day, shift, report and attendance times."
            />
            <ShiftBreakPicker
              label="Default shift timing"
              value={editOrgForm}
              onChange={(next) => setEditOrgForm({ ...editOrgForm, ...next })}
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Switch
                checked={editOrgForm.sundayOff}
                onChange={(e) => setEditOrgForm({ ...editOrgForm, sundayOff: e.target.checked })}
              />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Sunday Off
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Every Sunday is automatically a weekly off for this organization's employees — no need to add it in
                  Set Leaves.
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Switch
                checked={editOrgForm.locationSharingEnabled}
                onChange={(e) => setEditOrgForm({ ...editOrgForm, locationSharingEnabled: e.target.checked })}
              />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Location Sharing
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Employees must share their location during punch-in on Telegram. If an office location is set
                  below, punch-in is blocked outside the allowed radius.
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Switch
                checked={editOrgForm.imageCaptureEnabled}
                onChange={(e) => setEditOrgForm({ ...editOrgForm, imageCaptureEnabled: e.target.checked })}
              />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Image Capture
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Employees must send a selfie photo during punch-in on Telegram.
                </Typography>
              </Box>
            </Box>
            <OfficeLocationPicker
              address={editOrgForm.officeAddress}
              lat={editOrgForm.officeLat}
              lng={editOrgForm.officeLng}
              radiusMeters={editOrgForm.officeRadius}
              onChange={({ address, lat, lng, radiusMeters }) =>
                setEditOrgForm((prev) => ({
                  ...prev,
                  officeAddress: address,
                  officeLat: lat,
                  officeLng: lng,
                  officeRadius: radiusMeters,
                }))
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOrg(null)} disabled={savingOrgEdit}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={requestSaveOrgEdit}
            disabled={savingOrgEdit}
            startIcon={savingOrgEdit ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {savingOrgEdit ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm edit */}
      <Dialog open={confirmEditOrg} onClose={() => setConfirmEditOrg(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1">Are you sure you want to edit this organization?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmEditOrg(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveOrgEdit}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage admins */}
      <Dialog open={!!manageOrg} onClose={() => setManageOrg(null)} fullWidth maxWidth="md">
        <DialogTitle>
          Admins — {manageOrg?.name}
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
            Sign-in slug: {manageOrg?.slug}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setAdminError('');
                setAdminConfirmPassword('');
                setAdminOpen(true);
              }}
            >
              Add admin
            </Button>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Edit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {manageLoading ? (
                  <TableSpinner colSpan={5} />
                ) : manageAdmins.length === 0 ? (
                  <TableEmpty colSpan={5} icon={<GroupIcon />} title="No admins yet" hint="Add one to give this tenant access." />
                ) : (
                  manageAdmins.map((a) => (
                    <TableRow key={a._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <InitialsAvatar name={a.name} size={30} />
                          <Typography variant="body2" fontWeight={600}>
                            {a.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {a.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={a.role === 'super_admin' ? 'Super admin' : 'Admin'}
                          sx={{
                            bgcolor: a.role === 'super_admin' ? brand.purpleSoft : brand.blueSoft,
                            color: a.role === 'super_admin' ? brand.purple : brand.blue600,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          <StatusChip status={a.active ? 'active' : 'inactive'} />
                          {a.twoFactorEnabled && <Chip size="small" variant="outlined" color="success" label="2FA" />}
                          {a.role !== 'super_admin' && a.canEditOrgFeatureToggles && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label="Can edit org toggles"
                              sx={{ borderColor: brand.blue600, color: brand.blue600 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {a.twoFactorEnabled && a.role !== 'super_admin' && (
                          <Tooltip title="Reset two-factor authentication">
                            <IconButton size="small" onClick={() => setResetTfaAdmin(a)}>
                              <LockResetIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditError('');
                            setEditAdmin(a);
                            setEditConfirmPassword('');
                            setEditPasswordValid(true);
                            setEditForm({
                              name: a.name || '',
                              email: a.email || '',
                              password: '',
                              role: a.role || 'admin',
                              active: a.active !== false,
                              canEditOrgFeatureToggles: !!a.canEditOrgFeatureToggles,
                            });
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageOrg(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reset an admin's two-factor authentication */}
      <Dialog open={!!resetTfaAdmin} onClose={() => !resettingTfa && setResetTfaAdmin(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reset two-factor authentication?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {resetTfaAdmin?.name} ({resetTfaAdmin?.email}) will be signed out and will be able to sign in with just their
            password. Use this only when they&apos;ve lost their authenticator and backup codes — they can enable 2FA again afterwards.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetTfaAdmin(null)} disabled={resettingTfa}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmResetTwoFactor}
            disabled={resettingTfa}
            startIcon={resettingTfa ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Reset 2FA
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add admin */}
      <Dialog open={adminOpen} onClose={() => !savingAdmin && setAdminOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add admin to {manageOrg?.name}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {adminError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAdminError('')}>
              {adminError}
            </Alert>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              size="small"
              value={adminForm.name}
              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
            <TextField
              label="Email"
              type="email"
              size="small"
              value={adminForm.email}
              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
            />
            <PasswordFields
              password={adminForm.password}
              confirmPassword={adminConfirmPassword}
              onPasswordChange={(v) => setAdminForm({ ...adminForm, password: v })}
              onConfirmChange={setAdminConfirmPassword}
              onValidityChange={setAdminPasswordValid}
              required
            />
            <TextField
              select
              label="Role"
              size="small"
              value="admin"
              onChange={(e) => setAdminForm({ ...adminForm, role: 'admin' })}
            >
              <MenuItem value="admin">Admin</MenuItem>
              {/* Super admin option removed: it can't be assigned from Manage Admin */}
            </TextField>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, gridColumn: { sm: '1 / -1' } }}>
              <Switch
                checked={adminForm.canEditOrgFeatureToggles}
                onChange={(e) => setAdminForm({ ...adminForm, canEditOrgFeatureToggles: e.target.checked })}
              />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Can edit organization details
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Lets this Admin change Location Sharing and Image Capture for their own organization. No other
                  organization setting becomes editable.
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdminOpen(false)} disabled={savingAdmin}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={addAdmin}
            startIcon={savingAdmin ? <CircularProgress size={16} color="inherit" /> : null}
            disabled={
              savingAdmin || !adminForm.name.trim() || !adminForm.email.trim() || !adminPasswordValid
            }
          >
            {savingAdmin ? 'Adding…' : 'Add admin'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit admin */}
      <Dialog open={!!editAdmin} onClose={() => !savingEdit && setEditAdmin(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit {editAdmin?.name}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {editError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditError('')}>
              {editError}
            </Alert>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              size="small"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
            <TextField
              label="Email"
              type="email"
              size="small"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
            <PasswordFields
              password={editForm.password}
              confirmPassword={editConfirmPassword}
              onPasswordChange={(v) => setEditForm({ ...editForm, password: v })}
              onConfirmChange={setEditConfirmPassword}
              onValidityChange={setEditPasswordValid}
              required={false}
              passwordLabel="New password"
            />
            {!editForm.password && (
              <Typography variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1', mt: -1.5 }}>
                Leave blank to keep the current password.
              </Typography>
            )}
            <TextField
              select
              label="Role"
              size="small"
              value="admin"
              onChange={(e) => setEditForm({ ...editForm, role: 'admin' })}
            >
              <MenuItem value="admin">Admin</MenuItem>
              {/* Super admin option removed: roles can't be changed from Manage Admin */}
            </TextField>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={editForm.active}
                onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
              />
              <Typography variant="body2">{editForm.active ? 'Active' : 'Inactive'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, gridColumn: { sm: '1 / -1' } }}>
              <Switch
                checked={editForm.canEditOrgFeatureToggles}
                onChange={(e) => setEditForm({ ...editForm, canEditOrgFeatureToggles: e.target.checked })}
              />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Can edit organization details
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Lets this Admin change Location Sharing and Image Capture for their own organization. No other
                  organization setting becomes editable.
                </Typography>
              </Box>
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            Deactivating an admin blocks sign-in immediately without deleting their account.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAdmin(null)} disabled={savingEdit}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={saveAdminEdit}
            disabled={savingEdit || !editPasswordValid}
            startIcon={savingEdit ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {savingEdit ? 'Saving…' : 'Save changes'}
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