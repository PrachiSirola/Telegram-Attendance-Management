const { validationResult } = require('express-validator');
const Employee = require('../models/employee.model');
const asyncHandler = require('../utils/asyncHandler');
const orgScope = require('../utils/orgScope');
const { createEmployeePayload, normalizeBreakTimings } = require('../services/employee.service');
const { telegramBotUsername } = require('../config/env');
const ensureLeaveBalances = require('../utils/ensureLeaveBalances');
const { nextEmployeeId, peekNextEmployeeId } = require('../services/employeeId.service');
const Attendance = require('../models/attendance.model');
const ActivityLog = require('../models/activityLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const { timezoneGroupsForReq, rangeFragment, andInto } = require('../utils/orgTime');

const orgFilter = (req) => ({ organizationId: orgScope(req) });

const OPTION_FIELDS = new Set([
  'name', 'employeeId', 'department', 'email', 'active',
  'clBalance', 'clTotal', 'slBalance', 'slTotal',
]);

const HEAL_RECHECK_MS = 60 * 1000;
const healCleanAt = new Map();

const list = asyncHandler(async (req, res) => {
  const { q, department, active, fields, page = 1, limit = 20 } = req.query;
  const slim = typeof fields === 'string' ? fields.split(',').filter((f) => OPTION_FIELDS.has(f)) : [];
  const filter = { ...orgFilter(req) };
  if (q) {
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { employeeId: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') },
    ];
  }
  if (department) filter.department = department;
  if (active !== undefined) filter.active = active === 'true';

  const skip = (Number(page) - 1) * Number(limit);
  const runList = () => {
    let query = Employee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    if (slim.length) {
      query = query.select(slim.join(' ')).lean();
    } else if (req.allOrgs) {
      query = query.populate('organizationId', 'name slug');
    }
    return Promise.all([query, Employee.countDocuments(filter)]);
  };

  const healKey = JSON.stringify([filter.organizationId, filter.department, filter.active]);
  const recentlyClean = !q && Date.now() - (healCleanAt.get(healKey) || 0) < HEAL_RECHECK_MS;
  const [needsHeal, firstRead] = await Promise.all([
    recentlyClean
      ? null
      : Employee.exists({
          $and: [filter, { $or: [{ leaveBalanceYear: null }, { clTotal: 0, slTotal: 0 }] }],
        }),
    runList(),
  ]);
  if (!q && !recentlyClean && !needsHeal) healCleanAt.set(healKey, Date.now());
  let [items, total] = firstRead;
  if (needsHeal) {
    await ensureLeaveBalances().catch(() => {});
    [items, total] = await runList();
  }
  res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit) } });
});

const stats = asyncHandler(async (req, res) => {
  const orgOnly = orgFilter(req);
  const { q, department, active } = req.query;
  const base = { ...orgOnly };
  if (q) {
    base.$or = [
      { name: new RegExp(q, 'i') },
      { employeeId: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') },
    ];
  }
  if (department) base.department = department;
  const shown = active !== undefined ? { ...base, active: active === 'true' } : base;
  const [baseTotal, baseActive, allDepartments, shownDepartments] = await Promise.all([
    Employee.countDocuments(base),
    Employee.countDocuments({ ...base, active: true }),
    Employee.distinct('department', orgOnly),
    Employee.distinct('department', shown),
  ]);
  let total = baseTotal;
  let activeCount = baseActive;
  if (active !== undefined) {
    total = active === 'true' ? baseActive : baseTotal - baseActive;
    activeCount = active === 'true' ? baseActive : 0;
  }
  res.json({
    success: true,
    data: {
      total,
      active: activeCount,
      departments: allDepartments.filter(Boolean).sort(),
      shownDepartments: shownDepartments.filter(Boolean).length,
    },
  });
});

const nextId = asyncHandler(async (req, res) => {
  if (!req.organizationId) {
    res.status(400);
    throw new Error('Select a single organization to add an employee');
  }
  try {
    res.json({ success: true, data: { employeeId: await peekNextEmployeeId(req.organizationId) } });
  } catch (e) {
    res.status(503);
    throw new Error('Could not generate an employee ID. Please try again.');
  }
});

const getOne = asyncHandler(async (req, res) => {
  const doc = await Employee.findOne({ _id: req.params.id, ...orgFilter(req) });
  if (!doc) {
    res.status(404);
    throw new Error('Employee not found');
  }
  let org = null;
  try {
    org =
      (req.orgDocs || []).find((o) => String(o._id) === String(doc.organizationId)) ||
      (await require('../utils/authCache').getOrg(doc.organizationId));
  } catch (e) {
    org = null;
  }
  if (!org) {
    await doc.populate('organizationId', 'name slug');
    return res.json({ success: true, data: doc });
  }
  const out = doc.toJSON();
  out.organizationId = { _id: org._id, name: org.name, slug: org.slug };
  return res.json({ success: true, data: out });
});

const BREAK_ROW_CAP = 1000;
const summary = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const employeeId = req.params.id;
  const scope = orgScope(req);

  const attFilter = { organizationId: scope, employeeId };
  const actFilter = { organizationId: scope, employeeId };
  const groups = await timezoneGroupsForReq(req);
  const rangeOf = (field) => {
    const one = (from || to) && !(from && to) ? from || to : null;
    return rangeFragment(groups, one ? { from: one, to: one, field } : { from, to, field });
  };
  if (from || to) {
    andInto(attFilter, rangeOf('date'));
    andInto(actFilter, rangeOf('timestamp'));
  }
  const leaveFilter = { organizationId: scope, employeeId, status: 'approved' };
  const fromD = from ? new Date(`${from}T00:00:00.000Z`) : null;
  const toD = to ? new Date(`${to}T23:59:59.999Z`) : null;
  if (toD && !Number.isNaN(toD.getTime())) leaveFilter.startDate = { $lte: toD };
  if (fromD && !Number.isNaN(fromD.getTime())) leaveFilter.endDate = { $gte: fromD };

  const sumIf = (cond, field) => ({ $sum: { $cond: [cond, field, 0] } });
  const [attRows, actRows, onLeave, breaks] = await Promise.all([
    Attendance.aggregate([
      { $match: Attendance.find(attFilter).cast(Attendance) },
      {
        $group: {
          _id: null,
          present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$lateMinutes', 0] }, 0] }, 1, 0] } },
          overtimeCount: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$overtime', 0] }, 0] }, 1, 0] } },
          totalHours: { $sum: { $ifNull: ['$totalHours', 0] } },
          overtimeHours: { $sum: { $ifNull: ['$overtime', 0] } },
        },
      },
    ]),
    ActivityLog.aggregate([
      { $match: ActivityLog.find(actFilter).cast(ActivityLog) },
      {
        $group: {
          _id: null,
          activities: { $sum: 1 },
          tasks: { $sum: { $cond: [{ $eq: ['$activityType', 'task_update'] }, 1, 0] } },
        },
      },
    ]),
    LeaveRequest.countDocuments(leaveFilter),
    ActivityLog.find({ ...actFilter, activityType: { $in: ['break_start', 'break_end'] } })
      .select('activityType timestamp')
      .sort({ timestamp: -1 })
      .limit(BREAK_ROW_CAP)
      .lean(),
  ]);
  const a = attRows[0] || {};
  const c = actRows[0] || {};
  const r2 = (n) => Math.round((n || 0) * 100) / 100;
  res.json({
    success: true,
    data: {
      present: a.present || 0,
      absent: a.absent || 0,
      late: a.late || 0,
      overtimeCount: a.overtimeCount || 0,
      totalHours: r2(a.totalHours),
      overtimeHours: r2(a.overtimeHours),
      tasks: c.tasks || 0,
      activities: c.activities || 0,
      onLeave,
      breaks,
    },
  });
});

const create = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0].msg);
  }
  const payload = await createEmployeePayload(req.body, req.organizationId);
  if (payload.email) {
    const exists = await Employee.findOne({ organizationId: req.organizationId, email: payload.email });
    if (exists) {
      res.status(400);
      throw new Error('employeeId or email already exists in this organization');
    }
  }

  let doc = null;
  for (let attempt = 0; attempt < 10 && !doc; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 40 * attempt)));
    try {
      payload.employeeId = await nextEmployeeId(req.organizationId);
    } catch (e) {
      res.status(503);
      throw new Error('Could not generate an employee ID. The employee was not created — please try again.');
    }
    try {
      doc = await Employee.create(payload);
    } catch (e) {
      const dup = e && (e.code === 11000 || /E11000|duplicate key/i.test(String(e.message)));
      if (!dup) throw e;
      if (payload.email && (await Employee.exists({ organizationId: req.organizationId, email: payload.email }))) {
        res.status(400);
        throw new Error('employeeId or email already exists in this organization');
      }
    }
  }
  if (!doc) {
    res.status(503);
    throw new Error('Could not generate a unique employee ID. The employee was not created — please try again.');
  }
  const inviteUrl = `https://t.me/${telegramBotUsername}?start=${encodeURIComponent(doc.registrationCode)}`;
  res.status(201).json({
    success: true,
    data: doc,
    meta: { registrationLink: inviteUrl },
  });
});

const update = asyncHandler(async (req, res) => {
  const doc = await Employee.findOne({ _id: req.params.id, ...orgFilter(req) });
  if (!doc) {
    res.status(404);
    throw new Error('Employee not found');
  }
  if (req.body.employeeId !== undefined && String(req.body.employeeId) !== String(doc.employeeId)) {
    res.status(400);
    throw new Error('Employee ID is generated automatically and cannot be changed');
  }
  const allowed = [
    'name',
    'email',
    'phone',
    'department',
    'role',
    'shiftTiming',
    'joiningDate',
    'active',
    'leaveBalanceDays',
  ];
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) doc[k] = req.body[k];
  });

  if (req.body.email !== undefined) doc.email = req.body.email || undefined;
  if (req.body.breakTimings !== undefined) {
    doc.breakTimings = normalizeBreakTimings(req.body.breakTimings);
  }
  await doc.save();
  res.json({ success: true, data: doc });
});

const remove = asyncHandler(async (req, res) => {
  const doc = await Employee.findOneAndDelete({ _id: req.params.id, ...orgFilter(req) });
  if (!doc) {
    res.status(404);
    throw new Error('Employee not found');
  }
  res.json({ success: true, message: 'Deleted' });
});

const registrationLink = asyncHandler(async (req, res) => {
  const doc = await Employee.findOne({ _id: req.params.id, ...orgFilter(req) });
  if (!doc) {
    res.status(404);
    throw new Error('Employee not found');
  }
  const inviteUrl = `https://t.me/${telegramBotUsername}?start=${encodeURIComponent(doc.registrationCode)}`;
  res.json({ success: true, data: { registrationCode: doc.registrationCode, inviteUrl } });
});

module.exports = { list, stats, nextId, getOne, summary, create, update, remove, registrationLink };