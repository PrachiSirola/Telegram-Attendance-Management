const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { login, refresh, logout } = require('../../controllers/auth.controller');
const { forgotPassword, resetPassword, forgotSlug } = require('../../controllers/passwordReset.controller');
const {
  verifyLogin,
  setupLoginStart,
  setupLoginEnable,
  status: twoFactorStatus,
  setup: twoFactorSetup,
  enable: twoFactorEnable,
  disable: twoFactorDisable,
} = require('../../controllers/twoFactor.controller');
const { protect } = require('../../middlewares/auth');

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/login',
  authLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('organizationId').optional().isMongoId(),
  body('slug').optional().isString().trim(),
  login
);
router.post('/refresh', authLimiter, refresh);
const twoFactorLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});
const twoFactorManageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.admin ? String(req.admin._id) : req.ip),
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});
const codeField = body('code').isString().trim().matches(/^\d{6}$/).withMessage('Enter the 6-digit code from your authenticator app');
const passwordField = body('password').isString().notEmpty().withMessage('Password is required');

router.post(
  '/2fa/verify-login',
  twoFactorLoginLimiter,
  body('challengeToken').isString().isLength({ min: 20, max: 2000 }).withMessage('Sign in again'),
  codeField,
  verifyLogin
);
const setupTokenField = body('setupToken').isString().isLength({ min: 20, max: 2000 }).withMessage('Sign in again');
router.post('/2fa/setup-login/start', twoFactorLoginLimiter, setupTokenField, setupLoginStart);
router.post('/2fa/setup-login/enable', twoFactorLoginLimiter, setupTokenField, codeField, setupLoginEnable);
router.get('/2fa/status', protect, twoFactorStatus);
router.post('/2fa/setup', protect, twoFactorManageLimiter, passwordField, twoFactorSetup);
router.post('/2fa/enable', protect, twoFactorManageLimiter, codeField, twoFactorEnable);
router.post('/2fa/disable', protect, twoFactorManageLimiter, passwordField, codeField, twoFactorDisable);
router.post('/logout', protect, logout);

router.post('/forgot-password', recoveryLimiter, body('email').isEmail().normalizeEmail(), forgotPassword);
router.post(
  '/reset-password',
  recoveryLimiter,
  body('token').isString().notEmpty(),
  body('newPassword').isLength({ min: 6 }),
  resetPassword
);
router.post('/forgot-slug', recoveryLimiter, body('email').isEmail().normalizeEmail(), forgotSlug);

module.exports = router;