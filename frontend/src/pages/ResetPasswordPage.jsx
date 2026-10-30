import { useState } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Paper, Typography, Link } from '@mui/material';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LockResetIcon from '@mui/icons-material/LockReset';
import api from '../services/api';
import PasswordFields from '../components/PasswordFields';
import { brand } from '../theme/theme';

export default function ResetPasswordPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const linkLooksValid = !!token;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not reset your password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2.5, sm: 5 },
        bgcolor: 'background.default',
      }}
    >
      <Paper sx={{ p: { xs: 3, sm: 4.5 }, width: '100%', maxWidth: 440, boxShadow: 3 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '13px',
            background: brand.gradient,
            display: 'grid',
            placeItems: 'center',
            mb: 2.5,
          }}
        >
          {done ? <HowToRegIcon sx={{ color: '#fff', fontSize: 26 }} /> : <LockResetIcon sx={{ color: '#fff', fontSize: 26 }} />}
        </Box>

        {!linkLooksValid ? (
          <>
            <Typography variant="h5" gutterBottom>
              Invalid link
            </Typography>
            <Alert severity="error" sx={{ mt: 1 }}>
              This reset link is missing required information. Please request a new one from the login page.
            </Alert>
          </>
        ) : done ? (
          <>
            <Typography variant="h5" gutterBottom>
              Password reset
            </Typography>
            <Alert severity="success" sx={{ mt: 1, mb: 2 }}>
              Your password has been reset. You can now log in with your new password.
            </Alert>
            <Button fullWidth variant="contained" size="large" onClick={() => navigate('/login')}>
              Go to login
            </Button>
          </>
        ) : (
          <>
            <Typography variant="h5" gutterBottom>
              Set a new password
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              This link is single-use and expires 30 minutes after it was sent.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <PasswordFields
                password={password}
                confirmPassword={confirmPassword}
                onPasswordChange={setPassword}
                onConfirmChange={setConfirmPassword}
                onValidityChange={setValid}
                required
                passwordLabel="New password"
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 0.5, py: 1.35 }}
                disabled={!valid || loading}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {loading ? 'Saving…' : 'Reset password'}
              </Button>
            </Box>
          </>
        )}

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Link component={RouterLink} to="/login" variant="body2">
            Back to login
          </Link>
        </Box>
      </Paper>
    </Box>
  );
}