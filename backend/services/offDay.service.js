const OffDay = require('../models/offDay.model');
const Attendance = require('../models/attendance.model');
const Employee = require('../models/employee.model');
const Organization = require('../models/organization.model');
const { istDayBounds, zonedParts } = require('../utils/dateHelpers');
const { getOrgTimezone, getOrgSundayOff } = require('../utils/orgTime');

function isSundayInTz(dateInstant, tz) {
  const p = zonedParts(dateInstant, tz);
  return new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay() === 0;
}

function syntheticSundayOffDay(organizationId, dayStart) {
  return new OffDay({
    organizationId,
    date: dayStart,
    type: 'weekly_off',
    label: 'Sunday Off',
    scope: 'org',
  });
}

async function findOffDaysForDate(organizationId, dateInstant, tz) {
  const zone = tz || (await getOrgTimezone(organizationId));
  const { dayStart, dayEnd } = istDayBounds(dateInstant, zone);
  const entries = await OffDay.find({ organizationId, date: { $gte: dayStart, $lte: dayEnd } });
  if (isSundayInTz(dateInstant, zone) && (await getOrgSundayOff(organizationId))) {
    entries.push(syntheticSundayOffDay(organizationId, dayStart));
  }
  return entries;
}

async function findOffDaysForOrgsOnDate(organizationIds, dateInstant, tz) {
  if (!organizationIds || !organizationIds.length) return [];
  const { dayStart, dayEnd } = istDayBounds(dateInstant, tz);
  const entries = await OffDay.find({
    organizationId: { $in: organizationIds },
    date: { $gte: dayStart, $lte: dayEnd },
  });
  if (isSundayInTz(dateInstant, tz)) {
    const sundayOffOrgs = await Organization.find({ _id: { $in: organizationIds }, sundayOff: true })
      .select('_id')
      .lean();
    sundayOffOrgs.forEach((o) => entries.push(syntheticSundayOffDay(o._id, dayStart)));
  }
  return entries;
}

async function removeRedundantSundayOffDays(organizationId, tz) {
  const zone = tz || (await getOrgTimezone(organizationId));
  const rows = await OffDay.find({ organizationId }).select('_id date');
  const ids = rows.filter((r) => isSundayInTz(r.date, zone)).map((r) => r._id);
  if (!ids.length) return { deletedCount: 0 };
  const r = await OffDay.deleteMany({ _id: { $in: ids } });
  return { deletedCount: r.deletedCount || 0 };
}

function sundaysInWindow(windowStart, windowEnd, tz) {
  const out = [];
  const seen = new Set();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const MAX_DAYS = 400; 
  let steps = 0;
  for (let t = windowStart.getTime(); t <= windowEnd.getTime() && steps < MAX_DAYS; t += ONE_DAY_MS, steps++) {
    const p = zonedParts(new Date(t), tz);
    const key = `${p.year}-${p.month}-${p.day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay() === 0) {
      out.push(istDayBounds(new Date(t), tz).dayStart);
    }
  }
  return out;
}

async function reclassifyPastSundaysForOrg(organizationId, tz) {
  const zone = tz || (await getOrgTimezone(organizationId));
  const rows = await Attendance.find({
    organizationId,
    status: 'absent',
    date: { $lte: new Date() },
  }).select('_id date');
  const ids = rows.filter((r) => isSundayInTz(r.date, zone)).map((r) => r._id);
  if (!ids.length) return { modifiedCount: 0 };
  return Attendance.updateMany({ _id: { $in: ids } }, { $set: { status: 'day_off' } });
}

async function findOffDayForEmployee(employee, dateInstant) {
  const entries = await findOffDaysForDate(employee.organizationId, dateInstant);
  return entries.find((e) => e.coversEmployee(employee)) || null;
}


async function reclassifyAbsencesForOffDay(offDay) {
  const { dayStart, dayEnd } = istDayBounds(offDay.date, await getOrgTimezone(offDay.organizationId));
  const filter = {
    organizationId: offDay.organizationId,
    date: { $gte: dayStart, $lte: dayEnd },
    status: 'absent',
  };

  if (offDay.scope === 'org') {
    return Attendance.updateMany(filter, { $set: { status: 'day_off' } });
  }

  const rows = await Attendance.find(filter).populate('employeeId', 'department');
  const toReclassify = rows.filter((r) => r.employeeId && offDay.coversEmployee(r.employeeId));
  if (toReclassify.length === 0) return { modifiedCount: 0 };
  const ids = toReclassify.map((r) => r._id);
  return Attendance.updateMany({ _id: { $in: ids } }, { $set: { status: 'day_off' } });
}


async function restoreAbsencesForRemovedOffDay(offDay) {
  const tz = await getOrgTimezone(offDay.organizationId);
  const { dayStart, dayEnd } = istDayBounds(offDay.date, tz);
  const range = { $gte: dayStart, $lte: dayEnd };
  const remaining = await OffDay.find({ organizationId: offDay.organizationId, date: range });
  const rows = await Attendance.find({
    organizationId: offDay.organizationId,
    date: range,
    status: 'day_off',
    punchIn: null,
  }).populate('employeeId', 'department');
  const ids = rows
    .filter((r) => r.employeeId && offDay.coversEmployee(r.employeeId) && !remaining.some((o) => o.coversEmployee(r.employeeId)))
    .map((r) => r._id);
  if (ids.length === 0) return { modifiedCount: 0 };
  if (dayEnd < new Date()) {
    return Attendance.updateMany({ _id: { $in: ids } }, { $set: { status: 'absent' } });
  }
  return Attendance.deleteMany({ _id: { $in: ids }, punchOut: null, $or: [{ notes: '' }, { notes: null }, { notes: { $exists: false } }] });
}


const repairedAt = new Map();
const REPAIR_TTL_MS = 5 * 60 * 1000;

async function repairOffDays(offDays, { force = false } = {}) {
  const now = Date.now();
  let changed = 0;
  for (const od of offDays) {
    if (od.date > new Date()) continue; // future dates have no rows yet
    const key = String(od._id);
    if (!force && now - (repairedAt.get(key) || 0) < REPAIR_TTL_MS) continue;
    const r = await reclassifyAbsencesForOffDay(od);
    repairedAt.set(key, now);
    changed += r.modifiedCount || 0;
  }
  return changed;
}


async function repairAllOffDays() {
  const offDays = await OffDay.find({ date: { $lte: new Date() } });
  return repairOffDays(offDays, { force: true });
}

module.exports = {
  restoreAbsencesForRemovedOffDay,
  repairOffDays,
  repairAllOffDays,
  findOffDaysForDate,
  findOffDaysForOrgsOnDate,
  findOffDayForEmployee,
  reclassifyAbsencesForOffDay,
  isSundayInTz,
  syntheticSundayOffDay,
  sundaysInWindow,
  reclassifyPastSundaysForOrg,
  removeRedundantSundayOffDays,
};
