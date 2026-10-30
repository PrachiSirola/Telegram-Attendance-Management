const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
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
    activityType: {
      type: String,
      enum: [
        'punch_in',
        'punch_out',
        'break_start',
        'break_end',
        'location',
        'task_update',
        'selfie',
        'leave_request',
        'other',
      ],
      required: true,
    },
    message: { type: String, trim: true },
    location: {
      lat: Number,
      lng: Number,
      accuracy: Number,
    },
    image: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);
activityLogSchema.index({ organizationId: 1, timestamp: -1 });
activityLogSchema.index({ organizationId: 1, employeeId: 1, timestamp: -1 });
activityLogSchema.index({ organizationId: 1, activityType: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);