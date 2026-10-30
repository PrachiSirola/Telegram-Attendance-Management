const mongoose = require('mongoose');
const Admin = require('../models/admin.model');
const authCache = require('../utils/authCache');
const { verifyAccess } = require('../utils/jwt');
const asyncHandler = require('../utils/asyncHandler');
const { primeOrgTimezone } = require('../utils/orgTime');

const protect = asyncHandler(async (req, res, next) => {
  let token;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.split(' ')[1];
  }
  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
  let decoded;
  try {
    decoded = verifyAccess(token);
  } catch {
    res.status(401);
    throw new Error('Not authorized, token invalid');
  }
  if (decoded.type !== 'admin') {
    res.status(401);
    throw new Error('Not authorized');
  }
  if (req.__authed) return next();
  const tokenOrgId = decoded.organizationId || null;
  const overrideId = req.headers['x-org-override'];
  const tokenIsSuper = decoded.role === 'super_admin';
  const prefetchOverride =
    tokenIsSuper && overrideId && overrideId !== 'ALL' && mongoose.isValidObjectId(overrideId);
  const prefetchAll = tokenIsSuper && (overrideId === 'ALL' || (!tokenOrgId && !overrideId));
  const [admin, homeOrg, overrideOrgPre, allOrgDocsPre] = await Promise.all([
    authCache.getAdmin(decoded.sub),
    tokenOrgId && mongoose.isValidObjectId(tokenOrgId) ? authCache.getOrg(tokenOrgId) : null,
    prefetchOverride ? authCache.getOrg(overrideId) : null,
    prefetchAll ? authCache.getAllOrgs() : null,
  ]);
  if (!admin || !admin.active) {
    res.status(401);
    throw new Error('Not authorized');
  }
  if (admin.twoFactorSetupRequired) {
    res.status(401);
    throw new Error('Two-factor setup required. Please sign in again.');
  }
  const adminOrgRaw = admin.organizationId ? String(admin.organizationId) : null;
  let adminOrg = null;
  if (adminOrgRaw) {
    adminOrg =
      adminOrgRaw === tokenOrgId ? homeOrg : await authCache.getOrg(adminOrgRaw);
  }
  const adminOrgId = adminOrg?._id ? String(adminOrg._id) : null;
  if (adminOrgId !== tokenOrgId) {
    res.status(401);
    throw new Error('Not authorized for this organization');
  }
  if (adminOrg) {
    admin.organizationId = adminOrg; 
    primeOrgTimezone(adminOrg._id, adminOrg.timezone);
  }
  req.admin = admin;
  let organizationId = adminOrg?._id || null;
  let organizationActive = adminOrg ? adminOrg.active !== false : true;
  let allOrgs = false;
  let organizationIds = null;
  if (admin.role === 'super_admin' && !adminOrgId && !overrideId) {
    allOrgs = true;
    const allOrgDocs = allOrgDocsPre || (await authCache.getAllOrgs());
    organizationIds = allOrgDocs.map((o) => o._id);
    req.orgDocs = allOrgDocs;
  }

  if (overrideId && admin.role === 'super_admin') {
    if (overrideId === 'ALL') {
      allOrgs = true;
      const allOrgDocs = allOrgDocsPre || (await authCache.getAllOrgs());
      organizationIds = allOrgDocs.map((o) => o._id);
      req.orgDocs = allOrgDocs;
    } else if (mongoose.isValidObjectId(overrideId)) {
      const overrideOrg = prefetchOverride ? overrideOrgPre : await authCache.getOrg(overrideId);
      if (overrideOrg) {
        primeOrgTimezone(overrideOrg._id, overrideOrg.timezone);
        organizationId = overrideOrg._id;
        organizationActive = overrideOrg.active !== false;
        allOrgs = false;
        organizationIds = null;
      }
    }
  }

  req.organizationId = organizationId;
  req.organizationActive = organizationActive;
  req.allOrgs = allOrgs;
  req.organizationIds = organizationIds;
  req.__authed = true;
  next();
});

module.exports = { protect };