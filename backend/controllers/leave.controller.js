const { validationResult } = require('express-validator');
const LeaveRequest = require('../models/leaveRequest.model');
const Employee = require('../models/employee.model');
const asyncHandler = require('../utils/asyncHandler');
const { submitLeaveRequest } = require('../services/leave.service');
const { markAttendanceOnLeave } = require('../services/attendance.service');
const { notifySuperAdminsOfAdminEvent } = require('../services/telegramNotify.service');
const { notifyEmployeeOnTelegram } = require('../bot/telegramBot');
const Organization = require('../models/organization.model');
const { listWithEmployee } = require('../utils/lookup');
const orgScope = require('../utils/orgScope');
const { emitToOrganization } = require('../services/socket.service');

const list = asyncHandler(async (req, res) => {
  const { status, employeeId, from, to, page = 1, limit = 30 } = req.query;
  const filter = { organizationId: orgScope(req) };
  if (status) filter.status = status;
  if (employeeId) filter.employeeId = employeeId;

  const toD = to ? new Date(`${to}T23:59:59.999Z`) : null;
  const fromD = from ? new Date(`${from}T00:00:00.000Z`) : null;
  if (toD && !Number.isNaN(toD.getTime())) filter.startDate = { $lte: toD };
  if (fromD && !Number.isNaN(fromD.getTime())) filter.endDate = { $gte: fromD };
  const skip = (Number(page) - 1) * Number(limit);

  const empSelect = 'name employeeId department role clBalance clTotal slBalance slTotal';

  const { items, total } = await listWithEmployee(LeaveRequest, {
    filter,
    sort: { createdAt: -1 },
    skip,
    limit: Number(limit),
    select: empSelect,
    allOrgs: req.allOrgs,
  });
  res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit) } });
});


const counts = asyncHandler(async (req, res) => {
  const { employeeId } = req.query;
  const base = { organizationId: orgScope(req) };
  if (employeeId) base.employeeId = employeeId;

  const is = (s) => ({ $sum: { $cond: [{ $eq: ['$status', s] }, 1, 0] } });
  const [row] = await LeaveRequest.aggregate([
    { $match: LeaveRequest.find(base).cast(LeaveRequest) },
    { $group: { _id: null, total: { $sum: 1 }, approved: is('approved'), pending: is('pending'), rejected: is('rejected') } },
  ]);
  const { total = 0, approved = 0, pending = 0, rejected = 0 } = row || {};
  res.json({ success: true, data: { total, approved, pending, rejected } });
});

const apply = asyncHandler(async (req, res) => {
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
  const doc = await submitLeaveRequest(employee, {
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    reason: req.body.reason,
    leaveType: req.body.leaveType,
  });
  res.status(201).json({ success: true, data: doc });
});

async function decideLeaveCore(leaveId, { action, admin, adminNote, approveAs }) {
  const doc = await LeaveRequest.findById(leaveId).populate('employeeId');
  if (!doc) {
    const e = new Error('Leave not found');
    e.statusCode = 404;
    throw e;
  }
  if (admin.role !== 'super_admin' && String(admin.organizationId) !== String(doc.organizationId)) {
    const e = new Error('You are not authorized to act on this organization\u2019s leave requests.');
    e.statusCode = 403;
    throw e;
  }

  const employeeIsAdminRole = (doc.employeeId?.role || '').trim().toLowerCase() === 'admin';
  if (employeeIsAdminRole && admin.role !== 'super_admin') {
    const e = new Error('Only the Super Admin can approve or reject this leave request.');
    e.statusCode = 403;
    throw e;
  }
  if (doc.status !== 'pending') {
    const e = new Error('Leave already processed');
    e.statusCode = 400;
    throw e;
  }

  const emp = doc.employeeId;
  const fmtDate = (d) => d.toLocaleDateString('en-GB', { timeZone: 'UTC' });
  const dateRange =
    fmtDate(doc.startDate) === fmtDate(doc.endDate)
      ? fmtDate(doc.startDate)
      : `${fmtDate(doc.startDate)} - ${fmtDate(doc.endDate)}`;
  const org = await Organization.findById(doc.organizationId).select('name');

  if (action === 'approve') {
    const days = Math.ceil((doc.endDate - doc.startDate) / 86400000) + 1;
    let approvalType = 'normal';
    let balanceField = null;
    if (doc.leaveType === 'Other') {
      approvalType = 'unpaid';
    } else {
      const isCasual = doc.leaveType === 'Casual Leave';
      balanceField = isCasual ? 'clBalance' : 'slBalance';
      const label = isCasual ? 'Casual Leave' : 'Sick Leave';
      const insufficient = (emp[balanceField] ?? 0) < days;

      if (insufficient) {
        if (!['admin', 'super_admin'].includes(admin.role)) {
          const e = new Error('Only an Admin or Super Admin can approve a leave with insufficient balance.');
          e.statusCode = 403;
          throw e;
        }
        if (approveAs !== 'paid' && approveAs !== 'unpaid') {
          const e = new Error(`Insufficient ${label} balance`);
          e.statusCode = 400;
          e.code = 'INSUFFICIENT_BALANCE';
          throw e;
        }
        approvalType = approveAs === 'paid' ? 'override_paid' : 'unpaid';
      }
    }
    if (approvalType === 'normal') {
      emp[balanceField] -= days;
      await emp.save();
    }
    doc.status = 'approved';
    doc.decidedBy = admin._id;
    doc.decidedAt = new Date();
    doc.adminNote = adminNote;
    doc.approvalType = approvalType;
    doc.balanceDeducted = approvalType === 'normal' ? days : 0;
    if (approvalType !== 'normal') {
      doc.overrideBy = admin._id;
      doc.overrideByName = admin.name;
      doc.overrideAt = doc.decidedAt;
    }
    await doc.save();
    await markAttendanceOnLeave(doc);
    emitToOrganization(doc.organizationId, 'leave:updated', { action: 'approved', leave: doc.toObject() });
    notifySuperAdminsOfAdminEvent(
      admin.name,
      doc.organizationId,
      org?.name || 'Unknown organization',
      approvalType === 'normal' ? 'Leave approved' : `Leave approved (${approvalType === 'unpaid' ? 'Unpaid' : 'Override \u2013 Paid'})`,
      `Employee: ${emp.name}, Date: ${dateRange}, Reason: ${doc.reason || 'Not specified'}`,
      doc.decidedAt
    );
    const typeNote =
      approvalType === 'unpaid' ? ' as Unpaid Leave' : approvalType === 'override_paid' ? ' as Paid Leave' : '';
    notifyEmployeeOnTelegram(emp, `Hi ${emp.name}, your leave request for ${dateRange} has been Approved${typeNote}.`);
  } else {
    doc.status = 'rejected';
    doc.decidedBy = admin._id;
    doc.decidedAt = new Date();
    doc.adminNote = adminNote;
    await doc.save();
    emitToOrganization(doc.organizationId, 'leave:updated', { action: 'rejected', leave: doc.toObject() });
    notifySuperAdminsOfAdminEvent(
      admin.name,
      doc.organizationId,
      org?.name || 'Unknown organization',
      'Leave rejected',
      `Employee: ${emp?.name || 'Unknown'}, Date: ${dateRange}, Reason: ${doc.reason || 'Not specified'}`,
      doc.decidedAt
    );
    if (emp) {
      notifyEmployeeOnTelegram(emp, `Hi ${emp.name}, your leave request for ${dateRange} has been Rejected.`);
    }
  }

  return doc;
}

const approve = asyncHandler(async (req, res) => {
  const doc = await decideLeaveCore(req.params.id, {
    action: 'approve',
    admin: { _id: req.admin._id, name: req.admin.name, role: req.admin.role, organizationId: req.organizationId },
    adminNote: req.body.adminNote,
    approveAs: req.body.approveAs,
  });
  res.json({ success: true, data: doc });
});

const reject = asyncHandler(async (req, res) => {
  const doc = await decideLeaveCore(req.params.id, {
    action: 'reject',
    admin: { _id: req.admin._id, name: req.admin.name, role: req.admin.role, organizationId: req.organizationId },
    adminNote: req.body.adminNote,
  });
  res.json({ success: true, data: doc });
});

module.exports = { list, counts, apply, approve, reject, decideLeaveCore };