import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
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
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import TimelineIcon from '@mui/icons-material/Timeline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TelegramIcon from '@mui/icons-material/Telegram';
import ApartmentIcon from '@mui/icons-material/Apartment';
import PublicIcon from '@mui/icons-material/Public';
import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SecurityIcon from '@mui/icons-material/Security';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { logout, setOrgOverride, clearOrgOverride } from '../redux/slices/authSlice';
import { setOrgTimezones } from '../redux/slices/tzSlice';
import InitialsAvatar from '../components/InitialsAvatar';
import NotificationsMenu from '../components/NotificationsMenu';
import TwoFactorDialog from '../components/TwoFactorDialog';
import { brand } from '../theme/theme';

const DRAWER_WIDTH = 268;
const TOPBAR_HEIGHT = 68;

const baseNav = [
  { to: '/', label: 'Dashboard', icon: <SpaceDashboardIcon /> },
  { to: '/employees', label: 'Employees', icon: <PeopleAltIcon /> },
  { to: '/attendance', label: 'Attendance', icon: <EventAvailableIcon /> },
  { to: '/set-leaves', label: 'Set Leaves', icon: <EventBusyIcon /> },
  { to: '/activities', label: 'Activities', icon: <TimelineIcon /> },
  { to: '/task-updates', label: 'Task Updates', icon: <AssignmentIcon /> },
  { to: '/leaves', label: 'Leave Requests', icon: <BeachAccessIcon /> },
  { to: '/leave-balance', label: 'Leave Balance', icon: <AccountBalanceWalletIcon /> },
  { to: '/reports', label: 'Reports', icon: <AssessmentIcon /> },
  { to: '/telegram-bot', label: 'Telegram Bot', icon: <TelegramIcon /> },
];

export default function DashboardLayout() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(!mobile);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const admin = useSelector((s) => s.auth.admin);
  const organization = useSelector((s) => s.auth.organization);
  const token = useSelector((s) => s.auth.accessToken);
  const orgOverride = useSelector((s) => s.auth.orgOverride);
  const isSuperAdmin = admin?.role === 'super_admin';
  const hasToken = !!token;

  const [notifications, setNotifications] = useState([]);
  const [userMenu, setUserMenu] = useState(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [orgMenuAnchor, setOrgMenuAnchor] = useState(null);
  const [orgList, setOrgList] = useState([]);
  const [orgListLoading, setOrgListLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  const effectiveOrgId = orgOverride?.id || organization?._id || organization?.id || null;
  const effectiveOrgActive = orgOverride ? orgOverride.active !== false : organization?.active !== false;
  const effectiveOrgName = orgOverride ? orgOverride.name : organization?.name;

  const [reactivating, setReactivating] = useState(false);

  async function reactivateOrg() {
    if (!effectiveOrgId) return;
    setReactivating(true);
    try {
      await api.patch(`/organizations/${effectiveOrgId}`, { active: true });
      if (orgOverride) {
        dispatch(setOrgOverride({ ...orgOverride, active: true }));
      }

      setOrgList((list) => list.map((o) => (o._id === effectiveOrgId ? { ...o, active: true } : o)));
    } catch {

    } finally {
      setReactivating(false);
    }
  }


  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef(null);

  useEffect(() => {
    setOpen(!mobile);
  }, [mobile]);

  const nav = useMemo(() => {
    if (admin?.role === 'super_admin') {
      return [...baseNav, { to: '/organizations', label: 'Organizations', icon: <ApartmentIcon /> }];
    }

    if (admin?.canEditOrgFeatureToggles) {
      return [...baseNav, { to: '/org-settings', label: 'Org Settings', icon: <ApartmentIcon /> }];
    }
    return baseNav;
  }, [admin?.role, admin?.canEditOrgFeatureToggles]);

  useEffect(() => {
    if (!hasToken) return undefined;
    connectSocket();
    return () => disconnectSocket();
  }, [hasToken]);

  useEffect(() => {
    if (!hasToken) return;
    api
      .get('/organizations/timezones')
      .then((r) => dispatch(setOrgTimezones(r.data.data || [])))
      .catch(() => {});
  }, [hasToken, admin?.role, organization?.id, dispatch]);

  async function openOrgMenu(e) {
    setOrgMenuAnchor(e.currentTarget);
    if (isSuperAdmin) {
      setOrgListLoading(true);
      try {
        const { data } = await api.get('/organizations');
        setOrgList(data.data || []);
      } catch {
        setOrgList([]);
      } finally {
        setOrgListLoading(false);
      }
    }
  }

  function switchToOrg(org) {
    setOrgMenuAnchor(null);
    setSwitching(true);
    dispatch(setOrgOverride({ id: org._id, name: org.name, slug: org.slug, active: org.active }));
    navigate('/');
    setTimeout(() => setSwitching(false), 450);
  }

  function enterAllCompaniesMode() {
    setOrgMenuAnchor(null);
    setSwitching(true);
    dispatch(setOrgOverride({ id: 'ALL', name: 'All Companies', slug: null, active: true, allOrgs: true }));
    navigate('/');
    setTimeout(() => setSwitching(false), 450);
  }

  function exitOrgOverride() {
    setOrgMenuAnchor(null);
    setSwitching(true);
    dispatch(clearOrgOverride());
    navigate('/');
    setTimeout(() => setSwitching(false), 450);
  }

  async function loadNotifications() {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 30 } });
      setNotifications(data.data || []);
    } catch {

    }
  }

  useEffect(() => {
    let timer;
    const loop = async () => {
      if (token) await loadNotifications();
      timer = setTimeout(loop, 60000);
    };

    if (token) timer = setTimeout(loop, 60000);
    return () => clearTimeout(timer);

  }, [token]);


  useEffect(() => {
    setNotifications([]);
    setSearchInput('');
    setSearchResults([]);
    if (token) loadNotifications();

  }, [effectiveOrgId]);

  useEffect(() => {
    clearTimeout(searchDebounce.current);
    if (!searchInput.trim()) {
      setSearchResults([]);
      return undefined;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const requests = [
          api
            .get('/employees', { params: { q: searchInput, limit: 6 } })
            .then((r) => (r.data.data.items || []).map((e) => ({ ...e, __type: 'employee' }))),
        ];
        if (isSuperAdmin) {
          requests.push(
            api
              .get('/organizations', { params: { q: searchInput } })
              .then((r) => (r.data.data || []).slice(0, 6).map((o) => ({ ...o, __type: 'organization' })))
          );
        }
        const [employees, organizationsFound = []] = await Promise.all(requests);
        setSearchResults([...employees, ...organizationsFound]);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(searchDebounce.current);
  }, [searchInput, isSuperAdmin]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {

    }
    disconnectSocket();
    dispatch(logout());
    navigate('/login');
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      {/* Brand */}
      <Box
        sx={{
          height: TOPBAR_HEIGHT,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          cursor: isSuperAdmin ? 'pointer' : 'default',
        }}
        onClick={isSuperAdmin ? openOrgMenu : undefined}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            background: brand.gradient,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            boxShadow: '0 6px 14px -6px rgba(20,84,224,.7)',
          }}
        >
          <HowToRegIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" noWrap sx={{ lineHeight: 1.2 }}>
            Attendance
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {effectiveOrgName || 'Your organization'}
            {effectiveOrgName && !orgOverride?.allOrgs && (
              <Box
                component="span"
                sx={{
                  ml: 0.5,
                  fontWeight: 700,
                  color: effectiveOrgActive ? 'success.main' : 'text.disabled',
                }}
              >
                ({effectiveOrgActive ? 'Active' : 'Inactive'})
              </Box>
            )}
          </Typography>
        </Box>
        {isSuperAdmin && (
          <KeyboardArrowDownIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
        )}
      </Box>

      {orgOverride && (
        <Box
          sx={{
            mx: 1.5,
            mt: 1.25,
            px: 1.5,
            py: 1,
            borderRadius: '10px',
            bgcolor: brand.orangeSoft,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <SwapHorizIcon sx={{ fontSize: 17, color: '#C9720A', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" fontWeight={700} display="block" noWrap sx={{ color: '#C9720A' }}>
              Viewing: {orgOverride.name}
            </Typography>
          </Box>
          <Tooltip title="Back to my organization">
            <IconButton size="small" onClick={exitOrgOverride} sx={{ color: '#C9720A' }}>
              <LogoutIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Menu
        anchorEl={orgMenuAnchor}
        open={Boolean(orgMenuAnchor)}
        onClose={() => setOrgMenuAnchor(null)}
        slotProps={{ paper: { sx: { width: 300, maxHeight: 420 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2">Switch organization</Typography>
          <Typography variant="caption" color="text.secondary">
            View any organization's full dashboard
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={enterAllCompaniesMode} selected={!!orgOverride?.allOrgs}>
          <ListItemIcon>
            <PublicIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="All Companies" secondary="Combined data across every organization" />
        </MenuItem>
        <Divider />
        {orgOverride && organization && [
          <MenuItem key="exit" onClick={exitOrgOverride}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Back to my organization" secondary={organization?.name} />
          </MenuItem>,
          <Divider key="exit-div" />,
        ]}
        {orgListLoading && orgList.length === 0 && (
          <MenuItem disabled>
            <CircularProgress size={16} sx={{ mr: 1.5 }} /> Loading organizations…
          </MenuItem>
        )}
        {!orgListLoading && orgList.length === 0 && (
          <MenuItem disabled>No organizations found</MenuItem>
        )}
        {orgList.length > 0 &&
          orgList.map((o) => (
            <MenuItem key={o._id} onClick={() => switchToOrg(o)} selected={orgOverride?.id === o._id}>
              <ListItemIcon>
                <ApartmentIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <>
                    {o.name}{' '}
                    <Box
                      component="span"
                      sx={{ fontWeight: 700, fontSize: '0.75em', color: o.active ? 'success.main' : 'text.disabled' }}
                    >
                      ({o.active ? 'Active' : 'Inactive'})
                    </Box>
                  </>
                }
                secondary={o.slug}
                primaryTypographyProps={{ noWrap: true }}
              />
            </MenuItem>
          ))}
      </Menu>

      {/* Nav */}
      <List sx={{ flex: 1, px: 1.5, py: 2, overflowY: 'auto' }}>
        {nav.map((item) => {
          const navItemSx = {
            mb: 0.25,
            py: 1.05,

            color: brand.navText,
            position: 'relative',
            '& .MuiListItemText-primary': { fontWeight: 600, color: brand.navText },
            '& .MuiListItemIcon-root': { color: brand.navIcon },
            '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.07)', color: brand.navText },
            '&:hover .MuiListItemText-primary': { color: brand.navText },
            '&:hover .MuiListItemIcon-root': { color: brand.navIcon },
            '&.active': {
              bgcolor: brand.sidebarActive,
              color: 'primary.main',
              '&:hover': { bgcolor: brand.sidebarActive },
              '& .MuiListItemText-primary': { fontWeight: 700, color: 'primary.main' },
              '& .MuiListItemIcon-root': { color: 'primary.main' },
              '&::before': {
                content: '""',
                position: 'absolute',
                left: -12,
                top: 8,
                bottom: 8,
                width: 3,
                borderRadius: 4,
                bgcolor: 'primary.main',
              },
            },
          };

          if (item.action === 'all-companies') {
            const active = !!orgOverride?.allOrgs;
            return (
              <ListItemButton
                key="all-companies"
                onClick={() => {
                  enterAllCompaniesMode();
                  if (mobile) setOpen(false);
                }}
                className={active ? 'active' : undefined}
                sx={navItemSx}
              >
                <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.92rem' }} />
              </ListItemButton>
            );
          }

          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.to === '/'}
              onClick={() => mobile && setOpen(false)}
              sx={navItemSx}
            >
              <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.92rem' }} />
            </ListItemButton>
          );
        })}
      </List>

      {/* Promo / context card */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        <Box
          sx={{
            borderRadius: '16px',
            p: 2.25,
            textAlign: 'center',
            background: `linear-gradient(160deg, ${brand.blueSofter} 0%, ${brand.blueSoft} 100%)`,
            border: '1px solid',
            borderColor: brand.slate200,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              mx: 'auto',
              mb: 1.25,
              borderRadius: '13px',
              background: '#fff',
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              boxShadow: 1,
            }}
          >
            <EventAvailableIcon />
          </Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            Manage your team efficiently
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Attendance, leaves and activity — tracked from Telegram, managed here.
          </Typography>
        </Box>
      </Box>

      <Divider />
      <Box sx={{ p: 1.5 }}>
        <ListItemButton onClick={() => setLogoutOpen(true)} sx={{ py: 1 }}>
          <ListItemIcon sx={{ minWidth: 38, color: brand.navIcon }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: '0.92rem', fontWeight: 600, color: brand.navText }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Topbar */}
      <Box
        component="header"
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.drawer + 1,
          width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
          background: brand.headerGradient,
          boxShadow: '0 8px 24px -12px rgba(24, 64, 206, 0.55)',
        }}
      >
        <Toolbar sx={{ minHeight: `${TOPBAR_HEIGHT}px !important`, gap: 1.5, px: { xs: 1.5, md: 3 } }}>
          <IconButton color="inherit" edge="start" onClick={() => setOpen((v) => !v)} sx={{ color: '#fff' }}>
            <MenuIcon />
          </IconButton>

          <Typography
            variant="subtitle1"
            sx={{ color: '#fff', mr: 1, display: { xs: 'none', sm: 'block' } }}
            noWrap
          >
            {admin?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
          </Typography>

          <Box
            sx={{
              flex: 1,
              maxWidth: 460,
              display: { xs: 'none', sm: 'block' },
              position: 'relative',
              zIndex: 2,
              pointerEvents: 'auto',
            }}
          >
            <Autocomplete
              freeSolo
              size="small"
              options={searchResults}
              loading={searching}
              filterOptions={(x) => x}
              groupBy={(o) => (o.__type === 'organization' ? 'Companies' : 'Employees')}
              getOptionLabel={(o) => (typeof o === 'string' ? o : o.name || '')}
              onInputChange={(_e, val) => setSearchInput(val)}
              onChange={(_e, val) => {
                if (!val || typeof val === 'string') return;
                if (val.__type === 'organization') {
                  dispatch(setOrgOverride({ id: val._id, name: val.name, slug: val.slug, active: val.active }));
                  navigate('/');
                } else {
                  navigate('/employees', { state: { q: val.name } });
                }
              }}
              renderOption={(props, option) => {
                const { key, ...rest } = props;
                if (option.__type === 'organization') {
                  return (
                    <Box component="li" key={option._id} {...rest} sx={{ gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '9px',
                          bgcolor: brand.blueSoft,
                          color: brand.blue600,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <ApartmentIcon sx={{ fontSize: 16 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {option.slug}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }
                return (
                  <Box component="li" key={option._id} {...rest} sx={{ gap: 1.25 }}>
                    <InitialsAvatar name={option.name} src={option.profilePhoto} size={30} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        {option.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {[option.employeeId, option.department].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search employees, companies…"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(255,255,255,0.18)',
                      color: '#fff',
                      borderRadius: '10px',
                      fontWeight: 500,
                      '& fieldset': { border: 'none' },
                      '&.Mui-focused fieldset': { border: 'none' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none !important' },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                      '&.Mui-focused': { bgcolor: 'rgba(255,255,255,0.26)' },
                    },
                    '& input::placeholder': { color: 'rgba(255,255,255,0.8)', opacity: 1 },
                  }}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <SearchIcon sx={{ color: 'rgba(255,255,255,0.85)', mr: 1 }} fontSize="small" />
                    ),
                    endAdornment: searching ? (
                      <CircularProgress size={16} sx={{ color: '#fff', mr: 1 }} />
                    ) : null,
                  }}
                />
              )}
            />
          </Box>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ color: '#fff', position: 'relative', zIndex: 2, pointerEvents: 'auto' }}>
            <NotificationsMenu
              items={notifications}
              unreadCount={unreadCount}
              onRefresh={loadNotifications}
            />
          </Box>

          <Tooltip title="Account">
            <IconButton
              onClick={(e) => setUserMenu(e.currentTarget)}
              sx={{
                ml: 0.5,
                gap: 1,
                px: 1,
                py: 0.5,
                borderRadius: '12px',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
              }}
            >
              <InitialsAvatar name={admin?.name || 'Admin'} size={34} sx={{ bgcolor: '#fff', color: brand.blue600, boxShadow: '0 2px 8px -2px rgba(10,30,120,.35)' }} />
              <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'left' }}>
                <Typography
                  variant="body2"
                  sx={{ color: '#fff', fontWeight: 600, lineHeight: 1.15 }}
                  noWrap
                >
                  {admin?.name || 'Admin'}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.15 }}
                  noWrap
                >
                  {admin?.role === 'super_admin' ? 'Super admin' : 'Admin'}
                </Typography>
              </Box>
              <KeyboardArrowDownIcon sx={{ color: '#fff' }} fontSize="small" />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={userMenu}
            open={Boolean(userMenu)}
            onClose={() => setUserMenu(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { minWidth: 240 } } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {admin?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {admin?.email}
              </Typography>
              {organization?.slug && (
                <Chip size="small" label={organization.slug} sx={{ mt: 1 }} />
              )}
            </Box>
            <Divider />
            <MenuItem onClick={() => { setUserMenu(null); setTwoFactorOpen(true); }}>
              <ListItemIcon>
                <SecurityIcon fontSize="small" />
              </ListItemIcon>
              Two-factor authentication
            </MenuItem>
            <MenuItem onClick={() => { setUserMenu(null); setLogoutOpen(true); }}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </Box>

      {/* Sidebar */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={mobile ? 'temporary' : 'permanent'}
          open={open}
          onClose={() => setOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              border: 'none',
              borderRight: '1px solid',
              borderColor: brand.cardBorder,
              backgroundColor: '#fff',
              boxShadow: '4px 0 24px -14px rgba(40, 55, 120, 0.28)',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          position: 'relative',
          p: { xs: 2, md: 3 },
          pt: { xs: `${TOPBAR_HEIGHT + 16}px`, md: `${TOPBAR_HEIGHT + 24}px` },
        }}
      >
        {switching && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: (theme) => theme.zIndex.drawer,
              bgcolor: 'rgba(238,242,253,0.78)',
              backdropFilter: 'blur(1px)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Switching organization…
              </Typography>
            </Box>
          </Box>
        )}
        {!effectiveOrgActive && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              isSuperAdmin ? (
                <Button
                  color="warning"
                  size="small"
                  variant="outlined"
                  onClick={reactivateOrg}
                  disabled={reactivating}
                  startIcon={reactivating ? <CircularProgress size={14} color="inherit" /> : null}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {reactivating ? 'Reactivating…' : 'Reactivate Organization'}
                </Button>
              ) : undefined
            }
          >
            {isSuperAdmin
              ? 'Organization is inactive.'
              : 'This organization is inactive. Please contact the Super Admin to activate it.'}
            {!isSuperAdmin ? '' : ' You can view everything, but editing remains blocked until reactivation.'}
          </Alert>
        )}
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={28} />
            </Box>
          }
        >
          <Outlet key={effectiveOrgId} />
        </Suspense>
      </Box>

      <TwoFactorDialog open={twoFactorOpen} onClose={() => setTwoFactorOpen(false)} />

      {/* Logout confirmation */}
      <Dialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '18px', py: 1 } }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>Log out?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to log out of your account?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setLogoutOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => { setLogoutOpen(false); handleLogout(); }}
            sx={{ minWidth: 100 }}
          >
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}