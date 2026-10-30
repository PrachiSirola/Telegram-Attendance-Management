const Organization = require('../models/organization.model');
const { DEFAULT_TZ, resolveTz, dayBoundsOf } = require('./dateHelpers');

const TTL_MS = 60 * 1000;
const cache = new Map();

async function getOrgTimezone(orgId) {
  if (!orgId) return DEFAULT_TZ;
  const key = String(orgId._id || orgId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tz;
  const org = await Organization.findById(key).select('timezone').lean();
  const tz = resolveTz(org?.timezone);
  cache.set(key, { tz, at: Date.now() });
  return tz;
}

function primeOrgTimezone(orgId, tzRaw) {
  if (!orgId) return;
  cache.set(String(orgId._id || orgId), { tz: resolveTz(tzRaw), at: Date.now() });
}

function clearOrgTimezoneCache(orgId) {
  if (orgId) cache.delete(String(orgId));
  else cache.clear();
}

const sundayOffCache = new Map(); 

async function getOrgSundayOff(orgId) {
  if (!orgId) return false;
  const key = String(orgId._id || orgId);
  const hit = sundayOffCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.val;
  const org = await Organization.findById(key).select('sundayOff').lean();
  const val = !!org?.sundayOff;
  sundayOffCache.set(key, { val, at: Date.now() });
  return val;
}

function primeOrgSundayOff(orgId, sundayOff) {
  if (!orgId) return;
  sundayOffCache.set(String(orgId._id || orgId), { val: !!sundayOff, at: Date.now() });
}

function clearOrgSundayOffCache(orgId) {
  if (orgId) sundayOffCache.delete(String(orgId));
  else sundayOffCache.clear();
}

async function timezoneGroupsForReq(req) {
  if (req.allOrgs) {
    const ids = req.organizationIds || [];

    const orgs = req.orgDocs || (await Organization.find({ _id: { $in: ids } }).select('timezone').lean());
    const byTz = new Map();
    orgs.forEach((o) => {
      const tz = resolveTz(o.timezone);
      if (!byTz.has(tz)) byTz.set(tz, []);
      byTz.get(tz).push(o._id);
    });
    if (!byTz.size) return [{ ids: [], tz: DEFAULT_TZ }];
    return [...byTz.entries()].map(([tz, orgIds]) => ({ ids: orgIds, tz }));
  }
  return [{ ids: [req.organizationId], tz: await getOrgTimezone(req.organizationId) }];
}


function rangeFragmentBy(groups, resolve, { field = 'date', orgField = 'organizationId' } = {}) {
  const clauses = groups.map(({ ids, tz }) => {
    const r = resolve(tz);
    if (!r) return null;
    const range = {};
    if (r.start) range.$gte = r.start;
    if (r.end) range.$lte = r.end;
    return { ids, range };
  });
  if (clauses.some((c) => !c)) return null;
  if (clauses.length === 1) return { [field]: clauses[0].range };
  return { $or: clauses.map(({ ids, range }) => ({ [orgField]: { $in: ids }, [field]: range })) };
}

function rangeFragment(groups, { from, to, field = 'date', orgField = 'organizationId', defaultToday = false }) {
  return rangeFragmentBy(
    groups,
    (tz) => {
      if (from || to) {
        return {
          start: from ? dayBoundsOf(from, tz).dayStart : undefined,
          end: to ? dayBoundsOf(to, tz).dayEnd : undefined,
        };
      }
      if (defaultToday) {
        const b = dayBoundsOf(new Date(), tz);
        return { start: b.dayStart, end: b.dayEnd };
      }
      return null;
    },
    { field, orgField }
  );
}

function andInto(filter, fragment) {
  if (!fragment) return filter;
  filter.$and = [...(filter.$and || []), fragment];
  return filter;
}

module.exports = {
  getOrgTimezone,
  primeOrgTimezone,
  clearOrgTimezoneCache,
  getOrgSundayOff,
  primeOrgSundayOff,
  clearOrgSundayOffCache,
  timezoneGroupsForReq,
  rangeFragment,
  rangeFragmentBy,
  andInto,
};
