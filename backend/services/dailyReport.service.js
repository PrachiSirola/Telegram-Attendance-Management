const Employee = require('../models/employee.model');
const Attendance = require('../models/attendance.model');
const LeaveRequest = require('../models/leaveRequest.model');
const Organization = require('../models/organization.model');
const { istDayBounds, parseShiftTiming, zonedParts, resolveTz } = require('../utils/dateHelpers');
const { notifySuperAdmins, notifyOrgAdmins, escapeHtml } = require('./telegramNotify.service');
const { findOffDaysForDate } = require('./offDay.service');
const logger = require('../utils/logger');

function nowInTz(tz) {
  const p = zonedParts(new Date(), tz);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    dateStr: `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`,
    minutesOfDay: p.hour * 60 + p.minute,
  };
}

function shiftStartMinutes(shiftTimingStr) {
  const parsed = parseShiftTiming(shiftTimingStr);
  if (!parsed) return null;
  const [h, m] = parsed.start.split(':').map(Number);
  return h * 60 + m;
}

function to12h(date, tz) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: resolveTz(tz) });
}

async function autoMarkAbsentees(orgId, dayStart, dayEnd, tz) {
  const employees = await Employee.find({ organizationId: orgId, active: true }).select('_id department');
  const offEntries = await findOffDaysForDate(orgId, dayStart, tz);
  const existing = await Attendance.find({
    organizationId: orgId,
    date: { $gte: dayStart, $lte: dayEnd },
  }).select('employeeId punchIn status');

  const byEmployee = new Map(existing.map((a) => [String(a.employeeId), a]));

  await Promise.all(
    employees.map((emp) => {
      const row = byEmployee.get(String(emp._id));
      const isOff = offEntries.some((entry) => entry.coversEmployee(emp));
      if (row) {
        if (row.punchIn || row.status === 'on_leave' || row.status === 'day_off') return null; // already handled
        if (isOff) return Attendance.updateOne({ _id: row._id }, { $set: { status: 'day_off' } });
        if (row.status === 'absent') return null; // already marked
        return Attendance.updateOne({ _id: row._id }, { $set: { status: 'absent' } });
      }
      return Attendance.create({
        organizationId: orgId,
        employeeId: emp._id,
        date: dayStart,
        status: isOff ? 'day_off' : 'absent',
      });
    })
  );
}


async function buildReportText(org) {
  const tz = resolveTz(org.timezone);
  const { dayStart, dayEnd } = istDayBounds(new Date(), tz);
  const localDateStr = nowInTz(tz).dateStr;

  await autoMarkAbsentees(org._id, dayStart, dayEnd, tz);

  const [employees, rowsRaw, leaves] = await Promise.all([
    Employee.find({ organizationId: org._id, active: true }).select('_id name employeeId'),
    Attendance.find({ organizationId: org._id, date: { $gte: dayStart, $lte: dayEnd } }).populate(
      'employeeId',
      'name employeeId'
    ),
    LeaveRequest.find({
      organizationId: org._id,
      status: 'approved',
      startDate: { $lte: new Date(`${localDateStr}T23:59:59.999Z`) },
      endDate: { $gte: new Date(`${localDateStr}T00:00:00.000Z`) },
    }).populate('employeeId', 'name'),
  ]);
  const rows = rowsRaw.sort((a, b) => (a.employeeId?.name || '').localeCompare(b.employeeId?.name || ''));

  const present = rows.filter((r) => r.punchIn);
  const late = present.filter((r) => r.lateMinutes > 0);

  const onLeaveMap = new Map();
  leaves.forEach((l) => {
    const id = String(l.employeeId?._id || l.employeeId);
    onLeaveMap.set(id, { name: l.employeeId?.name || 'Unknown', reason: l.reason || 'Not specified' });
  });
  rows
    .filter((r) => r.status === 'on_leave')
    .forEach((r) => {
      const id = String(r.employeeId?._id || r.employeeId);
      if (!onLeaveMap.has(id)) {
        onLeaveMap.set(id, { name: r.employeeId?.name || 'Unknown', reason: r.notes || 'On leave' });
      }
    });

  const absent = rows.filter((r) => {
    const id = String(r.employeeId?._id || r.employeeId);
    return !r.punchIn && r.status === 'absent' && !onLeaveMap.has(id);
  });

  const lines = [`<b>${escapeHtml(org.name)}</b>`, ''];
  lines.push('Daily Attendance Report');
  lines.push(`Total employees - ${employees.length}`);
  lines.push(`Present - ${present.length}`);
  lines.push(`Absent - ${absent.length}`);
  lines.push(`On leave - ${onLeaveMap.size}`);
  lines.push('');

  if (present.length) {
    lines.push('<b>Present</b>');
    present.forEach((r) => {
      const name = escapeHtml(r.employeeId?.name || 'Unknown');
      const time = to12h(new Date(r.punchIn), tz);
      lines.push(`${name} - ${time}`);
    });
    lines.push('');
  }

  if (late.length) {
    lines.push('<b>Late</b>');
    late.forEach((r) => {
      const name = escapeHtml(r.employeeId?.name || 'Unknown');
      const time = to12h(new Date(r.punchIn), tz);
      lines.push(`${name} - ${time} (late ${r.lateMinutes} min)`);
    });
    lines.push('');
  }

  if (absent.length) {
    lines.push('<b>Not punched in / Absent</b>');
    absent.forEach((r) => {
      lines.push(`${escapeHtml(r.employeeId?.name || 'Unknown')}`);
    });
    lines.push('');
  }

  if (onLeaveMap.size) {
    lines.push('<b>On leave</b>');
    onLeaveMap.forEach(({ name, reason }) => {
      lines.push(`${escapeHtml(name)} - ${escapeHtml(reason)}`);
    });
    lines.push('');
  }

  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

async function runDailyReportCheck() {
  const orgs = await Organization.find({ active: true });

  for (const org of orgs) {
    try {
      const { dateStr, minutesOfDay } = nowInTz(org.timezone);
      if (org.lastDailyReportDate === dateStr) continue; 

      const startMin = shiftStartMinutes(org.shiftTiming);
      if (startMin == null) continue; 

      const cutoff = startMin + 120;
      if (minutesOfDay < cutoff) continue; 

      const text = await buildReportText(org);


      const claimed = await Organization.findOneAndUpdate(
        { _id: org._id, lastDailyReportDate: { $ne: dateStr } },
        { $set: { lastDailyReportDate: dateStr } },
        { new: true }
      );
      if (!claimed) continue; 

      await Promise.all([notifyOrgAdmins(org._id, text), notifySuperAdmins(text)]);
      logger.info(`Daily attendance report sent for organization ${org.name}`);
    } catch (err) {
      logger.error(`Daily report failed for organization ${org._id}`, err);
    }
  }
}


async function sendTestReport(orgId) {
  const org = await Organization.findById(orgId);
  if (!org) {
    const e = new Error('Organization not found');
    e.statusCode = 404;
    throw e;
  }
  const text = await buildReportText(org);
  await Promise.all([notifyOrgAdmins(org._id, text), notifySuperAdmins(text)]);
  return text;
}

module.exports = { runDailyReportCheck, buildReportText, sendTestReport };