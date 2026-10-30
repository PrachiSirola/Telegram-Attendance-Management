import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import TimelineIcon from '@mui/icons-material/Timeline';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import api from '../services/api';
import { setCredentials } from '../redux/slices/authSlice';
import { connectSocket } from '../services/socket';
import { brand } from '../theme/theme';

const HIGHLIGHTS = [
  { icon: <EventAvailableIcon />, title: 'Attendance from Telegram', body: 'Punch in and out without another app to install.' },
  { icon: <TimelineIcon />, title: 'Live activity trail', body: 'Breaks, task updates and proof photos as they happen.' },
  { icon: <BeachAccessIcon />, title: 'Leave in one place', body: 'Requests, balances and approvals together.' },
];

const DEFAULT_SLUG = (import.meta.env.VITE_DEFAULT_SLUG || 'default').trim().toLowerCase();

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [slug, setSlug] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState('');
  const [setupToken, setSetupToken] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [forgotMode, setForgotMode] = useState(null); 
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from?.pathname || '/';

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        email,
        password,
        slug: slug.trim() || undefined,
      });
      if (data.data.twoFactorRequired) {
        setChallenge(data.data.challengeToken);
        setOtp('');
        setPassword(''); 
        return;
      }
      if (data.data.twoFactorSetupRequired) {
        const token = data.data.setupToken;
        const res = await api.post('/auth/2fa/setup-login/start', { setupToken: token }, { _retry: true });
        setSetupData(res.data.data);
        setSetupToken(token);
        setOtp('');
        setPassword('');
        return;
      }
      finishLogin(data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function finishLogin({ admin, organization, accessToken, refreshToken }) {
    dispatch(setCredentials({ admin, organization, accessToken, refreshToken }));
    connectSocket();
    navigate(from, { replace: true });
  }

  async function onVerifyOtp(e) {
    e.preventDefault();
    if (!otp.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { data } = setupToken
        ? await api.post('/auth/2fa/setup-login/enable', { setupToken, code: otp.trim() }, { _retry: true })
        : await api.post('/auth/2fa/verify-login', { challengeToken: challenge, code: otp.trim() }, { _retry: true });
      finishLogin(data.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Verification failed';
      setError(msg);
      if (/expired|sign in again/i.test(msg)) backToSignIn(true);
      else setOtp('');
    } finally {
      setLoading(false);
    }
  }

  function backToSignIn(keepError) {
    setChallenge(null);
    setSetupToken(null);
    setSetupData(null);
    setOtp('');
    if (!keepError) setError('');
  }

  function openForgot(mode) {
    setForgotMode(mode);
    setForgotEmail(email);
    setForgotResult('');
  }

  function closeForgot() {
    setForgotMode(null);
    setForgotResult('');
  }

  async function submitForgot() {
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      const endpoint = forgotMode === 'password' ? '/auth/forgot-password' : '/auth/forgot-slug';
      const { data } = await api.post(endpoint, { email: forgotEmail.trim() });
      setForgotResult(data.message || 'If an account exists with that email, instructions have been sent.');
    } catch (err) {
      setForgotResult(err.response?.data?.message || err.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
        bgcolor: 'background.default',
      }}
    >
      {/* Brand panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          p: 7,
          color: '#fff',
          background: brand.gradient,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            width: 460,
            height: 460,
            borderRadius: '50%',
            top: -160,
            right: -140,
            background: 'rgba(255,255,255,0.08)',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            bottom: -110,
            left: -80,
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              width: 54,
              height: 54,
              borderRadius: '15px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(255,255,255,0.18)',
              mb: 3,
            }}
          >
            <HowToRegIcon sx={{ fontSize: 30 }} />
          </Box>
          <Typography variant="h4" sx={{ mb: 1.5, maxWidth: 420 }}>
            Attendance, tracked where your team already is.
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.85, mb: 5, maxWidth: 420 }}>
            Employees check in through Telegram. You manage everything from here.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 400 }}>
            {HIGHLIGHTS.map((h) => (
              <Box key={h.title} sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '11px',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'rgba(255,255,255,0.16)',
                    flexShrink: 0,
                  }}
                >
                  {h.icon}
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {h.title}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.82 }}>
                    {h.body}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Form panel */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2.5, sm: 5 } }}>
        <Paper sx={{ p: { xs: 3, sm: 4.5 }, width: '100%', maxWidth: 440, boxShadow: 3 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '13px',
              background: brand.gradient,
              display: { xs: 'grid', md: 'none' },
              placeItems: 'center',
              mb: 2.5,
            }}
          >
            <HowToRegIcon sx={{ color: '#fff', fontSize: 26 }} />
          </Box>

          <Typography variant="h5" gutterBottom>
            {setupToken ? 'Set up two-step verification' : challenge ? 'Two-step verification' : 'Welcome back'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {setupToken
              ? 'Your two-step verification was reset. Set up a new authenticator to continue.'
              : challenge
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'Sign in to your organization\u2019s admin dashboard.'}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {challenge || setupToken ? (
            <Box component="form" onSubmit={onVerifyOtp} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {setupToken && setupData && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'stretch' }}>
                    1. Scan this QR code with Google Authenticator, Microsoft Authenticator or Authy.
                  </Typography>
                  <Box
                    component="img"
                    src={setupData.qrDataUrl}
                    alt="Two-factor QR code"
                    sx={{ width: 180, height: 180, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.5, bgcolor: '#fff' }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'stretch' }}>
                    Can&apos;t scan? Enter this key manually:
                    <Box component="span" sx={{ display: 'block', fontWeight: 700, letterSpacing: 1, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', wordBreak: 'break-all', color: 'text.primary' }}>
                      {setupData.manualKey}
                    </Box>
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'stretch' }}>
                    2. Enter the 6-digit code it shows.
                  </Typography>
                </Box>
              )}
              <TextField
                fullWidth
                autoFocus
                label="Authentication code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                inputProps={{
                  inputMode: 'numeric',
                  maxLength: 6,
                  style: { letterSpacing: 8, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontWeight: 600 },
                }}
                placeholder="000000"
                required
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 0.5, py: 1.35 }}
                disabled={loading || otp.length !== 6}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {loading ? 'Verifying…' : setupToken ? 'Verify & continue' : 'Verify & sign in'}
              </Button>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={() => backToSignIn(false)}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  <ArrowBackIcon sx={{ fontSize: 15 }} /> Back to sign in
                </Link>
              </Box>
            </Box>
          ) : (
          <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Firm slug (optional for Super Admin)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              helperText={`Required for Admin login — e.g. ${DEFAULT_SLUG}. Leave blank if you're signing in as Super Admin.`}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      size="small"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 0.5, py: 1.35 }}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Link component="button" type="button" variant="body2" onClick={() => openForgot('password')}>
                Forgot password?
              </Link>
              <Link component="button" type="button" variant="body2" onClick={() => openForgot('slug')}>
                Forgot slug?
              </Link>
            </Box>
          </Box>
          )}
        </Paper>
      </Box>

      <Dialog open={!!forgotMode} onClose={closeForgot} maxWidth="xs" fullWidth>
        <DialogTitle>{forgotMode === 'password' ? 'Reset your password' : 'Recover your organization slug'}</DialogTitle>
        <DialogContent>
          {forgotResult ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              {forgotResult}
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {forgotMode === 'password'
                  ? "Enter your registered email and we'll send you a link to reset your password."
                  : "Enter your registered email and we'll send your organization's login slug to it."}
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label="Email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitForgot()}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeForgot}>{forgotResult ? 'Close' : 'Cancel'}</Button>
          {!forgotResult && (
            <Button
              variant="contained"
              onClick={submitForgot}
              disabled={!forgotEmail.trim() || forgotLoading}
              startIcon={forgotLoading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {forgotLoading ? 'Sending…' : 'Send'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}