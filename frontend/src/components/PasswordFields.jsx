import { useEffect, useState } from 'react';
import { Box, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { checkPasswordRules } from '../utils/password';

const RULES = [
  { key: 'hasLength', label: '8–18 characters' },
  { key: 'hasUpper', label: 'At least 1 uppercase letter' },
  { key: 'hasLower', label: 'At least 1 lowercase letter' },
  { key: 'hasNumber', label: 'At least 1 number' },
  { key: 'hasSpecial', label: 'At least 1 special character/symbol' },
];
export default function PasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmChange,
  onValidityChange,
  required = true,
  passwordLabel = 'Password',
  gridColumn,
}) {
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const rules = checkPasswordRules(password);
  const allRulesMet = rules.hasLength && rules.hasUpper && rules.hasLower && rules.hasNumber && rules.hasSpecial;
  const isEmpty = !password;
  const matches = password === confirmPassword;

  const valid = required
    ? allRulesMet && matches && !!confirmPassword
    : isEmpty || (allRulesMet && matches);

  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid]);

  return (
    <>
      <TextField
        label={passwordLabel}
        type={showPw ? 'text' : 'password'}
        size="small"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        sx={{ gridColumn }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setShowPw((v) => !v)} edge="end">
                {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      {!isEmpty && (
        <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 0.25, mt: -1 }}>
          {RULES.map((rule) => {
            const met = rules[rule.key];
            return (
              <Box key={rule.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {met ? (
                  <CheckCircleIcon sx={{ fontSize: 15, color: 'success.main' }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                )}
                <Typography variant="caption" color={met ? 'success.main' : 'text.secondary'}>
                  {rule.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      <TextField
        label="Confirm password"
        type={showConfirm ? 'text' : 'password'}
        size="small"
        value={confirmPassword}
        onChange={(e) => onConfirmChange(e.target.value)}
        error={!!confirmPassword && !matches}
        helperText={confirmPassword && !matches ? 'Passwords do not match' : ' '}
        sx={{ gridColumn }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setShowConfirm((v) => !v)} edge="end">
                {showConfirm ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </>
  );
}