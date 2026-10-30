const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    leaveType: {
      type: String,

      enum: ['Casual Leave', 'Sick Leave', 'Other'],
      required: true,
    },
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    decidedAt: { type: Date },
    adminNote: { type: String, trim: true },
    approvalType: { type: String, enum: ['normal', 'override_paid', 'unpaid'] },
    balanceDeducted: { type: Number, default: 0 },
    overrideBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    overrideByName: { type: String, trim: true },
    overrideAt: { type: Date },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ organizationId: 1, createdAt: -1 });
leaveRequestSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
leaveRequestSchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);