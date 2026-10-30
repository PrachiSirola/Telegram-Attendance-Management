export function checkPasswordRules(password) {
  const value = password || '';
  return {
    hasLength: value.length >= 8 && value.length <= 18,
    hasUpper: /[A-Z]/.test(value),
    hasLower: /[a-z]/.test(value),
    hasNumber: /[0-9]/.test(value),
    hasSpecial: /[^A-Za-z0-9]/.test(value),
  };
}

export function isPasswordStrong(password) {
  const r = checkPasswordRules(password);
  return r.hasLength && r.hasUpper && r.hasLower && r.hasNumber && r.hasSpecial;
}