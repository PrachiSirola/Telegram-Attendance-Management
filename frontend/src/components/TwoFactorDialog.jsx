import { useCallback, useEffect, useState } from 'react';
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
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import api from '../services/api';
import { brand } from '../theme/theme';

const monoSx = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' };

function PasswordField({ value, onChange, label = 'Current password', autoFocus, onEnter }) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      fullWidth
      autoFocus={autoFocus}
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter && onEnter()}
      autoComplete="current-password"
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" edge="end" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}
export default function TwoFactorDialog({ open, onClose }) {
  const [status, setStatus] = useState(null);
  const [view, setView] = useState('home');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(null);
  const [copied, setCopied] = useState('');

  const reset = useCallback(() => {
    setView('home');
    setError('');
    setPassword('');
    setCode('');
    setSetup(null);
    setCopied('');
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/2fa/status');
      setStatus(data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load two-factor status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      reset();
      loadStatus();
    }
  }, [open, reset, loadStatus]);

  const fail = (e, fallback) => setError(e.response?.data?.message || e.message || fallback);

  async function startSetup() {
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/2fa/setup', { password });
      setSetup(data.data);
      setPassword('');
      setCode('');
      setView('scan');
    } catch (e) {
      fail(e, 'Could not start setup');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    if (code.trim().length < 6) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/2fa/enable', { code: code.trim() });
      reset();
      await loadStatus();
    } catch (e) {
      fail(e, 'Could not verify the code');
    } finally {
      setBusy(false);
    }
  }

  async function submitDisable() {
    if (!password || !code.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/2fa/disable', { password, code: code.trim() });
      reset();
      await loadStatus();
    } catch (e) {
      fail(e, 'Could not disable two-factor authentication');
    } finally {
      setBusy(false);
    }
  }

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    } catch {
    }
  }

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const title = {
    home: 'Two-factor authentication',
    password: 'Enable two-factor authentication',
    scan: 'Scan the QR code',
    disable: 'Disable two-factor authentication',
  }[view];

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            display: 'grid',
            placeItems: 'center',
            background: brand.gradient,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <SecurityIcon fontSize="small" />
        </Box>
        {title}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {view === 'home' &&
          (loading && !status ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
              <CircularProgress size={26} />
            </Box>
          ) : status?.enabled ? (
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip size="small" color="success" icon={<VerifiedUserIcon />} label="Enabled" />
                {status.enabledAt && (
                  <Typography variant="caption" color="text.secondary">
                    since {new Date(status.enabledAt).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                You&apos;ll be asked for a 6-digit code from your authenticator app every time you sign in.
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Add a second step to sign-in. After your password you&apos;ll enter a 6-digit code from an authenticator app such as
                Google Authenticator, Microsoft Authenticator or Authy.
              </Typography>
              <Alert severity="info" icon={false}>
                Status: <strong>Not enabled</strong>
              </Alert>
            </Stack>
          ))}

        {view === 'password' && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Confirm your password to start setup.
            </Typography>
            <PasswordField autoFocus value={password} onChange={setPassword} onEnter={startSetup} />
          </Stack>
        )}

        {view === 'scan' && setup && (
          <Stack spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'stretch' }}>
              1. Open your authenticator app and scan this code.
            </Typography>
            <Box
              component="img"
              src={setup.qrDataUrl}
              alt="Two-factor QR code"
              sx={{ width: 200, height: 200, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.5, bgcolor: '#fff' }}
            />
            <Box sx={{ alignSelf: 'stretch' }}>
              <Typography variant="caption" color="text.secondary">
                Can&apos;t scan? Enter this key manually:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" sx={{ ...monoSx, fontWeight: 700, letterSpacing: 1, wordBreak: 'break-all' }}>
                  {setup.manualKey}
                </Typography>
                <Tooltip title={copied === 'key' ? 'Copied' : 'Copy key'}>
                  <IconButton size="small" onClick={() => copy(setup.manualKey.replace(/\s/g, ''), 'key')}>
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'stretch' }}>
              2. Enter the 6-digit code it shows to finish.
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && confirmEnable()}
              inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code', style: { letterSpacing: 6, ...monoSx } }}
            />
          </Stack>
        )}

        {view === 'disable' && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Your account will only be protected by your password. Confirm it&apos;s you:
            </Typography>
            <PasswordField autoFocus value={password} onChange={setPassword} />
            <TextField
              fullWidth
              label="6-digit authenticator code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && submitDisable()}
              inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code', style: { letterSpacing: 6, ...monoSx } }}
            />
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {view === 'home' && (
          <>
            <Button onClick={handleClose}>Close</Button>
            {status?.enabled ? (
              <>
                <Button
                  color="error"
                  variant="outlined"
                  onClick={() => {
                    reset();
                    setView('disable');
                  }}
                >
                  Disable
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                disabled={loading || !status}
                onClick={() => {
                  reset();
                  setView('password');
                }}
              >
                Enable
              </Button>
            )}
          </>
        )}
        {view === 'password' && (
          <>
            <Button onClick={reset} disabled={busy}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={startSetup}
              disabled={!password || busy}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Continue
            </Button>
          </>
        )}
        {view === 'scan' && (
          <>
            <Button onClick={reset} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={confirmEnable}
              disabled={code.length < 6 || busy}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Verify &amp; enable
            </Button>
          </>
        )}
        {view === 'disable' && (
          <>
            <Button onClick={reset} disabled={busy}>
              Back
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={submitDisable}
              disabled={!password || code.length !== 6 || busy}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Disable 2FA
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}