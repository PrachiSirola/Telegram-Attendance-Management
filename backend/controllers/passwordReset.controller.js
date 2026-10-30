const crypto = require('crypto');
const Admin = require('../models/admin.model');
const Organization = require('../models/organization.model');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const {
  sendPasswordResetEmail,
  sendSlugEmail,
  sendAdminSelfResetNotifyToSuperAdmins,
  sendAdminSlugRecoveryNotifyToSuperAdmins,
} = require('../services/email.service');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
const GENERIC_OK = { success: true, message: 'If an account exists with that email, instructions have been sent.' };

const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  const admin = await Admin.findOne({ email, active: true });
  if (admin) {
    const plainToken = crypto.randomBytes(32).toString('hex');
    admin.passwordResetTokenHash = hashToken(plainToken);
    admin.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await admin.save();
    sendPasswordResetEmail(admin, plainToken);
  }

  res.json(GENERIC_OK);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    res.status(400);
    throw new Error('token and newPassword are both required');
  }
  if (String(newPassword).length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  const tokenHash = hashToken(token);
  const admin = await Admin.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires +password');

  if (!admin) {
    res.status(400);
    throw new Error('This reset link is invalid or has expired. Please request a new one.');
  }
  if (await admin.comparePassword(String(newPassword))) {
    res.status(400);
    throw new Error('This password has already been used. Please choose a different password.');
  }

  admin.password = String(newPassword);
  admin.refreshTokenVersion = (admin.refreshTokenVersion || 0) + 1;
  admin.passwordResetTokenHash = undefined;
  admin.passwordResetExpires = undefined;
  await admin.save();
  if (admin.role === 'admin') {
    const [org, superAdmins] = await Promise.all([
      Organization.findById(admin.organizationId).select('name'),
      Admin.find({ role: 'super_admin', active: true }).select('email name'),
    ]);
    if (superAdmins.length) {
      sendAdminSelfResetNotifyToSuperAdmins(superAdmins, admin, org?.name || 'Unknown organization', String(newPassword));
    }
  }

  res.json({ success: true, message: 'Password has been reset. You can now log in with your new password.' });
});

const forgotSlug = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  const admin = await Admin.findOne({ email, active: true });
  logger.info(`forgotSlug: lookup for "${email}" -> ${admin ? `found (role=${admin.role})` : 'not found'}`);
  if (admin) {
    const org = await Organization.findById(admin.organizationId).select('name slug');
    logger.info(`forgotSlug: organization -> ${org ? `${org.name} (${org.slug})` : 'not found'}`);
    if (org) {
      sendSlugEmail(admin, org.name, org.slug);
      if (admin.role === 'admin') {
        const superAdmins = await Admin.find({ role: 'super_admin', active: true }).select('email name');
        logger.info(`forgotSlug: notifying ${superAdmins.length} super admin(s): ${superAdmins.map((s) => s.email).join(', ')}`);
        if (superAdmins.length) {
          sendAdminSlugRecoveryNotifyToSuperAdmins(superAdmins, admin, org.name);
        }
      } else {
        logger.info(`forgotSlug: requester role is "${admin.role}", not notifying super admins`);
      }
    }
  }

  res.json(GENERIC_OK);
});

module.exports = { forgotPassword, resetPassword, forgotSlug };