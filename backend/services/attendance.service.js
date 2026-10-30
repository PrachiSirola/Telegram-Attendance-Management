const Attendance = require('../models/attendance.model');
const ActivityLog = require('../models/activityLog.model');
const Employee = require('../models/employee.model');
const Organization = require('../models/organization.model');
const { createAdminNotification } = require('./notification.service');
const { notifySuperAdminsOfEvent } = require('./telegramNotify.service');
const { emitToOrganization } = require('./socket.service');
const { getEffectiveShiftTiming, getEffectiveBreakTimings, findBreakSlotForTime } = require('./employee.service');
const { checkGeofence } = require('../utils/geofence');
const {
  parseTimeToToday,
  startOfDay,
  istDayBounds,
  dayBoundsOf,
  hoursDecimal,
  minutesBetween,
  parseShiftTiming,
} = require('../utils/dateHelpers');
const { getOrgTimezone } = require('../utils/orgTime');
const { overtimeAfterMins } = require('../config/env');

async function getOrCreateTodayAttendance(employeeDoc) {
  const tz = await getOrgTimezone(employeeDoc.organizationId);
  const { dayStart: day } = istDayBounds(new Date(), tz);
  const orgId = employeeDoc.organizationId;
  const row = await Attendance.findOneAndUpdate(
    { organizationId: orgId, employeeId: employeeDoc._id, date: day },
    { $setOnInsert: { organizationId: orgId, employeeId: employeeDoc._id, date: day, status: 'pending' } },
    { upsert: true, new: true }
  );
  return row;
}

function blockIfOnLeave(att) {
  if (att.status === 'on_leave') {
    const e = new Error(
      'You have an approved leave for today. Attendance actions are not available until that leave is cancelled.'
    );
    e.statusCode = 403;
    throw e;
  }
}

async function resolveShift(employee) {
  let shiftTiming = employee?.shiftTiming;
  if (!shiftTiming) {
    const org = await Organization.findById(employee.organizationId).select('shiftTiming');
    shiftTiming = getEffectiveShiftTiming(employee, org);
  }
  const own = parseShiftTiming(shiftTiming);
  if (!own) {
    const e = new Error('Shift timing is not set for this employee or organization');
    e.statusCode = 400;
    throw e;
  }
  return own;
}

async function shiftStartInstant(refDate, employee) {
  const own = await resolveShift(employee);
  const tz = await getOrgTimezone(employee.organizationId);
  return parseTimeToToday(own.start, refDate, tz);
}

async function computeLateMinutes(punchInDate, employee) {
  const own = await resolveShift(employee);
  const tz = await getOrgTimezone(employee.organizationId);
  const expected = parseTimeToToday(own.start, punchInDate, tz);
  if (punchInDate > expected) {
    return minutesBetween(expected, punchInDate);
  }
  return 0;
}

async function shiftEndInstant(refDate, employee) {
  const own = await resolveShift(employee);
  const tz = await getOrgTimezone(employee.organizationId);
  const end = parseTimeToToday(own.end, refDate, tz);
  const start = parseTimeToToday(own.start, refDate, tz);
  return end <= start ? new Date(end.getTime() + 86400000) : end;
}

async function computeEarlyLeaveMinutes(punchOutDate, employee, punchInDate) {
  if (!punchOutDate) return 0;
  const end = await shiftEndInstant(punchInDate || punchOutDate, employee);
  return punchOutDate < end ? minutesBetween(punchOutDate, end) : 0;
}

async function computeOvertimeHours(punchOutDate, employee) {
  let shiftTiming = employee?.shiftTiming;
  if (!shiftTiming) {
    const org = await Organization.findById(employee.organizationId).select('shiftTiming');
    shiftTiming = getEffectiveShiftTiming(employee, org);
  }
  const own = parseShiftTiming(shiftTiming);
  if (!own) {
    const e = new Error('Shift timing is not set for this employee or organization');
    e.statusCode = 400;
    throw e;
  }
  const tz = await getOrgTimezone(employee.organizationId);
  const end = parseTimeToToday(own.end, punchOutDate, tz);
  const threshold = new Date(end.getTime() + overtimeAfterMins * 60000);
  if (punchOutDate <= threshold) return 0;
  return hoursDecimal(threshold, punchOutDate);
}

function hasCoords(lat, lng) {
  return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
}

function orgId(employee) {
  return employee.organizationId;
}

async function punchInEmployee({
  employee,
  lat,
  lng,
  accuracy,
  selfieRelativePath,
  selfiePublicId,
  selfieHash,
  ipAddress,
  notes,
}) {
  if (!employee.active) {
    const e = new Error('Employee account is disabled');
    e.statusCode = 403;
    throw e;
  }

  const att = await getOrCreateTodayAttendance(employee);
  blockIfOnLeave(att);
  if (att.punchIn) {
    const e = new Error('Already punched in today');
    e.statusCode = 400;
    throw e;
  }

  if (selfieHash) {
    const reused = await Attendance.findOne({
      employeeId: employee._id,
      selfieHash,
      _id: { $ne: att._id },
    });
    if (reused) {
      const e = new Error('This selfie has already been used before. Please take a new selfie.');
      e.statusCode = 400;
      throw e;
    }
  }

  let withinGeofence;
  if (hasCoords(lat, lng)) {
    const org = await Organization.findById(employee.organizationId).select('officeLocation');
    const result = checkGeofence(org?.officeLocation, Number(lat), Number(lng));
    if (result.configured) {
      withinGeofence = result.withinRadius;
      if (!result.withinRadius) {
        const e = new Error(
          `You are ${result.distanceMeters}m from the office, outside the allowed ${org.officeLocation.radiusMeters}m radius. Punch-in was not recorded.`
        );
        e.statusCode = 403;
        throw e;
      }
    }
  }

  const now = new Date();
  const lateMinutes = await computeLateMinutes(now, employee);
  att.punchIn = now;
  if (hasCoords(lat, lng)) {
    const la = Number(lat);
    const ln = Number(lng);
    att.punchInLocation = { lat: la, lng: ln, accuracy, at: now };
    await Employee.findByIdAndUpdate(employee._id, {
      lastSeenLocation: { lat: la, lng: ln, accuracy, at: now },
    });
  }
  att.selfieImage = selfieRelativePath || att.selfieImage;
  att.selfieImagePublicId = selfiePublicId || att.selfieImagePublicId;
  att.selfieHash = selfieHash || att.selfieHash;
  att.ipAddress = ipAddress || att.ipAddress;
  if (withinGeofence !== undefined) att.withinGeofence = withinGeofence;
  att.notes = notes || att.notes;
  att.lateMinutes = lateMinutes;
  att.status = lateMinutes > 0 ? 'late' : 'present';
  await att.save();

  await ActivityLog.create({
    organizationId: orgId(employee),
    employeeId: employee._id,
    activityType: 'punch_in',
    message: 'Punch in',
    location: hasCoords(lat, lng)
      ? { lat: Number(lat), lng: Number(lng), accuracy }
      : undefined,
    image: selfieRelativePath,
    timestamp: now,
  });

  await createAdminNotification({
    organizationId: orgId(employee),
    type: 'punch_in',
    title: `${employee.name} punched in`,
    body: lateMinutes > 0 ? `Late by ${lateMinutes} minutes` : 'On time',
    meta: { employeeId: employee._id, attendanceId: att._id },
  });

  emitToOrganization(orgId(employee), 'attendance:updated', {
    action: 'punch_in',
    attendance: att.toObject(),
    employee: { _id: employee._id, name: employee.name, employeeId: employee.employeeId },
  });

  emitToOrganization(orgId(employee), 'activity:new', {
    organizationId: orgId(employee),
    activityType: 'punch_in',
    employeeId: employee._id,
    employeeName: employee.name,
    timestamp: now,
  });

  notifySuperAdminsOfEvent(
    employee,
    'Punch in',
    lateMinutes > 0 ? `Late by ${lateMinutes} min` : 'On time',
    now,
    hasCoords(lat, lng) ? { lat: Number(lat), lng: Number(lng) } : undefined
  );

  return att;
}

async function punchOutEmployee({ employee, lat, lng, accuracy, notes }) {
  const att = await getOrCreateTodayAttendance(employee);
  blockIfOnLeave(att);
  if (!att.punchIn) {
    const e = new Error('No punch in found for today');
    e.statusCode = 400;
    throw e;
  }
  if (att.punchOut) {
    const e = new Error('Already punched out today');
    e.statusCode = 400;
    throw e;
  }

  const now = new Date();
  if (hasCoords(lat, lng)) {
    const la = Number(lat);
    const ln = Number(lng);
    att.punchOutLocation = { lat: la, lng: ln, accuracy, at: now };
    await Employee.findByIdAndUpdate(employee._id, {
      lastSeenLocation: { lat: la, lng: ln, accuracy, at: now },
    });
  }

  att.punchOut = now;
  att.totalHours = hoursDecimal(att.punchIn, now);
  att.overtime = await computeOvertimeHours(now, employee);
  try {
    att.earlyLeaveMinutes = await computeEarlyLeaveMinutes(now, employee, att.punchIn);
  } catch {
    att.earlyLeaveMinutes = 0; 
  }
  att.notes = notes || att.notes;
  att.onBreak = false;
  att.breakStartedAt = undefined;
  await att.save();

  await ActivityLog.create({
    organizationId: orgId(employee),
    employeeId: employee._id,
    activityType: 'punch_out',
    message: att.earlyLeaveMinutes > 0 ? `Punched out ${att.earlyLeaveMinutes} minute${att.earlyLeaveMinutes === 1 ? '' : 's'} early` : 'Punch out',
    location: hasCoords(lat, lng)
      ? { lat: Number(lat), lng: Number(lng), accuracy }
      : undefined,
    timestamp: now,
  });

  await createAdminNotification({
    organizationId: orgId(employee),
    type: 'punch_out',
    title: `${employee.name} punched out`,
    body: `Worked ${att.totalHours}h`,
    meta: { employeeId: employee._id, attendanceId: att._id },
  });

  emitToOrganization(orgId(employee), 'attendance:updated', {
    action: 'punch_out',
    attendance: att.toObject(),
    employee: { _id: employee._id, name: employee.name, employeeId: employee.employeeId },
  });

  emitToOrganization(orgId(employee), 'activity:new', {
    organizationId: orgId(employee),
    activityType: 'punch_out',
    employeeId: employee._id,
    employeeName: employee.name,
    timestamp: now,
  });

  notifySuperAdminsOfEvent(
    employee,
    'Punch out',
    `Worked ${att.totalHours}h`,
    now,
    hasCoords(lat, lng) ? { lat: Number(lat), lng: Number(lng) } : undefined
  );

  return att;
}

async function breakStart(employee) {
  const att = await getOrCreateTodayAttendance(employee);
  blockIfOnLeave(att);
  if (!att.punchIn || att.punchOut) {
    const e = new Error('Cannot start break');
    e.statusCode = 400;
    throw e;
  }
  if (att.onBreak) {
    const e = new Error('Already on break');
    e.statusCode = 400;
    throw e;
  }
  att.onBreak = true;
  att.breakStartedAt = new Date();
  await att.save();
  await ActivityLog.create({
    organizationId: orgId(employee),
    employeeId: employee._id,
    activityType: 'break_start',
    message: 'Break start',
    timestamp: att.breakStartedAt,
  });
  emitToOrganization(orgId(employee), 'activity:new', {
    organizationId: orgId(employee),
    activityType: 'break_start',
    employeeId: employee._id,
    employeeName: employee.name,
    timestamp: att.breakStartedAt,
  });
  notifySuperAdminsOfEvent(employee, 'Break', 'Started', att.breakStartedAt);
  return att;
}

async function breakEnd(employee) {
  const att = await getOrCreateTodayAttendance(employee);
  blockIfOnLeave(att);
  if (!att.onBreak) {
    const e = new Error('Not on break');
    e.statusCode = 400;
    throw e;
  }
  const startedAt = att.breakStartedAt;
  att.onBreak = false;
  att.breakStartedAt = undefined;
  await att.save();
  const now = new Date();
  await ActivityLog.create({
    organizationId: orgId(employee),
    employeeId: employee._id,
    activityType: 'break_end',
    message: 'Break end',
    timestamp: now,
  });
  emitToOrganization(orgId(employee), 'activity:new', {
    organizationId: orgId(employee),
    activityType: 'break_end',
    employeeId: employee._id,
    employeeName: employee.name,
    timestamp: now,
  });

  let eventLabel = 'Break';
  let eventDetail = 'Ended';
  if (startedAt) {
    const actualMinutes = minutesBetween(startedAt, now);
    const org = await Organization.findById(employee.organizationId).select('breakTimings timezone');
    const effective = getEffectiveBreakTimings(employee, org);
    const nearest = findBreakSlotForTime(effective, startedAt, org?.timezone);
    if (nearest) {
      if (actualMinutes > nearest.durationMins) {
        const extra = actualMinutes - nearest.durationMins;
        eventLabel = '⚠️ Over-break';
        eventDetail = `Took ${actualMinutes} min (Allowed: ${nearest.durationMins} min). Extra: ${extra} min`;
      } else {
        eventDetail = `Ended (${actualMinutes} min)`;
      }
    } else {
      eventDetail = `Ended (${actualMinutes} min)`;
    }
  }
  notifySuperAdminsOfEvent(employee, eventLabel, eventDetail, now);
  return att;
}

async function markAttendanceOnLeave(leaveDoc) {
  const orgId = leaveDoc.organizationId;
  const employeeId = leaveDoc.employeeId._id || leaveDoc.employeeId;
  const note = `Approved leave${leaveDoc.reason ? ` — ${leaveDoc.reason}` : ''}`;

  const days = [];
  const tz = await getOrgTimezone(orgId);
  const ymd = (d) => new Date(d).toISOString().slice(0, 10);
  let curStr = ymd(leaveDoc.startDate);
  const endStr = ymd(leaveDoc.endDate);
  while (curStr <= endStr) {
    days.push(dayBoundsOf(curStr, tz).dayStart);
    const next = new Date(`${curStr}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    curStr = next.toISOString().slice(0, 10);
  }

  await Promise.all(
    days.map((date) =>
      Attendance.findOneAndUpdate(
        { organizationId: orgId, employeeId, date },
        {
          $set: {
            status: 'on_leave',
            notes: note,
            lateMinutes: 0,
            overtime: 0,
            totalHours: 0,
            onBreak: false,
          },
          $unset: {
            punchIn: '',
            punchOut: '',
            punchInLocation: '',
            punchOutLocation: '',
            breakStartedAt: '',
          },
          $setOnInsert: { organizationId: orgId, employeeId, date },
        },
        { upsert: true, setDefaultsOnInsert: true }
      )
    )
  );
}

module.exports = {
  getOrCreateTodayAttendance,
  blockIfOnLeave,
  punchInEmployee,
  punchOutEmployee,
  breakStart,
  breakEnd,
  markAttendanceOnLeave,
  computeLateMinutes,
  computeOvertimeHours,
  computeEarlyLeaveMinutes,
  shiftEndInstant,
  resolveShift,
  shiftStartInstant,
};