const asyncHandler = require('../utils/asyncHandler');
const OffDay = require('../models/offDay.model');
const Employee = require('../models/employee.model');
const Organization = require('../models/organization.model');
const orgScope = require('../utils/orgScope');
const { dayBoundsOf, istDayBounds } = require('../utils/dateHelpers');
const { getOrgTimezone, getOrgSundayOff, timezoneGroupsForReq, rangeFragment, andInto } = require('../utils/orgTime');
const {
  reclassifyAbsencesForOffDay,
  restoreAbsencesForRemovedOffDay,
  sundaysInWindow,
  isSundayInTz,
  removeRedundantSundayOffDays,
} = require('../services/offDay.service');

const AUTO_SUNDAY_PAST_DAYS = 31;
const AUTO_SUNDAY_FUTURE_DAYS = 90;

const list = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const groups = await timezoneGroupsForReq(req);

  const orgIds = req.allOrgs ? req.organizationIds || [] : [req.organizationId];
  const sundayOffOrgs = await Organization.find({ _id: { $in: orgIds }, sundayOff: true })
    .select('_id timezone')
    .lean();
  await Promise.all(
    sundayOffOrgs.map((org) => {
      const group = groups.find((g) => g.ids.some((id) => String(id) === String(org._id)));
      return removeRedundantSundayOffDays(org._id, group?.tz);
    })
  );

  const filter = { organizationId: orgScope(req) };
  if (from || to) {
    andInto(filter, rangeFragment(groups, { from, to }));
  }
  const items = await OffDay.find(filter)
    .populate('employeeIds', 'name employeeId')
    .sort({ date: -1 });

  const autoItems = sundayOffOrgs.flatMap((org) => {
    const group = groups.find((g) => g.ids.some((id) => String(id) === String(org._id)));
    const tz = group?.tz;
    const windowStart = from
      ? dayBoundsOf(from, tz).dayStart
      : istDayBounds(new Date(Date.now() - AUTO_SUNDAY_PAST_DAYS * 86400000), tz).dayStart;
    const windowEnd = to
      ? dayBoundsOf(to, tz).dayEnd
      : istDayBounds(new Date(Date.now() + AUTO_SUNDAY_FUTURE_DAYS * 86400000), tz).dayEnd;
    return sundaysInWindow(windowStart, windowEnd, tz).map((dayStart) => ({
        _id: `auto-sunday-${org._id}-${dayStart.toISOString().slice(0, 10)}`,
        organizationId: org._id,
        date: dayStart,
        type: 'weekly_off',
        label: 'Sunday Off',
        customLabel: '',
        scope: 'org',
        departments: [],
        employees: [],
        createdAt: null,
        isAuto: true,
      }));
  });

  const combined = [...items.map(serialize), ...autoItems].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ success: true, data: { items: combined } });
});

function serialize(doc) {
  return {
    _id: doc._id,
    organizationId: doc.organizationId,
    date: doc.date,
    type: doc.type,
    label: doc.displayLabel(),
    customLabel: doc.label,
    scope: doc.scope,
    departments: doc.departments,
    employees: doc.employeeIds,
    createdAt: doc.createdAt,
  };
}

const create = asyncHandler(async (req, res) => {
  const { date, type, label, scope, departments, employeeIds } = req.body;
  if (!date || !type) {
    res.status(400);
    throw new Error('date and type are required');
  }
  if (!['weekly_off', 'festival', 'other'].includes(type)) {
    res.status(400);
    throw new Error('Invalid type');
  }
  const resolvedScope = scope || 'org';
  if (!['org', 'department', 'employee'].includes(resolvedScope)) {
    res.status(400);
    throw new Error('Invalid scope');
  }
  if (resolvedScope === 'department' && (!Array.isArray(departments) || departments.length === 0)) {
    res.status(400);
    throw new Error('departments is required when scope is department');
  }
  if (resolvedScope === 'employee' && (!Array.isArray(employeeIds) || employeeIds.length === 0)) {
    res.status(400);
    throw new Error('employeeIds is required when scope is employee');
  }
  if (resolvedScope === 'employee') {
    const count = await Employee.countDocuments({
      _id: { $in: employeeIds },
      organizationId: req.organizationId,
    });
    if (count !== employeeIds.length) {
      res.status(400);
      throw new Error('One or more employees do not belong to this organization');
    }
  }

  const tz = await getOrgTimezone(req.organizationId);
  const { dayStart } = dayBoundsOf(date, tz);
  const organizationId = req.organizationId;

  if (isSundayInTz(dayStart, tz) && (await getOrgSundayOff(organizationId))) {
    res.status(400);
    throw new Error("Sunday is already an automatic off day for this organization's Sunday Off setting");
  }

  const offDay = await OffDay.create({
    organizationId,
    date: dayStart,
    type,
    label: label || '',
    scope: resolvedScope,
    departments: resolvedScope === 'department' ? departments : [],
    employeeIds: resolvedScope === 'employee' ? employeeIds : [],
    createdBy: req.admin._id,
  });


  const reclassified = await reclassifyAbsencesForOffDay(offDay);

  res.status(201).json({
    success: true,
    data: { ...serialize(offDay), reclassifiedCount: reclassified.modifiedCount || 0 },
  });
});

const remove = asyncHandler(async (req, res) => {
  const offDay = await OffDay.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!offDay) {
    res.status(404);
    throw new Error('Off day not found');
  }
  await OffDay.deleteOne({ _id: offDay._id });
  await restoreAbsencesForRemovedOffDay(offDay);
  res.json({ success: true, data: { id: offDay._id } });
});

module.exports = { list, create, remove };
