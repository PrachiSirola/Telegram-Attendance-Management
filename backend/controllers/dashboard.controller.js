const Employee = require('../models/employee.model');
const Attendance = require('../models/attendance.model');
const asyncHandler = require('../utils/asyncHandler');
const orgScope = require('../utils/orgScope');
const { dayBoundsOf } = require('../utils/dateHelpers');
const { timezoneGroupsForReq, rangeFragment, andInto } = require('../utils/orgTime');
const { findOffDaysForOrgsOnDate } = require('../services/offDay.service');
const { liveAbsentees } = require('../utils/liveAbsent');

async function resolveWindow(req, knownGroups) {
  const { from, to } = req.query;
  const groups = knownGroups || (await timezoneGroupsForReq(req));
  const tz = groups[0].tz; 
  if (req.query.match === 'counts') {
    const single = req.query.employeeId && (from || to) && !(from && to) ? from || to : null;
    const fragment = single
      ? rangeFragment(groups, { from: single, to: single })
      : from || to
        ? rangeFragment(groups, { from, to })
        : null;
    const now = new Date();
    return { dayStart: now, dayEnd: now, isDefaultToday: false, fragment, tz };
  }

  const single = !from && !to ? null : from && to ? null : from || to;
  const fragment = rangeFragment(groups, {
    from: single || from,
    to: single || to,
    defaultToday: !from && !to,
  });

  if (!from && !to) {
    const b = dayBoundsOf(new Date(), tz);
    return { dayStart: b.dayStart, dayEnd: b.dayEnd, isDefaultToday: true, fragment, tz };
  }
  if (from && to) {
    return {
      dayStart: dayBoundsOf(from, tz).dayStart,
      dayEnd: dayBoundsOf(to, tz).dayEnd,
      isDefaultToday: false,
      fragment,
      tz,
    };
  }
  const bounds = dayBoundsOf(single, tz);
  return { dayStart: bounds.dayStart, dayEnd: bounds.dayEnd, isDefaultToday: false, fragment, tz };
}

async function todayOffDayChecker(req, knownGroups) {
  const groups = knownGroups || (await timezoneGroupsForReq(req));
  const byOrg = new Map();
  const perGroup = await Promise.all(
    groups.map(({ ids, tz }) => findOffDaysForOrgsOnDate(ids, new Date(), tz))
  );
  perGroup.forEach((entries) =>
    entries.forEach((en) => {
      const k = String(en.organizationId);
      if (!byOrg.has(k)) byOrg.set(k, []);
      byOrg.get(k).push(en);
    })
  );
  return (employee) => {
    const k = String(employee.organizationId?._id || employee.organizationId);
    return (byOrg.get(k) || []).some((en) => en.coversEmployee(employee));
  };
}

const summary = asyncHandler(async (req, res) => {
  const orgId = orgScope(req);
  const groups = await timezoneGroupsForReq(req);
  const { dayStart, dayEnd, isDefaultToday, fragment, tz } = await resolveWindow(req, groups);
  const hasPunchIn = { $ne: [{ $ifNull: ['$punchIn', null] }, null] };
  const flag = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
  const [totalEmployeesCount, [agg], todayExtras] = await Promise.all([
    isDefaultToday ? null : Employee.countDocuments({ active: true, organizationId: orgId }),
    Attendance.aggregate([
      { $match: Attendance.find(andInto({ organizationId: orgId }, fragment)).cast(Attendance) },
      {
        $group: {
          _id: null,
          present: flag(hasPunchIn),
          late: flag({ $and: [hasPunchIn, { $gt: ['$lateMinutes', 0] }] }),
          active: flag({ $and: [hasPunchIn, { $eq: [{ $ifNull: ['$punchOut', null] }, null] }] }),
          earlyLeave: flag({ $and: [hasPunchIn, { $gt: [{ $ifNull: ['$earlyLeaveMinutes', 0] }, 0] }] }),
          onLeave: flag({ $eq: ['$status', 'on_leave'] }),
          absentStored: flag({
            $and: [
              { $not: [hasPunchIn] },
              {
                $or: [
                  { $eq: ['$status', 'absent'] },
                  { $not: [{ $in: [{ $ifNull: ['$status', ''] }, ['on_leave', 'day_off']] }] },
                ],
              },
            ],
          }),
        },
      },
    ]),
    isDefaultToday
      ? Promise.all([
          todayOffDayChecker(req, groups),
          Employee.find({ active: true, organizationId: orgId }).select('department organizationId').lean(),
        ])
      : null,
  ]);
  const totalEmployees = isDefaultToday ? todayExtras[1].length : totalEmployeesCount;
  const counts = agg || {};
  const presentToday = counts.present || 0;
  const lateToday = counts.late || 0;
  const activeEmployees = counts.active || 0;
  const earlyLeaveToday = counts.earlyLeave || 0;
  const onLeaveToday = counts.onLeave || 0;

  let absentToday;
  if (isDefaultToday) {
    const [isOff, activeRoster] = todayExtras;
    const offDayCount = activeRoster.filter((e) => isOff(e)).length;
    absentToday = Math.max(0, totalEmployees - presentToday - onLeaveToday - offDayCount);
  } else {
    absentToday = counts.absentStored || 0;
  }

  const eligibleRecords = presentToday + absentToday;
  const attendanceRate =
    eligibleRecords > 0 ? Math.round((presentToday / eligibleRecords) * 1000) / 10 : null;

  res.json({
    success: true,
    data: {
      totalEmployees,
      presentToday,
      absentToday,
      onLeaveToday,
      lateToday,
      activeEmployees,
      earlyLeaveToday,
      eligibleRecords,
      attendanceRate,
      isToday: isDefaultToday,
    },
  });
});


const details = asyncHandler(async (req, res) => {
  const orgId = orgScope(req);
  const { category } = req.params;
  const { employeeId } = req.query;
  const { dayStart, dayEnd, isDefaultToday, fragment, tz } = await resolveWindow(req);

  if (category === 'total') {
    const employees = await Employee.find({ active: true, organizationId: orgId }).select(
      'name employeeId department'
    );
    return res.json({ success: true, data: { items: employees } });
  }

  const attendanceFilter = andInto({ organizationId: orgId }, fragment);
  if (employeeId) attendanceFilter.employeeId = employeeId;

  const rows = await Attendance.find(attendanceFilter)
    .populate({
      path: 'employeeId',
      select: 'name employeeId department organizationId',
      populate: { path: 'organizationId', select: 'name' },
    })
    .sort({ date: -1 })
    .select('employeeId date punchIn punchOut lateMinutes earlyLeaveMinutes overtime totalHours status');


  const combo = category === 'absentOrLeave';
  let filtered;
  if (category === 'all') {

    filtered = rows.filter((a) => a.status !== 'day_off');
  } else if (category === 'present') {
    filtered = rows.filter((a) => a.punchIn);
  } else if (category === 'late') {
    filtered = rows.filter((a) => a.punchIn && a.lateMinutes > 0);
  } else if (category === 'earlyLeave') {

    filtered = rows.filter((a) => a.punchIn && a.earlyLeaveMinutes > 0);
  } else if (category === 'active') {
    filtered = rows.filter((a) => a.punchIn && !a.punchOut);
  } else if (category === 'onLeave') {
    filtered = rows.filter((a) => a.status === 'on_leave');
  } else if (category === 'absent' || combo) {
    if (isDefaultToday) {

      const presentOrLeaveIds = new Set(
        rows
          .filter((a) => a.punchIn || a.status === 'on_leave')
          .map((a) => String(a.employeeId?._id || a.employeeId))
      );
      const isOff = await todayOffDayChecker(req);
      const rosterFilter = { active: true, organizationId: orgId };
      if (employeeId) rosterFilter._id = employeeId;
      const allEmployees = await Employee.find(rosterFilter)
        .select('name employeeId department organizationId')
        .populate('organizationId', 'name');
      filtered = allEmployees
        .filter((e) => !presentOrLeaveIds.has(String(e._id)))
        .filter((e) => !isOff(e))
        .map((e) => ({
          _id: e._id,
          employeeId: e,
          date: dayStart,
          punchIn: null,
          punchOut: null,
          lateMinutes: 0,
          overtime: 0,
          totalHours: 0,
          status: 'absent',
        }));
    } else {

      filtered = rows.filter(
        (a) => !a.punchIn && (a.status === 'absent' || (a.status !== 'on_leave' && a.status !== 'day_off'))
      );
    }
  } else {
    res.status(400);
    throw new Error('Unknown category');
  }
  if (combo) filtered = [...filtered, ...rows.filter((a) => a.status === 'on_leave')];

  if (req.query.match === 'counts' && (category === 'absent' || combo || category === 'all')) {
    const live = await liveAbsentees(req, { from: req.query.from, to: req.query.to, employeeId });
    if (live.length) filtered = [...live, ...filtered];
  }

  res.json({ success: true, data: { items: filtered } });
});

module.exports = { summary, details };