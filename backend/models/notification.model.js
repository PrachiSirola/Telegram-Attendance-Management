const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'punch_in',
        'punch_out',
        'leave_request',
        'late_warning',
        'shift_reminder',
        'absent_marked',
        'system',
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
    read: { type: Boolean, default: false },
    targetAdmin: { type: Boolean, default: true },
  },
  { timestamps: true }
);
notificationSchema.index({ organizationId: 1, targetAdmin: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);