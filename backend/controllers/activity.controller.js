const ActivityLog = require('../models/activityLog.model');
const Attendance = require('../models/attendance.model');
const Employee = require('../models/employee.model');
const asyncHandler = require('../utils/asyncHandler');
const orgScope = require('../utils/orgScope');
const { notifySuperAdminsOfEvent } = require('../services/telegramNotify.service');
const { emitToOrganization } = require('../services/socket.service');
const { listWithEmployee } = require('../utils/lookup');

const { timezoneGroupsForReq, rangeFragment, andInto } = require('../utils/orgTime');
async function attachEarlyLeave(items) {
  const outs = items.filter((a) => a.activityType === 'punch_out' && a.employeeId);
  if (!outs.length) return items;
  const idOf = (a) => String(a.employeeId._id || a.employeeId);
  const times = outs.map((a) => new Date(a.timestamp).getTime());
  const rows = await Attendance.find({
    employeeId: { $in: [...new Set(outs.map(idOf))] },
    punchOut: { $ne: null },
    date: { $gte: new Date(Math.min(...times) - 36 * 3600000), $lte: new Date(Math.max(...times)) },
  })
    .select('employeeId date earlyLeaveMinutes')
    .lean();
  const byEmp = new Map();
  rows.forEach((r) => {
    const k = String(r.employeeId);
    if (!byEmp.has(k)) byEmp.set(k, []);
    byEmp.get(k).push(r);
  });
  outs.forEach((a) => {
    const ts = new Date(a.timestamp).getTime();
    const best = (byEmp.get(idOf(a)) || [])
      .filter((r) => new Date(r.date).getTime() <= ts && ts - new Date(r.date).getTime() < 36 * 3600000)
      .sort((x, y) => new Date(y.date) - new Date(x.date))[0];
    a.earlyLeaveMinutes = best?.earlyLeaveMinutes || 0;
  });
  return items;
}

const list = asyncHandler(async (req, res) => {
  const { employeeId, type, from, to, page = 1, limit = 50 } = req.query;
  const filter = { organizationId: orgScope(req) };
  if (employeeId) filter.employeeId = employeeId;
  if (type) filter.activityType = type;
  {
    const groups = await timezoneGroupsForReq(req);
    if (employeeId && (from || to) && !(from && to)) {
      const singleDate = from || to;
      andInto(filter, rangeFragment(groups, { from: singleDate, to: singleDate, field: 'timestamp' }));
    } else if (from || to) {
      andInto(filter, rangeFragment(groups, { from, to, field: 'timestamp' }));
    }
  }
  const skip = (Number(page) - 1) * Number(limit);
  const { items, total } = await listWithEmployee(ActivityLog, {
    filter,
    sort: { timestamp: -1 },
    skip,
    limit: Number(limit),
    select: 'name employeeId',
    allOrgs: req.allOrgs,
  });
  await attachEarlyLeave(items);
  res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit) } });
});

const counts = asyncHandler(async (req, res) => {
  const { employeeId, from, to } = req.query;
  const filter = { organizationId: orgScope(req) };
  if (employeeId) filter.employeeId = employeeId;
  {
    const groups = await timezoneGroupsForReq(req);
    if (employeeId && (from || to) && !(from && to)) {
      const singleDate = from || to;
      andInto(filter, rangeFragment(groups, { from: singleDate, to: singleDate, field: 'timestamp' }));
    } else if (from || to) {
      andInto(filter, rangeFragment(groups, { from, to, field: 'timestamp' }));
    }
  }
  const ofType = (t) => ({ $sum: { $cond: [{ $eq: ['$activityType', t] }, 1, 0] } });
  const [row] = await ActivityLog.aggregate([
    { $match: ActivityLog.find(filter).cast(ActivityLog) },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        punchIn: ofType('punch_in'),
        punchOut: ofType('punch_out'),
        breaks: ofType('break_start'),
        tasks: ofType('task_update'),
      },
    },
  ]);
  const { total = 0, punchIn = 0, punchOut = 0, breaks = 0, tasks = 0 } = row || {};
  res.json({ success: true, data: { total, punchIn, punchOut, breaks, tasks } });
});

const create = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.body.employeeId,
    organizationId: req.organizationId,
  });
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  const doc = await ActivityLog.create({
    organizationId: req.organizationId,
    employeeId: req.body.employeeId,
    activityType: req.body.activityType || 'other',
    message: req.body.message,
    location: req.body.location,
    image: req.body.image,
    timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
  });
  emitToOrganization(req.organizationId, 'activity:new', {
    ...doc.toObject(),
    organizationId: req.organizationId,
    employeeName: req.body.employeeName,
  });
  notifySuperAdminsOfEvent(
    employee,
    'Activity',
    `${doc.activityType.replace('_', ' ')}${doc.message ? ` — ${doc.message}` : ''}`,
    doc.timestamp
  );
  res.status(201).json({ success: true, data: doc });
});

module.exports = { list, counts, create };