const { validationResult } = require('express-validator');
const Admin = require('../models/admin.model');
const Organization = require('../models/organization.model');
const { signAccess, verifyRefresh } = require('../utils/jwt');
const { buildSession } = require('../utils/session');
const { signChallenge } = require('../utils/twoFactor');
const asyncHandler = require('../utils/asyncHandler');

async function resolveOrganization(body) {
  if (body.organizationId) {
    const org = await Organization.findById(body.organizationId);
    return org;
  }
  if (body.slug) {
    return Organization.findOne({ slug: String(body.slug).toLowerCase().trim() });
  }
  return null;
}

const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0].msg);
  }
  const { email, password } = req.body;
  const hasOrgInput = !!(req.body.organizationId || req.body.slug);
  const org = hasOrgInput ? await resolveOrganization(req.body) : null;
  if (hasOrgInput && !org) {
    res.status(400);
    throw new Error('Invalid organization slug');
  }
  const admin = org
    ? await Admin.findOne({ email, organizationId: org._id }).select('+password')
    : await Admin.findOne({ email, role: 'super_admin', organizationId: null }).select('+password');

  if (!admin || !(await admin.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid credentials');
  }
  if (admin.role !== 'super_admin' && !org) {
    res.status(400);
    throw new Error('Organization slug is required for Admin login.');
  }
  if (!admin.active) {
    res.status(403);
    throw new Error('Account disabled');
  }
  if (admin.twoFactorEnabled) {
    return res.json({
      success: true,
      data: {
        twoFactorRequired: true,
        challengeToken: signChallenge({
          adminId: admin._id,
          organizationId: org ? org._id.toString() : null,
          rv: admin.refreshTokenVersion,
        }),
      },
    });
  }
  if (admin.twoFactorSetupRequired) {
    return res.json({
      success: true,
      data: {
        twoFactorSetupRequired: true,
        setupToken: signChallenge(
          { adminId: admin._id, organizationId: org ? org._id.toString() : null, rv: admin.refreshTokenVersion },
          '2fa-setup'
        ),
      },
    });
  }
  res.json({ success: true, data: buildSession(admin, org) });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400);
    throw new Error('refreshToken required');
  }
  let decoded;
  try {
    decoded = verifyRefresh(refreshToken);
  } catch {
    res.status(401);
    throw new Error('Invalid refresh token');
  }
  if (decoded.type !== 'admin') {
    res.status(401);
    throw new Error('Invalid token');
  }
  const admin = await Admin.findById(decoded.sub).select('+password');
  if (!admin || !admin.active) {
    res.status(401);
    throw new Error('Not authorized');
  }
  if (decoded.rv !== admin.refreshTokenVersion) {
    res.status(401);
    throw new Error('Refresh token revoked');
  }
  const adminOrgId = admin.organizationId ? String(admin.organizationId) : null;
  const tokenOrgId = decoded.organizationId || null;
  if (adminOrgId !== tokenOrgId) {
    res.status(401);
    throw new Error('Organization mismatch');
  }
  const accessToken = signAccess({
    sub: admin._id.toString(),
    type: 'admin',
    role: admin.role,
    organizationId: tokenOrgId,
  });
  res.json({ success: true, data: { accessToken } });
});

const logout = asyncHandler(async (req, res) => {
  await Admin.findByIdAndUpdate(req.admin._id, {
    $inc: { refreshTokenVersion: 1 },
  });
  res.json({ success: true, message: 'Logged out' });
});

module.exports = { login, refresh, logout };