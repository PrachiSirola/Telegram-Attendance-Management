import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Box, CircularProgress, Paper, Snackbar, Switch, Typography } from '@mui/material';
import PageHeader from '../components/PageHeader';
import api from '../services/api';

export default function OrgFeatureSettingsPage() {
  const admin = useSelector((s) => s.auth.admin);
  const allowed = !!admin?.canEditOrgFeatureToggles;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [org, setOrg] = useState({ id: null, name: '', locationSharingEnabled: false, imageCaptureEnabled: false });

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get('/organizations/current');
        setOrg({
          id: data.data.id,
          name: data.data.name,
          locationSharingEnabled: !!data.data.locationSharingEnabled,
          imageCaptureEnabled: !!data.data.imageCaptureEnabled,
        });
      } catch (e) {
        setError(e.response?.data?.message || e.message || 'Could not load organization settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [allowed]);

  async function saveToggle(field, value) {
    setOrg((prev) => ({ ...prev, [field]: value }));
    setSaving(true);
    setError('');
    try {
      await api.patch(`/organizations/${org.id}/feature-toggles`, { [field]: value });
      setToast('Settings saved');
    } catch (e) {

      setOrg((prev) => ({ ...prev, [field]: !value }));
      setError(e.response?.data?.message || e.message || 'Could not save this setting');
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <Box>
        <PageHeader title="Organization Settings" subtitle="Punch-in location and selfie settings" />
        <Alert severity="warning">
          You don&apos;t have permission to edit organization details. Ask your Super Admin to grant it from Manage
          Admin.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Organization Settings"
        subtitle={org.name ? `Punch-in settings for ${org.name}` : 'Punch-in location and selfie settings'}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Paper sx={{ p: 2.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                checked={org.locationSharingEnabled}
                disabled={saving}
                onChange={(e) => saveToggle('locationSharingEnabled', e.target.checked)}
              />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Location Sharing
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Employees must share their location during punch-in on Telegram. If an office location is
                  configured, punch-in is blocked outside the allowed radius.
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
                checked={org.imageCaptureEnabled}
                disabled={saving}
                onChange={(e) => saveToggle('imageCaptureEnabled', e.target.checked)}
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
          </Box>
        )}
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
