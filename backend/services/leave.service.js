const LeaveRequest = require('../models/leaveRequest.model');
const Organization = require('../models/organization.model');
const { createAdminNotification } = require('./notification.service');
const { notifySuperAdmins, notifyOrgAdmins, escapeHtml } = require('./telegramNotify.service');
const { emitToOrganization } = require('./socket.service');

async function submitLeaveRequest(employee, { startDate, endDate, reason, leaveType }) {
  const VALID_LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Other'];
  if (!VALID_LEAVE_TYPES.includes(leaveType)) {
    const e = new Error('Leave type must be Casual Leave, Sick Leave, or Other.');
    e.statusCode = 400;
    throw e;
  }
  const organizationId = employee.organizationId;

  const newStart = new Date(new Date(startDate).toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const newEnd = new Date(new Date(endDate).toISOString().slice(0, 10) + 'T23:59:59.999Z');

  const overlapping = await LeaveRequest.findOne({
    employeeId: employee._id,
    startDate: { $lte: newEnd },
    endDate: { $gte: newStart },
  });
  if (overlapping) {
    const e = new Error('You have already submitted a leave request for this date.');
    e.statusCode = 400;
    throw e;
  }

  const doc = await LeaveRequest.create({
    organizationId,
    employeeId: employee._id,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    leaveType,
    reason,
  });
  await createAdminNotification({
    organizationId,
    type: 'leave_request',
    title: `Leave request from ${employee.name}`,
    body: reason || '',
    meta: { leaveId: doc._id, employeeId: employee._id },
  });
  emitToOrganization(organizationId, 'leave:updated', {
    action: 'created',
    leave: doc.toObject(),
    employeeName: employee.name,
  });

  const fmtDate = (d) => d.toLocaleDateString('en-GB', { timeZone: 'UTC' }); // DD/MM/YYYY
  const dateRange =
    fmtDate(doc.startDate) === fmtDate(doc.endDate)
      ? fmtDate(doc.startDate)
      : `${fmtDate(doc.startDate)} - ${fmtDate(doc.endDate)}`;

  const org = await Organization.findById(organizationId).select('name');
  const text = [
    `<b>${escapeHtml(employee.name)}</b>`,
    `Company - ${escapeHtml(org?.name || 'Unknown organization')}`,
    `Leave dates - ${dateRange}`,
    `Leave type - ${escapeHtml(doc.leaveType)}`,
    `Reason - ${escapeHtml(reason || 'Not specified')}`,
    `Status - Pending`,
  ].join('\n');
  await Promise.all([notifySuperAdmins(text), notifyOrgAdmins(organizationId, text)]);

  return doc;
}

module.exports = { submitLeaveRequest };