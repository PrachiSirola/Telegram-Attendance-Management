import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import api from '../services/api';
export default function TelegramBotSettingsCard({ description }) {
  const [botSettings, setBotSettings] = useState({ chatId: '', hasToken: false, webhookRegistered: false });
  const [botForm, setBotForm] = useState({ botToken: '', chatId: '' });
  const [botLoading, setBotLoading] = useState(true);
  const [botSaving, setBotSaving] = useState(false);
  const [botError, setBotError] = useState('');
  const [botEditing, setBotEditing] = useState(false);
  const [botEditConfirmOpen, setBotEditConfirmOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState('');
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [revealingToken, setRevealingToken] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadBotSettings();
  }, []);

  async function loadBotSettings() {
    setBotLoading(true);
    try {
      const { data } = await api.get('/telegram-bot/settings');
      setBotSettings(data.data);
      setBotForm({ botToken: '', chatId: data.data.chatId || '' });
    } catch {
    } finally {
      setBotLoading(false);
    }
  }

  async function toggleRevealToken() {
    if (botEditing) {
      setTokenRevealed((v) => !v);
      return;
    }
    if (tokenRevealed) {
      setTokenRevealed(false);
      setRevealedToken('');
      return;
    }
    setRevealingToken(true);
    try {
      const { data } = await api.get('/telegram-bot/settings/token');
      setRevealedToken(data.data.botToken || '');
      setTokenRevealed(true);
    } catch (e) {
      setBotError(e.response?.data?.message || e.message || 'Could not reveal the bot token');
    } finally {
      setRevealingToken(false);
    }
  }

  function startEditBotSettings() {
    setBotEditing(true);
    setBotForm({ botToken: '', chatId: botSettings.chatId || '' });
  }

  function cancelEditBotSettings() {
    setBotEditing(false);
    setTokenRevealed(false);
    setRevealedToken('');
    setBotError('');
    setBotForm({ botToken: '', chatId: botSettings.chatId || '' });
  }

  function requestSaveBotSettings() {
    setBotEditConfirmOpen(true);
  }

  async function confirmSaveBotSettings() {
    setBotEditConfirmOpen(false);
    setBotSaving(true);
    setBotError('');
    try {
      const { data } = await api.patch('/telegram-bot/settings', {
        botToken: botForm.botToken,
        chatId: botForm.chatId,
      });
      setBotSettings(data.data);
      setBotForm({ botToken: '', chatId: data.data.chatId || '' });
      setBotEditing(false);
      setTokenRevealed(false);
      setRevealedToken('');
      if (data.data.webhookError) {
        setBotError(
          `Bot token and chat ID saved, but Approve/Reject buttons won't work yet: ${data.data.webhookError}`
        );
      } else {
        setToast('Telegram settings saved');
      }
    } catch (e) {
      setBotError(e.response?.data?.message || e.message || 'Could not save Telegram settings');
    } finally {
      setBotSaving(false);
    }
  }

  return (
    <>
      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: '0.05em' }}>
              TELEGRAM NOTIFICATIONS
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
              {description ||
                "Create a bot via @BotFather, add it to your own chat, and paste the details below. You'll get a live feed of punch-ins, breaks, and leave activity."}
            </Typography>
            {botSettings.hasToken && (
              <Chip
                size="small"
                label={botSettings.webhookRegistered ? 'Approve/Reject buttons active' : 'Buttons not active yet'}
                color={botSettings.webhookRegistered ? 'success' : 'warning'}
                variant="outlined"
                sx={{ mb: 1 }}
              />
            )}
          </Box>
          {!botEditing && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon fontSize="small" />}
              onClick={startEditBotSettings}
              disabled={botLoading}
              sx={{ flexShrink: 0 }}
            >
              Edit
            </Button>
          )}
        </Box>
        {botError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBotError('')}>
            {botError}
          </Alert>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField
            label="Bot token"
            size="small"
            placeholder={
              botEditing
                ? botSettings.hasToken
                  ? 'Leave blank to keep the current token'
                  : '123456:ABC...'
                : botSettings.hasToken
                ? ''
                : 'Not configured'
            }
            value={
              botEditing
                ? botForm.botToken
                : botSettings.hasToken
                ? tokenRevealed
                  ? revealedToken
                  : '•'.repeat(24)
                : ''
            }
            onChange={(e) => setBotForm({ ...botForm, botToken: e.target.value })}
            disabled={botLoading}
            type={botEditing && !tokenRevealed ? 'password' : 'text'}
            InputProps={{
              readOnly: !botEditing,
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={tokenRevealed ? 'Hide token' : 'Show token'}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={toggleRevealToken}
                        disabled={
                          revealingToken || (!botEditing && !botSettings.hasToken) || (botEditing && !botForm.botToken)
                        }
                      >
                        {revealingToken ? (
                          <CircularProgress size={16} />
                        ) : tokenRevealed ? (
                          <VisibilityOffIcon fontSize="small" />
                        ) : (
                          <VisibilityIcon fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
            fullWidth
          />
          <TextField
            label="Chat ID"
            size="small"
            placeholder="Not configured"
            value={botEditing ? botForm.chatId : botSettings.chatId || ''}
            onChange={(e) => setBotForm({ ...botForm, chatId: e.target.value })}
            disabled={botLoading}
            InputProps={{ readOnly: !botEditing }}
            fullWidth
          />
        </Box>
        {botEditing && (
          <Box sx={{ display: 'flex', gap: 1.25, mt: 2 }}>
            <Button
              variant="contained"
              onClick={requestSaveBotSettings}
              disabled={botSaving}
              startIcon={botSaving ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {botSaving ? 'Saving…' : 'Save settings'}
            </Button>
            <Button onClick={cancelEditBotSettings} disabled={botSaving}>
              Cancel
            </Button>
          </Box>
        )}
      </Paper>

      {/* Confirm before saving Telegram bot settings */}
      <Dialog open={botEditConfirmOpen} onClose={() => setBotEditConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1">Are you sure you want to edit this?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setBotEditConfirmOpen(false)} disabled={botSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmSaveBotSettings}
            disabled={botSaving}
            startIcon={botSaving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {botSaving ? 'Saving…' : 'Confirm'}
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
    </>
  );
}