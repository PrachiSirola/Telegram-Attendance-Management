const Organization = require('../models/organization.model');
const Admin = require('../models/admin.model');
const asyncHandler = require('../utils/asyncHandler');
const { normalizeBreakTimings } = require('../services/employee.service');
const { sendTestReport: sendReport } = require('../services/dailyReport.service');
const { sendPasswordChangedBySuperAdminNotify } = require('../services/email.service');
const { geocodeAddress, reverseGeocode } = require('../utils/geocoding');
const { changeOrgTimezone } = require('../services/timezoneMigration.service');
const { isValidTimezone } = require('../utils/dateHelpers');
const { clearOrgTimezoneCache, clearOrgSundayOffCache } = require('../utils/orgTime');
const { reclassifyPastSundaysForOrg, removeRedundantSundayOffDays } = require('../services/offDay.service');
const { CLEAR_TWO_FACTOR } = require('../utils/twoFactor');

const lookupBySlug = asyncHandler(async (req, res) => {
  const org = await Organization.findOne({
    slug: req.params.slug.toLowerCase().trim(),
    active: true,
  });
  if (!org) {
    res.status(404);
    throw new Error('Organization not found');
  }
  res.json({
    success: true,
    data: { id: org._id, name: org.name, slug: org.slug },
  });
});

const getCurrentOrgDefaults = asyncHandler(async (req, res) => {

  if (req.allOrgs) {
    res.json({
      success: true,
      data: {
        shiftTiming: '',
        breakTimings: {},
        name: 'All Companies',
        timezone: null,
        sundayOff: false,
        locationSharingEnabled: false,
        imageCaptureEnabled: false,
      },
    });
    return;
  }
  const org = await Organization.findById(req.organizationId).select(
    'shiftTiming breakTimings name timezone sundayOff locationSharingEnabled imageCaptureEnabled'
  );
  if (!org) {
    res.status(404);
    throw new Error('Organization not found');
  }
  res.json({
    success: true,
    data: {
      id: org._id,
      shiftTiming: org.shiftTiming,
      breakTimings: org.breakTimings,
      name: org.name,
      timezone: org.timezone,
      sundayOff: !!org.sundayOff,
      locationSharingEnabled: !!org.locationSharingEnabled,
      imageCaptureEnabled: !!org.imageCaptureEnabled,
    },
  });
});

const listAll = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = {};
  if (q) {
    filter.$or = [{ name: new RegExp(q, 'i') }, { slug: new RegExp(q, 'i') }];
  }
  const items = await Organization.find(filter).sort({ name: 1 }).lean();
  if (items.length === 0) {
    res.json({ success: true, data: [] });
    return;
  }
  const orgIds = items.map((o) => o._id);
  const counts = await Admin.aggregate([
    { $match: { organizationId: { $in: orgIds } } },
    { $group: { _id: '$organizationId', adminCount: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.adminCount]));
  const data = items.map((o) => ({
    ...o,
    adminCount: countMap.get(String(o._id)) || 0,
  }));
  res.json({ success: true, data });
});

function normalizeSlug(rawSlug) {
  const slugNorm = String(rawSlug || '')
    .toLowerCase()
    .trim();
  if (!slugNorm) {
    const e = new Error('Slug is required');
    e.statusCode = 400;
    throw e;
  }
  if (!/^[a-z0-9-]+$/.test(slugNorm)) {
    const e = new Error('Slug may only contain lowercase letters, numbers, and hyphens');
    e.statusCode = 400;
    throw e;
  }
  if (slugNorm.length < 2) {
    const e = new Error('Slug must be at least 2 characters');
    e.statusCode = 400;
    throw e;
  }
  return slugNorm;
}

async function normalizeOfficeLocation(input) {
  if (!input) return undefined;
  const address = typeof input.address === 'string' ? input.address.trim() : '';
  let lat = input.lat !== '' && input.lat != null ? Number(input.lat) : undefined;
  let lng = input.lng !== '' && input.lng != null ? Number(input.lng) : undefined;
  const radiusMeters =
    input.radiusMeters !== '' && input.radiusMeters != null ? Number(input.radiusMeters) : 500;


  if (address && (lat == null || lng == null)) {
    const geo = await geocodeAddress(address);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
    }
  }

  if (!address && (lat == null || lng == null)) {
    return { address: '', lat: undefined, lng: undefined, radiusMeters: undefined };
  }
  return { address, lat, lng, radiusMeters };
}

const listTimezones = asyncHandler(async (req, res) => {
  const filter = req.admin?.role === 'super_admin' ? {} : { _id: req.organizationId };

  const orgs =
    req.orgDocs && req.admin?.role === 'super_admin'
      ? req.orgDocs
      : await Organization.find(filter).select('_id name timezone').lean();
  res.json({
    success: true,
    data: orgs.map((o) => ({ id: o._id, name: o.name, timezone: o.timezone || 'Asia/Kolkata' })),
  });
});

const create = asyncHandler(async (req, res) => {
  const { name, slug } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error('name is required');
  }
  let slugNorm;
  try {
    slugNorm = normalizeSlug(slug);
  } catch (e) {
    res.status(e.statusCode || 400);
    throw e;
  }
  const clash = await Organization.findOne({ slug: slugNorm });
  if (clash) {
    res.status(400);
    throw new Error('Slug already in use');
  }
  if (req.body.timezone !== undefined && !isValidTimezone(req.body.timezone)) {
    res.status(400);
    throw new Error('Invalid timezone');
  }
  const doc = await Organization.create({
    name: name.trim(),
    slug: slugNorm,
    timezone: req.body.timezone || undefined,
    shiftTiming: req.body.shiftTiming || undefined,
    breakTimings: normalizeBreakTimings(req.body.breakTimings),
    officeLocation: await normalizeOfficeLocation(req.body.officeLocation),
    sundayOff: !!req.body.sundayOff,
    locationSharingEnabled: !!req.body.locationSharingEnabled,
    imageCaptureEnabled: !!req.body.imageCaptureEnabled,
  });
  res.status(201).json({ success: true, data: doc });
});

const update = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.orgId);
  if (!org) {
    res.status(404);
    throw new Error('Organization not found');
  }
  const {
    name,
    slug,
    active,
    shiftTiming,
    breakTimings,
    officeLocation,
    timezone,
    sundayOff,
    locationSharingEnabled,
    imageCaptureEnabled,
  } = req.body;
  const has =
    name !== undefined ||
    slug !== undefined ||
    active !== undefined ||
    shiftTiming !== undefined ||
    breakTimings !== undefined ||
    officeLocation !== undefined ||
    timezone !== undefined ||
    sundayOff !== undefined ||
    locationSharingEnabled !== undefined ||
    imageCaptureEnabled !== undefined;
  if (!has) {
    res.status(400);
    throw new Error('No fields to update');
  }
  if (name !== undefined) {
    const n = String(name).trim();
    if (!n) {
      res.status(400);
      throw new Error('name cannot be empty');
    }
    org.name = n;
  }
  if (slug !== undefined) {
    let slugNorm;
    try {
      slugNorm = normalizeSlug(slug);
    } catch (e) {
      res.status(e.statusCode || 400);
      throw e;
    }
    const clash = await Organization.findOne({ slug: slugNorm, _id: { $ne: org._id } });
    if (clash) {
      res.status(400);
      throw new Error('Slug already in use');
    }
    org.slug = slugNorm;
  }
  if (active !== undefined) {
    org.active = !!active;
  }
  if (shiftTiming !== undefined) {
    org.shiftTiming = shiftTiming;
  }
  if (timezone !== undefined && timezone !== org.timezone) {
    if (!isValidTimezone(timezone)) {
      res.status(400);
      throw new Error('Invalid timezone');
    }

    await changeOrgTimezone(org, timezone);
    org.timezone = timezone;
    clearOrgTimezoneCache(org._id);
  }
  if (breakTimings !== undefined) {
    org.breakTimings = normalizeBreakTimings(breakTimings);
  }
  if (officeLocation !== undefined) {
    org.officeLocation = await normalizeOfficeLocation(officeLocation);
  }
  if (locationSharingEnabled !== undefined) {
    org.locationSharingEnabled = !!locationSharingEnabled;
  }
  if (imageCaptureEnabled !== undefined) {
    org.imageCaptureEnabled = !!imageCaptureEnabled;
  }

  let reclassifiedCount = 0;
  let removedManualEntriesCount = 0;
  if (sundayOff !== undefined) {
    const turningOn = !!sundayOff && !org.sundayOff;
    org.sundayOff = !!sundayOff;
    clearOrgSundayOffCache(org._id);
    if (turningOn) {
      const [r, removed] = await Promise.all([
        reclassifyPastSundaysForOrg(org._id, org.timezone),
        removeRedundantSundayOffDays(org._id, org.timezone),
      ]);
      reclassifiedCount = r.modifiedCount || 0;
      removedManualEntriesCount = removed.deletedCount || 0;
    }
  }
  await org.save();
  res.json({ success: true, data: org, reclassifiedCount, removedManualEntriesCount });
});

const updateFeatureToggles = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.orgId);
  if (!org) {
    res.status(404);
    throw new Error('Organization not found');
  }
  const { locationSharingEnabled, imageCaptureEnabled } = req.body;
  const has = locationSharingEnabled !== undefined || imageCaptureEnabled !== undefined;
  if (!has) {
    res.status(400);
    throw new Error('No fields to update');
  }
  if (locationSharingEnabled !== undefined) {
    org.locationSharingEnabled = !!locationSharingEnabled;
  }
  if (imageCaptureEnabled !== undefined) {
    org.imageCaptureEnabled = !!imageCaptureEnabled;
  }
  await org.save();
  res.json({ success: true, data: org });
});

const remove = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.orgId);
  if (!org) {
    res.status(404);
    throw new Error('Organization not found');
  }
  await Organization.deleteOne({ _id: org._id });
  res.json({ success: true, data: { id: org._id } });
});

const createAdminInOrg = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.orgId);
  if (!org) {
    res.status(404);
    throw new Error('Organization not found');
  }
  const { name, email, password, role, canEditOrgFeatureToggles } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('name, email, and password are required');
  }

  if (role !== undefined && role !== 'admin') {
    res.status(400);
    throw new Error('Only the Admin role can be assigned here. Super Admin cannot be created or assigned.');
  }
  const admin = await Admin.create({
    organizationId: org._id,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role: 'admin',
    canEditOrgFeatureToggles: !!canEditOrgFeatureToggles,
  });
  res.status(201).json({
    success: true,
    data: {
      id: admin._id,
      email: admin.email,
      organizationId: org._id,
      slug: org.slug,
    },
  });
});

const listAdminsInOrg = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.orgId);
  if (!org) {
    res.status(404);
    throw new Error('Organization not found');
  }
  const admins = await Admin.find({ organizationId: org._id })
    .select('-password')
    .sort({ name: 1 });
  res.json({ success: true, data: admins });
});

const resetAdminTwoFactor = asyncHandler(async (req, res) => {
  const target = await Admin.findOne({ _id: req.params.adminId, organizationId: req.params.orgId });
  if (!target) {
    res.status(404);
    throw new Error('Admin not found in this organization');
  }
  if (String(target._id) === String(req.admin._id)) {
    res.status(400);
    throw new Error('Use Disable two-factor authentication on your own account instead.');
  }
  if (!target.twoFactorEnabled) {
    res.status(400);
    throw new Error('Two-factor authentication is not enabled for this admin.');
  }
  await Admin.updateOne(
    { _id: target._id },
    { ...CLEAR_TWO_FACTOR, $inc: { refreshTokenVersion: 1 } },
    { strict: false }
  );
  res.json({ success: true, message: 'Two-factor authentication has been reset for this admin.' });
});

const updateAdminInOrg = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.orgId);
  if (!org) {
    res.status(404);
    throw new Error('Organization not found');
  }
  const adminDoc = await Admin.findOne({
    _id: req.params.adminId,
    organizationId: org._id,
  }).select('+password');
  if (!adminDoc) {
    res.status(404);
    throw new Error('Admin not found in this organization');
  }

  const { name, email, password, role, active, canEditOrgFeatureToggles } = req.body;
  const hasPassword = password !== undefined && String(password).length > 0;
  const has =
    name !== undefined ||
    email !== undefined ||
    hasPassword ||
    role !== undefined ||
    active !== undefined ||
    canEditOrgFeatureToggles !== undefined;
  if (!has) {
    res.status(400);
    throw new Error('No fields to update');
  }

  if (name !== undefined) {
    const n = String(name).trim();
    if (!n) {
      res.status(400);
      throw new Error('name cannot be empty');
    }
    adminDoc.name = n;
  }
  if (email !== undefined) {
    const em = String(email).toLowerCase().trim();
    if (!em) {
      res.status(400);
      throw new Error('email cannot be empty');
    }
    const clash = await Admin.findOne({
      organizationId: org._id,
      email: em,
      _id: { $ne: adminDoc._id },
    });
    if (clash) {
      res.status(400);
      throw new Error('Email already in use for this organization');
    }
    adminDoc.email = em;
  }
  if (hasPassword) {
    const p = String(password);
    if (p.length < 6) {
      res.status(400);
      throw new Error('password must be at least 6 characters');
    }
    if (await adminDoc.comparePassword(p)) {
      res.status(400);
      throw new Error('This password has already been used. Please choose a different password.');
    }
    adminDoc.password = p;
    adminDoc.refreshTokenVersion = (adminDoc.refreshTokenVersion || 0) + 1;
  }
  if (role !== undefined) {
    if (role !== 'admin') {
      res.status(400);
      throw new Error('Only the Admin role is allowed here. Super Admin cannot be assigned.');
    }
    if (adminDoc.role === 'super_admin') {
      res.status(400);
      throw new Error('The Super Admin role cannot be changed from Manage Admin.');
    }
  }
  if (active !== undefined) {
    adminDoc.active = Boolean(active);
  }
  if (canEditOrgFeatureToggles !== undefined) {
    adminDoc.canEditOrgFeatureToggles = !!canEditOrgFeatureToggles;
  }

  await adminDoc.save();
  if (hasPassword) {
    sendPasswordChangedBySuperAdminNotify(adminDoc);
  }
  const fresh = await Admin.findById(adminDoc._id).select('-password');
  res.json({ success: true, data: fresh });
});

const sendTestReport = asyncHandler(async (req, res) => {
  await sendReport(req.params.orgId);
  res.json({ success: true, message: 'Test report sent' });
});

const geocode = asyncHandler(async (req, res) => {
  const query = req.query.query || req.query.q || req.query.address;
  if (!query || !String(query).trim()) {
    return res.status(400).json({ success: false, message: 'address query is required' });
  }
  const result = await geocodeAddress(String(query));
  if (!result) {
    return res.status(404).json({ success: false, message: 'Could not find coordinates for this address' });
  }
  res.json({ success: true, data: result });
});

const reverseGeocodeController = asyncHandler(async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng || req.query.lon);
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ success: false, message: 'Valid lat and lng required' });
  }
  const address = await reverseGeocode(lat, lng);
  res.json({ success: true, data: { address: address || '' } });
});

module.exports = {
  lookupBySlug,
  getCurrentOrgDefaults,
  listAll,
  create,
  update,
  updateFeatureToggles,
  listTimezones,
  remove,
  createAdminInOrg,
  listAdminsInOrg,
  updateAdminInOrg,
  resetAdminTwoFactor,
  sendTestReport,
  geocode,
  reverseGeocodeController,
};