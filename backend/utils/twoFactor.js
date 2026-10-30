const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { authenticator } = require('otplib');
const { twoFactorEncryptionKey, jwtAccessSecret, jwtRefreshSecret } = require('../config/env');

const ISSUER = 'Attendance Management';
const STEP_SECONDS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const CHALLENGE_EXPIRES = '5m';
const SETUP_EXPIRES_MS = 10 * 60 * 1000;

authenticator.options = { digits: 6, step: STEP_SECONDS, window: 1 };

function derive(label, material) {
  return crypto.createHash('sha256').update(`${label}:${material}`).digest();
}

const encKey = derive('2fa-enc', twoFactorEncryptionKey || jwtRefreshSecret);
const challengeKey = derive('2fa-challenge', jwtAccessSecret + jwtRefreshSecret);

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

function decrypt(blob) {
  const [v, iv, tag, ct] = String(blob || '').split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Corrupt 2FA secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}
function generateSecret() {
  return authenticator.generateSecret(20); 
}

async function buildQr(email, secret) {
  const otpauth = authenticator.keyuri(email, ISSUER, secret);
  return QRCode.toDataURL(otpauth, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
}
function matchTotp(secret, token) {
  const t = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(t)) return null;
  let delta;
  try {
    delta = authenticator.checkDelta(t, secret);
  } catch {
    return null;
  }
  if (delta === null || delta === undefined) return null;
  return Math.floor(Date.now() / 1000 / STEP_SECONDS) + delta;
}

function looksLikeTotp(code) {
  return /^\d{6}$/.test(String(code || '').replace(/\s+/g, ''));
}
function signChallenge({ adminId, organizationId, rv }, purpose = '2fa') {
  return jwt.sign(
    { sub: String(adminId), type: purpose, organizationId: organizationId || null, rv },
    challengeKey,
    { expiresIn: CHALLENGE_EXPIRES }
  );
}

function verifyChallenge(token, purpose = '2fa') {
  const d = jwt.verify(token, challengeKey);
  if (d.type !== purpose) throw new Error('Wrong token type');
  return d;
}
const CLEAR_TWO_FACTOR = {
  $set: { twoFactorEnabled: false, twoFactorSetupRequired: false, twoFactorFailedAttempts: 0 },
  $unset: {
    twoFactorEnabledAt: 1,
    twoFactorSecret: 1,
    twoFactorPendingSecret: 1,
    twoFactorPendingExpires: 1,
    twoFactorBackupCodes: 1,
    twoFactorLastStep: 1,
    twoFactorLockUntil: 1,
  },
};

module.exports = {
  CLEAR_TWO_FACTOR,
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
  SETUP_EXPIRES_MS,
  encrypt,
  decrypt,
  generateSecret,
  buildQr,
  matchTotp,
  looksLikeTotp,
  signChallenge,
  verifyChallenge,
};