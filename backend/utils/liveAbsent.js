const Employee = require('../models/employee.model');
const Attendance = require('../models/attendance.model');
const OffDay = require('../models/offDay.model');
const { dayBoundsOf, zonedParts } = require('./dateHelpers');
const { timezoneGroupsForReq } = require('./orgTime');

const pad = (n) => String(n).padStart(2, '0');

async function liveAbsentees(req, { from, to, employeeId } = {}) {
  const single = employeeId && (from || to) && !(from && to);
  const lo = single ? from || to : from || '';
  const hi = single ? from || to : to || '';
  if (!lo || lo !== hi) return [];

  const groups = await timezoneGroupsForReq(req);
  const orgNames = new Map((req.orgDocs || []).map((o) => [String(o._id), o.name]));
  const out = [];
  await Promise.all(
    groups.map(async ({ ids, tz }) => {
      const p = zonedParts(new Date(), tz);
      if (lo !== `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`) return; // not this timezone's today
      const { dayStart, dayEnd } = dayBoundsOf(new Date(), tz);
      const empFilter = { organizationId: { $in: ids }, active: true };
      if (employeeId) empFilter._id = employeeId;
      const [emps, rows, offs] = await Promise.all([
        Employee.find(empFilter).select('name employeeId department organizationId').lean(),
        Attendance.find({ organizationId: { $in: ids }, date: { $gte: dayStart, $lte: dayEnd } })
          .select('employeeId')
          .lean(),
        OffDay.find({ organizationId: { $in: ids }, date: { $gte: dayStart, $lte: dayEnd } }),
      ]);
      const haveRow = new Set(rows.map((r) => String(r.employeeId)));
      emps
        .filter((e) => !haveRow.has(String(e._id)))
        .filter((e) => !offs.some((o) => String(o.organizationId) === String(e.organizationId) && o.coversEmployee(e)))
        .forEach((e) =>
          out.push({
            _id: `live-${e._id}`,
            virtual: true,
            organizationId: e.organizationId,
            employeeId: {
              _id: e._id,
              name: e.name,
              employeeId: e.employeeId,
              department: e.department,
              organizationId: req.allOrgs
                ? { _id: e.organizationId, name: orgNames.get(String(e.organizationId)) || '' }
                : e.organizationId,
            },
            date: dayStart,
            punchIn: null,
            punchOut: null,
            lateMinutes: 0,
            overtime: 0,
            totalHours: 0,
            status: 'absent',
          })
        );
    })
  );
  return out.sort((a, b) => (a.employeeId.name || '').localeCompare(b.employeeId.name || ''));
}

module.exports = { liveAbsentees };
