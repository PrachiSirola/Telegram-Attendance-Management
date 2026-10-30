const { validationResult } = require('express-validator');
const Attendance = require('../models/attendance.model');
const Employee = require('../models/employee.model');
const OffDay = require('../models/offDay.model');
const { repairOffDays } = require('../services/offDay.service');
const { liveAbsentees } = require('../utils/liveAbsent');
const asyncHandler = require('../utils/asyncHandler');
const {
  punchInEmployee,
  punchOutEmployee,
  getOrCreateTodayAttendance,
  computeLateMinutes,
  computeOvertimeHours,
  computeEarlyLeaveMinutes,
  shiftEndInstant,
  resolveShift,
  shiftStartInstant,
} = require('../services/attendance.service');
const { parseClientDateTime } = require('../utils/dateHelpers');
const { listWithEmployee } = require('../utils/lookup');
const { getOrgTimezone, timezoneGroupsForReq, rangeFragment, andInto } = require('../utils/orgTime');
const orgScope = require('../utils/orgScope');
const { emitToOrganization } = require('../services/socket.service');

const adminPunchIn = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0].msg);
  }
  const employee = await Employee.findOne({
    _id: req.body.employeeId,
    organizationId: req.organizationId,
  });
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  const lat =
    req.body.lat != null && req.body.lat !== '' ? Number(req.body.lat) : undefined;
  const lng =
    req.body.lng != null && req.body.lng !== '' ? Number(req.body.lng) : undefined;
  const att = await punchInEmployee({
    employee,
    lat,
    lng,
    accuracy: req.body.accuracy != null ? Number(req.body.accuracy) : undefined,
    selfieRelativePath: req.body.selfiePath,
    selfiePublicId: req.body.selfiePublicId,
    ipAddress: req.ip,
    notes: req.body.notes,
  });
  res.json({ success: true, data: att });
});

const adminPunchOut = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0].msg);
  }
  const employee = await Employee.findOne({
    _id: req.body.employeeId,
    organizationId: req.organizationId,
  });
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  const att = await punchOutEmployee({
    employee,
    lat: req.body.lat != null ? Number(req.body.lat) : undefined,
    lng: req.body.lng != null ? Number(req.body.lng) : undefined,
    accuracy: req.body.accuracy != null ? Number(req.body.accuracy) : undefined,
    notes: req.body.notes,
  });
  res.json({ success: true, data: att });
});

const attendanceCounts = asyncHandler(async (req, res) => {
  const { employeeId, from, to, excludeOffDays, liveAbsent } = req.query;
  const filter = { organizationId: orgScope(req) };

  if (excludeOffDays === 'true') filter.status = { $ne: 'day_off' };
  if (employeeId) {
    const emp = await Employee.findOne({ _id: employeeId, organizationId: orgScope(req) });
    if (!emp) {
      res.status(400);
      throw new Error('Invalid employee');
    }
    filter.employeeId = employeeId;
  }
  {
    const groups = await timezoneGroupsForReq(req);
    let frag = null;
    if (employeeId && (from || to) && !(from && to)) {
      const singleDate = from || to;
      frag = rangeFragment(groups, { from: singleDate, to: singleDate });
    } else if (from || to) {
      frag = rangeFragment(groups, { from, to });
    }
    if (frag) andInto(filter, frag);
    if (excludeOffDays === 'true') {
      const offFilter = { organizationId: orgScope(req) };
      if (frag) andInto(offFilter, frag);
      await repairOffDays(await OffDay.find(offFilter).limit(500));
    }
  }
  const hasPunchIn = { $ne: [{ $ifNull: ['$punchIn', null] }, null] };
  const [row] = await Attendance.aggregate([
    { $match: Attendance.find(filter).cast(Attendance) },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: { $sum: { $cond: [hasPunchIn, 1, 0] } },
        late: { $sum: { $cond: [{ $and: [hasPunchIn, { $gt: ['$lateMinutes', 0] }] }, 1, 0] } },
        earlyLeave: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$earlyLeaveMinutes', 0] }, 0] }, 1, 0] } },
        absent: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$status', 'absent'] },
                  {
                    $and: [
                      { $not: [hasPunchIn] },
                      { $not: [{ $in: [{ $ifNull: ['$status', ''] }, ['on_leave', 'day_off']] }] },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  let { total = 0, present = 0, late = 0, earlyLeave = 0, absent = 0 } = row || {};
  if (liveAbsent === 'true') {
    const n = (await liveAbsentees(req, { from, to, employeeId })).length;
    total += n;
    absent += n;
  }

  res.json({ success: true, data: { total, present, absent, late, earlyLeave } });
});

const listAttendance = asyncHandler(async (req, res) => {
  const { employeeId, from, to, status, late, earlyLeave, clockedIn, hasOvertime, groupOffDays, liveAbsent, page = 1, limit = 50 } = req.query;
  const filter = { organizationId: orgScope(req) };
  const grouping = groupOffDays === 'true';
  let employeeCheck = null;
  if (employeeId) {
    employeeCheck = Employee.findOne({ _id: employeeId, organizationId: orgScope(req) }).select('department').lean().exec();
    filter.employeeId = employeeId;
  }
  const statusList = status ? String(status).split(',').filter(Boolean) : null;
  let wantsOffDays = false;
  if (grouping) {
    wantsOffDays =
      (!statusList || statusList.includes('day_off')) &&
      late !== 'true' && earlyLeave !== 'true' && clockedIn !== 'true' && hasOvertime !== 'true';
    const rowStatuses = statusList ? statusList.filter((s) => s !== 'day_off') : null;
    if (!rowStatuses) filter.status = { $ne: 'day_off' };
    else filter.status = rowStatuses.length === 1 ? rowStatuses[0] : { $in: rowStatuses };
  } else if (status) {
    filter.status = String(status).includes(',') ? { $in: String(status).split(',') } : status;
  }
  if (late === 'true') filter.lateMinutes = { $gt: 0 };
  if (earlyLeave === 'true') filter.earlyLeaveMinutes = { $gt: 0 };
  if (clockedIn === 'true') {
    filter.punchIn = { $ne: null };
    filter.punchOut = null;
  }
  if (hasOvertime === 'true') {
    filter.overtime = { $gt: 0 };
  }
  let rangeFrag = null;
  {
    const groups = await timezoneGroupsForReq(req);
    if (employeeId && (from || to) && !(from && to)) {
      const singleDate = from || to;
      rangeFrag = rangeFragment(groups, { from: singleDate, to: singleDate });
    } else if (from || to) {
      rangeFrag = rangeFragment(groups, { from, to });
    }
    if (rangeFrag) andInto(filter, rangeFrag);
  }
  const skip = (Number(page) - 1) * Number(limit);
  const wantsLive =
    liveAbsent === 'true' &&
    (!statusList || statusList.includes('absent')) &&
    late !== 'true' && earlyLeave !== 'true' && clockedIn !== 'true' && hasOvertime !== 'true';
  const live = wantsLive ? await liveAbsentees(req, { from, to, employeeId }) : [];
  const liveSlice = live.slice(skip, skip + Number(limit));
  const dbSkip = Math.max(0, skip - live.length);
  const dbLimit = Number(limit) - liveSlice.length;
  const runList = () =>
    listWithEmployee(Attendance, {
      filter,
      sort: { date: -1 },
      skip: dbSkip,
      limit: Math.max(1, dbLimit),
      select: 'name employeeId department',
      allOrgs: req.allOrgs,
    });
  const loadOffDays = async (empDoc) => {
    const offFilter = { organizationId: orgScope(req) };
    if (rangeFrag) andInto(offFilter, rangeFrag);
    const all = await OffDay.find(offFilter).sort({ date: -1 }).limit(500);
    const repaired = await repairOffDays(all);
    const visible = empDoc ? all.filter((o) => o.coversEmployee(empDoc)) : all;
    const empIds = [...new Set(visible.filter((o) => o.scope === 'employee').flatMap((o) => o.employeeIds.map(String)))];
    const names = new Map();
    if (empIds.length) {
      (await Employee.find({ _id: { $in: empIds } }).select('name').lean()).forEach((e) => names.set(String(e._id), e.name));
    }
    const orgNames = new Map((req.orgDocs || []).map((o) => [String(o._id), o.name]));
    const items = visible.map((o) => ({
      _id: o._id,
      organizationId: o.organizationId,
      organizationName: req.allOrgs ? orgNames.get(String(o.organizationId)) || '' : undefined,
      date: o.date,
      type: o.type,
      label: o.displayLabel(),
      scope: o.scope,
      departments: o.departments,
      employees: o.employeeIds.map((id) => names.get(String(id))).filter(Boolean),
    }));
    return { items, repaired };
  };
  const offDaysP = grouping && wantsOffDays ? Promise.resolve(employeeCheck).then((e) => loadOffDays(e)) : null;
  let [listed, emp, offRes] = await Promise.all([runList(), employeeCheck, offDaysP]);
  if (offRes?.repaired) listed = await runList();
  if (employeeId && !emp) {
    res.status(400);
    throw new Error('Invalid employee');
  }
  const items = dbLimit > 0 ? [...liveSlice, ...listed.items] : liveSlice;
  const total = listed.total + live.length;
  const data = { items, total, page: Number(page), limit: Number(limit) };
  if (grouping) data.offDays = Number(page) === 1 && offRes ? offRes.items : [];
  res.json({ success: true, data });
});

const correctAttendance = asyncHandler(async (req, res) => {
  const att = await Attendance.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!att) {
    res.status(404);
    throw new Error('Attendance not found');
  }
  const allowed = [
    'punchIn',
    'punchOut',
    'totalHours',
    'status',
    'lateMinutes',
    'overtime',
    'notes',
  ];
  const tz = await getOrgTimezone(att.organizationId);
  const originalLate = att.lateMinutes || 0;
  const originalEarly = att.earlyLeaveMinutes || 0;
  let punchInChanged = false;
  let punchOutChanged = false;
  const manualStatus =
    req.body.status !== undefined && req.body.status !== att.status ? req.body.status : null;
  allowed.forEach((k) => {
    if (req.body[k] === undefined) return;
    if (k === 'punchIn' || k === 'punchOut') {
      const next = req.body[k] ? parseClientDateTime(req.body[k], tz) : undefined;
      if (next && Number.isNaN(next.getTime())) {
        res.status(400);
        throw new Error(`Invalid ${k} value`);
      }
      const cur = att[k] ? new Date(att[k]) : undefined;
      const curMin = cur ? Math.floor(cur.getTime() / 60000) : null;
      const nextMin = next ? Math.floor(next.getTime() / 60000) : null;
      if (curMin !== nextMin) {
        att[k] = next;
        if (k === 'punchIn') punchInChanged = true;
        else punchOutChanged = true;
      }
    } else {
      att[k] = req.body[k];
    }
  });
  if (
    !punchInChanged &&
    att.punchIn &&
    req.body.lateMinutes !== undefined &&
    Math.max(0, Math.round(Number(req.body.lateMinutes) || 0)) !== originalLate
  ) {
    const emp = await Employee.findOne({ _id: att.employeeId, organizationId: att.organizationId });
    if (emp) {
      const n = Math.max(0, Math.round(Number(req.body.lateMinutes) || 0));
      const start = await shiftStartInstant(att.punchIn, emp);
      att.punchIn = new Date(start.getTime() + n * 60000);
      punchInChanged = true;
    }
  }
  if (
    !punchOutChanged &&
    req.body.earlyLeaveMinutes !== undefined &&
    Math.max(0, Math.round(Number(req.body.earlyLeaveMinutes) || 0)) !== originalEarly
  ) {
    const n = Math.max(0, Math.round(Number(req.body.earlyLeaveMinutes) || 0));
    const emp = await Employee.findOne({ _id: att.employeeId, organizationId: att.organizationId });
    if (emp && (att.punchIn || att.punchOut) && (att.punchOut || n > 0)) {
      const end = await shiftEndInstant(att.punchIn || att.punchOut, emp);
      att.punchOut = new Date(end.getTime() - n * 60000);
      punchOutChanged = true;
    }
  }
  if (att.punchIn && att.punchOut && att.punchOut < att.punchIn) {
    res.status(400);
    throw new Error('Punch out cannot be earlier than punch in');
  }
  if (att.punchIn && att.punchOut) {
    const ms = att.punchOut - att.punchIn;
    att.totalHours = Math.round((ms / 3600000) * 100) / 100;
  }
  if (punchInChanged || punchOutChanged) {
    const emp = await Employee.findOne({ _id: att.employeeId, organizationId: att.organizationId });
    if (emp) {
      if (punchInChanged) {
        const derived = ['present', 'late', 'pending', 'absent', undefined, null];
        if (att.punchIn) {
          att.lateMinutes = await computeLateMinutes(att.punchIn, emp);
          const keepManual = manualStatus && !['present', 'late'].includes(manualStatus);
          if (keepManual) att.status = manualStatus;
          else if (derived.includes(att.status) || ['present', 'late'].includes(manualStatus)) {
            att.status = att.lateMinutes > 0 ? 'late' : 'present';
          }
        } else {
          att.lateMinutes = 0;
          if (['present', 'late'].includes(att.status)) att.status = 'absent';
        }
      }
      if (punchOutChanged) {
        att.overtime = att.punchOut ? await computeOvertimeHours(att.punchOut, emp) : 0;
      }
      if (punchOutChanged || punchInChanged) {
        att.earlyLeaveMinutes = att.punchOut ? await computeEarlyLeaveMinutes(att.punchOut, emp, att.punchIn) : 0;
      }
    }
  }
  await att.save();
  emitToOrganization(req.organizationId, 'attendance:updated', {
    action: 'corrected',
    attendance: att.toObject(),
  });
  res.json({ success: true, data: att });
});

const shiftInfo = asyncHandler(async (req, res) => {
  const att = await Attendance.findOne({ _id: req.params.id, organizationId: orgScope(req) }).select('employeeId organizationId');
  if (!att) {
    res.status(404);
    throw new Error('Attendance not found');
  }
  const emp = await Employee.findById(att.employeeId);
  let shift = null;
  try {
    shift = emp ? await resolveShift(emp) : null;
  } catch {
    shift = null;
  }
  res.json({ success: true, data: { shiftStart: shift?.start || null, shiftEnd: shift?.end || null } });
});

const todayForEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.employeeId,
    organizationId: req.organizationId,
  });
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  const att = await getOrCreateTodayAttendance(employee);
  res.json({ success: true, data: att });
});

module.exports = {
  adminPunchIn,
  adminPunchOut,
  listAttendance,
  attendanceCounts,
  correctAttendance,
  shiftInfo,
  todayForEmployee,
};