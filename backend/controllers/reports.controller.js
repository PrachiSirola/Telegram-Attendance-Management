const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Attendance = require('../models/attendance.model');
const Employee = require('../models/employee.model');
const asyncHandler = require('../utils/asyncHandler');
const { istDayBounds, istDateParts, dayBoundsOf, zonedParts } = require('../utils/dateHelpers');
const { timezoneGroupsForReq, rangeFragmentBy, andInto } = require('../utils/orgTime');
const orgScope = require('../utils/orgScope');

function pad2(n) {
  return String(n).padStart(2, '0');
}


function fmtDay(date, tz) {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)}`;
}


function rangeFromQuery(period, from, to, tz) {
  const now = new Date();
  if (from && to) {
    return { start: dayBoundsOf(from, tz).dayStart, end: dayBoundsOf(to, tz).dayEnd };
  }
  const todayBounds = istDayBounds(now, tz);
  if (period === 'all') {

    return { start: new Date('2000-01-01T00:00:00.000Z'), end: todayBounds.dayEnd };
  }
  if (period === 'daily') {
    return { start: todayBounds.dayStart, end: todayBounds.dayEnd };
  }
  if (period === 'weekly') {
    return { start: istDayBounds(new Date(now.getTime() - 6 * 86400000), tz).dayStart, end: todayBounds.dayEnd };
  }

  const { year, month } = istDateParts(now, tz);
  return { start: dayBoundsOf(`${year}-${pad2(month + 1)}-01`, tz).dayStart, end: todayBounds.dayEnd };
}
async function reportWindow(req, period, from, to) {
  const groups = await timezoneGroupsForReq(req);
  const primary = groups[0].tz;
  let { start, end } = rangeFromQuery(period, from, to, primary);
  if (period === 'all' && !(from && to)) {
    // Label the report from the first day that actually has data.
    const first = await Attendance.findOne({ organizationId: orgScope(req), status: { $ne: 'day_off' } })
      .sort({ date: 1 })
      .select('date')
      .lean();
    if (first && first.date) start = first.date;
  }
  const fragment = rangeFragmentBy(groups, (tz) => rangeFromQuery(period, from, to, tz));
  const tzByOrg = new Map();
  groups.forEach((g) => g.ids.forEach((id) => tzByOrg.set(String(id), g.tz)));
  const dayLabel = (row) => fmtDay(row.date, tzByOrg.get(String(row.organizationId)) || primary);
  return { start, end, fragment, groups, dayLabel, startLabel: fmtDay(start, primary), endLabel: fmtDay(end, primary) };
}

const summaryJson = asyncHandler(async (req, res) => {
  const { period = 'monthly', from, to } = req.query;
  const { start, end, groups } = await reportWindow(req, period, from, to);
  const orgNames = new Map((req.orgDocs || []).map((o) => [String(o._id), o.name]));
  const hasPunchIn = { $ne: [{ $ifNull: ['$punchIn', null] }, null] };
  const flag = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });

  const perGroup = await Promise.all(
    groups.map(async (g) => {
      const fragment = rangeFragmentBy([g], (tz) => rangeFromQuery(period, from, to, tz));
      const match = {
        $match: Attendance.find(andInto({ organizationId: { $in: g.ids }, status: { $ne: 'day_off' } }, fragment)).cast(Attendance),
      };
      const [byEmployee, byDay] = await Promise.all([
        Attendance.aggregate([
          match,
          {
            $group: {
              _id: '$employeeId',
              records: { $sum: 1 },
              present: flag(hasPunchIn),
              late: flag({ $gt: ['$lateMinutes', 0] }),
              overtime: { $sum: '$overtime' },
            },
          },
          { $lookup: { from: Employee.collection.name, localField: '_id', foreignField: '_id', as: '__e' } },
          {
            $project: {
              records: 1,
              present: 1,
              late: 1,
              overtime: 1,
              department: { $arrayElemAt: ['$__e.department', 0] },
              organizationId: { $arrayElemAt: ['$__e.organizationId', 0] },
            },
          },
        ]),
        Attendance.aggregate([
          match,
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: g.tz } },
              present: flag(hasPunchIn),
              late: flag({ $gt: ['$lateMinutes', 0] }),
            },
          },
        ]),
      ]);
      return { byEmployee, byDay };
    })
  );

  const byDept = {};
  const byOrg = {};
  const trendByDay = new Map();
  let records = 0;
  let lateTotal = 0;
  let otTotal = 0;
  perGroup.forEach(({ byEmployee, byDay }) => {
    byEmployee.forEach((e) => {
      records += e.records;
      lateTotal += e.late;
      otTotal += e.overtime || 0;
      const dept = e.department || '—';
      byDept[dept] = byDept[dept] || { present: 0, late: 0, overtime: 0 };
      byDept[dept].present += e.present;
      byDept[dept].late += e.late;
      byDept[dept].overtime += e.overtime || 0;
      if (req.allOrgs) {
        const orgName = orgNames.get(String(e.organizationId)) || '—';
        byOrg[orgName] = byOrg[orgName] || { present: 0, late: 0, overtime: 0 };
        byOrg[orgName].present += e.present;
        byOrg[orgName].late += e.late;
        byOrg[orgName].overtime += e.overtime || 0;
      }
    });
    byDay.forEach((d) => {
      const t = trendByDay.get(d._id) || { date: d._id, present: 0, late: 0 };
      t.present += d.present;
      t.late += d.late;
      trendByDay.set(d._id, t);
    });
  });

  res.json({
    success: true,
    data: {
      range: { start, end },
      records,
      lateTotal,
      overtimeTotal: Math.round(otTotal * 100) / 100,
      byDepartment: byDept,
      byOrganization: req.allOrgs ? byOrg : undefined,
      trend: [...trendByDay.values()].sort((x, y) => (x.date < y.date ? -1 : 1)),
    },
  });
});

const exportExcel = asyncHandler(async (req, res) => {
  const { period = 'monthly', from, to } = req.query;
  const { start, end, fragment, dayLabel, startLabel, endLabel } = await reportWindow(req, period, from, to);
  const empPopulate = req.allOrgs
    ? {
        path: 'employeeId',
        select: 'name employeeId department organizationId',
        populate: { path: 'organizationId', select: 'name slug' },
      }
    : { path: 'employeeId', select: 'name employeeId department' };
  const items = await Attendance.find({
    ...andInto({ organizationId: orgScope(req) }, fragment),
  })
    .populate(empPopulate)
    .sort({ date: -1 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance');
  const columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Employee', key: 'name', width: 24 },
    { header: 'Code', key: 'code', width: 14 },
    { header: 'Dept', key: 'dept', width: 16 },
  ];
  if (req.allOrgs) columns.push({ header: 'Company', key: 'company', width: 20 });
  columns.push(
    { header: 'Punch In', key: 'in', width: 20 },
    { header: 'Punch Out', key: 'out', width: 20 },
    { header: 'Hours', key: 'hours', width: 10 },
    { header: 'Late (min)', key: 'late', width: 12 },
    { header: 'OT', key: 'ot', width: 10 },
    { header: 'Status', key: 'status', width: 12 }
  );
  sheet.columns = columns;
  items.forEach((a) => {
    sheet.addRow({
      date: dayLabel(a),
      name: a.employeeId?.name,
      code: a.employeeId?.employeeId,
      dept: a.employeeId?.department,
      company: req.allOrgs ? a.employeeId?.organizationId?.name : undefined,
      in: a.punchIn?.toISOString(),
      out: a.punchOut?.toISOString(),
      hours: a.totalHours,
      late: a.lateMinutes,
      ot: a.overtime,
      status: a.status,
    });
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=attendance-${startLabel}.xlsx`
  );
  await workbook.xlsx.write(res);
  res.end();
});

const exportCsv = asyncHandler(async (req, res) => {
  const { period = 'monthly', from, to } = req.query;
  const { start, end, fragment, dayLabel, startLabel, endLabel } = await reportWindow(req, period, from, to);
  const empPopulate = req.allOrgs
    ? {
        path: 'employeeId',
        select: 'name employeeId department organizationId',
        populate: { path: 'organizationId', select: 'name slug' },
      }
    : { path: 'employeeId', select: 'name employeeId department' };
  const items = await Attendance.find({
    ...andInto({ organizationId: orgScope(req) }, fragment),
  })
    .populate(empPopulate)
    .sort({ date: -1 });

  const headers = ['date', 'employee', 'code', 'department'];
  if (req.allOrgs) headers.push('company');
  headers.push('punchIn', 'punchOut', 'totalHours', 'lateMinutes', 'overtime', 'status');
  const lines = [headers.join(',')];
  items.forEach((a) => {
    const row = [
      dayLabel(a),
      `"${(a.employeeId?.name || '').replace(/"/g, '""')}"`,
      a.employeeId?.employeeId,
      `"${(a.employeeId?.department || '').replace(/"/g, '""')}"`,
    ];
    if (req.allOrgs) {
      row.push(`"${(a.employeeId?.organizationId?.name || '').replace(/"/g, '""')}"`);
    }
    row.push(
      a.punchIn?.toISOString(),
      a.punchOut?.toISOString(),
      a.totalHours,
      a.lateMinutes,
      a.overtime,
      a.status
    );
    lines.push(row.join(','));
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=attendance-${startLabel}.csv`
  );
  res.send(lines.join('\n'));
});

const exportPdf = asyncHandler(async (req, res) => {
  const { period = 'monthly', from, to } = req.query;
  const { start, end, fragment, dayLabel, startLabel, endLabel } = await reportWindow(req, period, from, to);
  const empPopulate = req.allOrgs
    ? {
        path: 'employeeId',
        select: 'name employeeId department organizationId',
        populate: { path: 'organizationId', select: 'name slug' },
      }
    : { path: 'employeeId', select: 'name employeeId department' };
  const items = await Attendance.find({
    ...andInto({ organizationId: orgScope(req) }, fragment),
  })
    .populate(empPopulate)
    .sort({ date: -1 })
    .limit(200);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=attendance-${startLabel}.pdf`
  );
  doc.pipe(res);
  doc.fontSize(16).text(req.allOrgs ? 'Attendance report — All Companies' : 'Attendance report', {
    underline: true,
  });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`From ${startLabel} to ${endLabel}`);
  doc.moveDown();
  items.forEach((a, i) => {
    if (i > 0 && i % 25 === 0) doc.addPage();
    const company = req.allOrgs ? ` | ${a.employeeId?.organizationId?.name || '—'}` : '';
    doc
      .fontSize(9)
      .text(
        `${dayLabel(a)} | ${a.employeeId?.name || ''}${company} | in: ${a.punchIn || '—'} | out: ${a.punchOut || '—'} | ${a.status}`
      );
  });
  doc.end();
});

module.exports = { summaryJson, exportExcel, exportCsv, exportPdf };