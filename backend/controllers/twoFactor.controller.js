const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Admin = require('../models/admin.model');
const Organization = require('../models/organization.model');
const asyncHandler = require('../utils/asyncHandler');
const { buildSession } = require('../utils/session');
const tf = require('../utils/twoFactor');
const SENSITIVE =
  '+password +twoFactorSecret +twoFactorPendingSecret +twoFactorPendingExpires ' +
  '+twoFactorLastStep +twoFactorFailedAttempts +twoFactorLockUntil';

const EXPIRED_MSG = 'Your sign-in session expired. Please sign in again.';

function fail(res, status, message) {
  res.status(status);
  return new Error(message);
}

function checkValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw fail(res, 400, errors.array()[0].msg);
}

function lockedError(res, until) {
  const mins = Math.max(1, Math.ceil(((until ? new Date(until).getTime() : Date.now()) - Date.now()) / 60000));
  return fail(res, 429, `Too many incorrect codes. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
}

const notLockedFilter = () => ({
  $or: [
    { twoFactorLockUntil: { $exists: false } },
    { twoFactorLockUntil: null },
    { twoFactorLockUntil: { $lte: new Date(Date.now()) } },
  ],
});
async function reserveAttempt(adminId, res) {
  const res1 = await Admin.collection.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(String(adminId)), ...notLockedFilter() },
    { $inc: { twoFactorFailedAttempts: 1 } },
    { returnDocument: 'after' }
  );
  const slot = res1 && Object.prototype.hasOwnProperty.call(res1, 'value') ? res1.value : res1;
  const doc = slot ? await Admin.findById(adminId).select(SENSITIVE) : null;
  if (!doc) {
    const cur = await Admin.findById(adminId).select('+twoFactorLockUntil');
    if (!cur) throw fail(res, 401, 'Not authorized');
    throw lockedError(res, cur.twoFactorLockUntil);
  }
  doc.twoFactorFailedAttempts = slot.twoFactorFailedAttempts;
  if (slot.twoFactorFailedAttempts > tf.MAX_FAILED_ATTEMPTS) {
    const until = new Date(Date.now() + tf.LOCK_MINUTES * 60000);
    await Admin.updateOne({ _id: doc._id }, { $set: { twoFactorLockUntil: until, twoFactorFailedAttempts: 0 } });
    throw lockedError(res, until);
  }
  return doc;
}
async function recordFailure(doc, res, status = 401, message = 'Invalid verification code') {
  if (doc.twoFactorFailedAttempts >= tf.MAX_FAILED_ATTEMPTS) {
    const until = new Date(Date.now() + tf.LOCK_MINUTES * 60000);
    await Admin.updateOne({ _id: doc._id }, { $set: { twoFactorLockUntil: until, twoFactorFailedAttempts: 0 } });
    return lockedError(res, until);
  }
  const left = tf.MAX_FAILED_ATTEMPTS - doc.twoFactorFailedAttempts;
  return fail(res, status, `${message}. ${left} attempt${left === 1 ? '' : 's'} left.`);
}

function clearAttempts(id) {
  return Admin.collection.updateOne(
    { _id: id },
    { $set: { twoFactorFailedAttempts: 0 }, $unset: { twoFactorLockUntil: 1, twoFactorBackupCodes: 1 } }
  );
}
async function verifyTotp(doc, rawCode) {
  if (!doc.twoFactorSecret) return false;
  const step = tf.matchTotp(tf.decrypt(doc.twoFactorSecret), String(rawCode || ''));
  if (step === null) return false;
  const r = await Admin.updateOne(
    {
      _id: doc._id,
      $or: [
        { twoFactorLastStep: { $exists: false } },
        { twoFactorLastStep: null },
        { twoFactorLastStep: { $lt: step } },
      ],
    },
    { $set: { twoFactorLastStep: step } }
  );
  return r.modifiedCount === 1;
}

async function verifyPassword(req, res) {
  const doc = await Admin.findById(req.admin._id).select('+password');
  if (!doc || !(await doc.comparePassword(String(req.body.password || '')))) {
    throw fail(res, 403, 'Incorrect password');
  }
}

async function orgFromChallenge(challenge, res) {
  if (!challenge.organizationId) return null;
  const org = await Organization.findById(challenge.organizationId);
  if (!org) throw fail(res, 401, EXPIRED_MSG);
  return org;
}
const verifyLogin = asyncHandler(async (req, res) => {
  checkValidation(req, res);
  let challenge;
  try {
    challenge = tf.verifyChallenge(req.body.challengeToken);
  } catch {
    throw fail(res, 401, EXPIRED_MSG);
  }
  const doc = await reserveAttempt(challenge.sub, res);
  const adminOrg = doc.organizationId ? String(doc.organizationId) : null;
  if (
    !doc.active ||
    !doc.twoFactorEnabled ||
    doc.refreshTokenVersion !== challenge.rv ||
    adminOrg !== (challenge.organizationId || null)
  ) {
    throw fail(res, 401, EXPIRED_MSG);
  }
  if (!(await verifyTotp(doc, req.body.code))) throw await recordFailure(doc, res);
  await clearAttempts(doc._id);

  const org = await orgFromChallenge(challenge, res);
  res.json({ success: true, data: buildSession(doc, org) });
});
function readSetupToken(req, res) {
  try {
    return tf.verifyChallenge(req.body.setupToken, '2fa-setup');
  } catch {
    throw fail(res, 401, EXPIRED_MSG);
  }
}

function assertSetupAllowed(doc, challenge, res) {
  const adminOrg = doc.organizationId ? String(doc.organizationId) : null;
  if (
    !doc.active ||
    doc.twoFactorEnabled ||
    !doc.twoFactorSetupRequired ||
    doc.refreshTokenVersion !== challenge.rv ||
    adminOrg !== (challenge.organizationId || null)
  ) {
    throw fail(res, 401, EXPIRED_MSG);
  }
}

async function beginEnrolment(doc) {
  const secret = tf.generateSecret();
  await Admin.updateOne(
    { _id: doc._id },
    {
      $set: {
        twoFactorPendingSecret: tf.encrypt(secret),
        twoFactorPendingExpires: new Date(Date.now() + tf.SETUP_EXPIRES_MS),
      },
    }
  );
  return {
    qrDataUrl: await tf.buildQr(doc.email, secret),
    manualKey: secret.match(/.{1,4}/g).join(' '),
    expiresInSeconds: tf.SETUP_EXPIRES_MS / 1000,
  };
}

const setupLoginStart = asyncHandler(async (req, res) => {
  checkValidation(req, res);
  const challenge = readSetupToken(req, res);
  const doc = await Admin.findById(challenge.sub);
  if (!doc) throw fail(res, 401, EXPIRED_MSG);
  assertSetupAllowed(doc, challenge, res);
  res.json({ success: true, data: await beginEnrolment(doc) });
});

const setupLoginEnable = asyncHandler(async (req, res) => {
  checkValidation(req, res);
  const challenge = readSetupToken(req, res);
  const doc = await reserveAttempt(challenge.sub, res);
  assertSetupAllowed(doc, challenge, res);
  if (!doc.twoFactorPendingSecret || !doc.twoFactorPendingExpires || doc.twoFactorPendingExpires.getTime() < Date.now()) {
    throw fail(res, 400, 'Setup expired. Please start again.');
  }
  const step = tf.matchTotp(tf.decrypt(doc.twoFactorPendingSecret), req.body.code);
  if (step === null) throw await recordFailure(doc, res);

  const r = await Admin.updateOne(
    { _id: doc._id, twoFactorEnabled: { $ne: true } },
    {
      $set: {
        twoFactorEnabled: true,
        twoFactorEnabledAt: new Date(Date.now()),
        twoFactorSetupRequired: false,
        twoFactorSecret: doc.twoFactorPendingSecret,
        twoFactorLastStep: step,
        twoFactorFailedAttempts: 0,
      },
      $unset: { twoFactorPendingSecret: 1, twoFactorPendingExpires: 1, twoFactorLockUntil: 1 },
    }
  );
  if (r.modifiedCount !== 1) throw fail(res, 401, EXPIRED_MSG);
  const org = await orgFromChallenge(challenge, res);
  doc.twoFactorEnabled = true;
  res.json({ success: true, data: buildSession(doc, org) });
});
const status = asyncHandler(async (req, res) => {
  const a = await Admin.findById(req.admin._id).select('twoFactorEnabled twoFactorEnabledAt');
  res.json({
    success: true,
    data: { enabled: !!a.twoFactorEnabled, enabledAt: a.twoFactorEnabledAt || null },
  });
});

const setup = asyncHandler(async (req, res) => {
  checkValidation(req, res);
  if (req.admin.twoFactorEnabled) throw fail(res, 400, 'Two-factor authentication is already enabled.');
  await verifyPassword(req, res);
  res.json({ success: true, data: await beginEnrolment(req.admin) });
});

const enable = asyncHandler(async (req, res) => {
  checkValidation(req, res);
  const doc = await reserveAttempt(req.admin._id, res);
  if (doc.twoFactorEnabled) throw fail(res, 400, 'Two-factor authentication is already enabled.');
  if (!doc.twoFactorPendingSecret || !doc.twoFactorPendingExpires || doc.twoFactorPendingExpires.getTime() < Date.now()) {
    throw fail(res, 400, 'Setup expired. Please start again.');
  }
  const step = tf.matchTotp(tf.decrypt(doc.twoFactorPendingSecret), req.body.code);
  if (step === null) throw await recordFailure(doc, res, 403);

  const r = await Admin.updateOne(
    { _id: doc._id, twoFactorEnabled: { $ne: true } },
    {
      $set: {
        twoFactorEnabled: true,
        twoFactorEnabledAt: new Date(Date.now()),
        twoFactorSecret: doc.twoFactorPendingSecret,
        twoFactorLastStep: step,
        twoFactorFailedAttempts: 0,
      },
      $unset: { twoFactorPendingSecret: 1, twoFactorPendingExpires: 1, twoFactorLockUntil: 1 },
    }
  );
  if (r.modifiedCount !== 1) throw fail(res, 400, 'Two-factor authentication is already enabled.');
  res.json({ success: true, message: 'Two-factor authentication enabled.' });
});

const disable = asyncHandler(async (req, res) => {
  checkValidation(req, res);
  if (!req.admin.twoFactorEnabled) throw fail(res, 400, 'Two-factor authentication is not enabled.');
  await verifyPassword(req, res);
  const doc = await reserveAttempt(req.admin._id, res);
  if (!(await verifyTotp(doc, req.body.code))) throw await recordFailure(doc, res, 403);
  await Admin.updateOne({ _id: req.admin._id }, tf.CLEAR_TWO_FACTOR, { strict: false });
  res.json({ success: true, message: 'Two-factor authentication disabled.' });
});

module.exports = { verifyLogin, setupLoginStart, setupLoginEnable, status, setup, enable, disable };