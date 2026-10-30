const Attendance = require('../models/attendance.model');
const OffDay = require('../models/offDay.model');
const Employee = require('../models/employee.model');
const { getEffectiveShiftTiming } = require('./employee.service');
const { overtimeAfterMins } = require('../config/env');
const {
  resolveTz,
  zonedParts,
  zonedTimeToUtc,
  parseShiftTiming,
  parseTimeToToday,
  minutesBetween,
  hoursDecimal,
} = require('../utils/dateHelpers');

const pad2 = (n) => String(n).padStart(2, '0');
function reanchor(date, oldTz, newTz) {
  const p = zonedParts(date, oldTz);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, 0, 0, newTz);
}
function sameZone(a, b) {
  if (a === b) return true;
  const off = (tz, t) => {
    const p = zonedParts(new Date(t), tz);
    return Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
  };
  for (let t = Date.UTC(2018, 0, 1); t < Date.UTC(2032, 0, 1); t += 40 * 86400000) {
    if (off(a, t) !== off(b, t)) return false;
  }
  return true;
}
async function changeOrgTimezone(org, newTzRaw) {
  const oldTz = resolveTz(org.timezone);
  const newTz = resolveTz(newTzRaw);
  if (sameZone(oldTz, newTz)) return { attendance: 0, offDays: 0, mergedDuplicates: 0 };

  const employees = await Employee.find({ organizationId: org._id }).lean();
  const empById = new Map(employees.map((e) => [String(e._id), e]));

  const rows = await Attendance.find({ organizationId: org._id })
    .select('date punchIn punchOut status employeeId')
    .lean();
  const richness = (r) => (r.punchOut ? 4 : 0) + (r.punchIn ? 2 : 0) + (r.status && r.status !== 'absent' ? 1 : 0);
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.employeeId}|${reanchor(r.date, oldTz, newTz).getTime()}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const dropIds = [];
  const keep = [];
  for (const g of groups.values()) {
    g.sort((a, b) => richness(b) - richness(a));
    keep.push(g[0]);
    for (const x of g.slice(1)) dropIds.push(x._id);
  }
  if (dropIds.length) await Attendance.deleteMany({ _id: { $in: dropIds } });
  rows.length = 0;
  rows.push(...keep);
  const PARK = 100 * 365.25 * 86400000;
  const moving = rows.filter((r) => reanchor(r.date, oldTz, newTz).getTime() !== new Date(r.date).getTime());
  for (let i = 0; i < moving.length; i += 500) {
    await Attendance.bulkWrite(
      moving.slice(i, i + 500).map((r) => ({
        updateOne: { filter: { _id: r._id }, update: { $set: { date: new Date(new Date(r.date).getTime() + PARK) } } },
      })),
      { ordered: true }
    );
  }

  const ops = [];
  for (const r of rows) {
    const set = { date: reanchor(r.date, oldTz, newTz) };
    const emp = empById.get(String(r.employeeId));
    const parsed = emp ? parseShiftTiming(getEffectiveShiftTiming(emp, org)) : null;
    if (parsed && r.punchIn) {
      const expected = parseTimeToToday(parsed.start, new Date(r.punchIn), newTz);
      set.lateMinutes = new Date(r.punchIn) > expected ? minutesBetween(expected, new Date(r.punchIn)) : 0;
      if (r.status === 'present' || r.status === 'late') {
        set.status = set.lateMinutes > 0 ? 'late' : 'present';
      }
    }
    if (parsed && r.punchOut) {
      const end = parseTimeToToday(parsed.end, new Date(r.punchOut), newTz);
      const threshold = new Date(end.getTime() + overtimeAfterMins * 60000);
      set.overtime = new Date(r.punchOut) <= threshold ? 0 : hoursDecimal(threshold, new Date(r.punchOut));
    }
    ops.push({ updateOne: { filter: { _id: r._id }, update: { $set: set } } });
  }
  for (let i = 0; i < ops.length; i += 500) {
    await Attendance.bulkWrite(ops.slice(i, i + 500), { ordered: true });
  }

  const offDays = await OffDay.find({ organizationId: org._id }).select('date').lean();
  if (offDays.length) {
    await OffDay.bulkWrite(
      offDays.map((o) => ({
        updateOne: { filter: { _id: o._id }, update: { $set: { date: reanchor(o.date, oldTz, newTz) } } },
      }))
    );
  }
  org.lastDailyReportDate = null;

  return { attendance: rows.length, offDays: offDays.length, mergedDuplicates: dropIds.length };
}

module.exports = { changeOrgTimezone };