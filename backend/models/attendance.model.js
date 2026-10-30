const mongoose = require('mongoose');

const geoSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: Number,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
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
    date: { type: Date, required: true, index: true },
    punchIn: { type: Date },
    punchOut: { type: Date },
    totalHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['present', 'absent', 'half_day', 'late', 'on_leave', 'pending', 'day_off'],
      default: 'pending',
    },
    lateMinutes: { type: Number, default: 0 },
    earlyLeaveMinutes: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    punchInLocation: geoSchema,
    punchOutLocation: geoSchema,
    selfieImage: { type: String },
    selfieImagePublicId: { type: String },
    selfieHash: { type: String, index: true, sparse: true },
    ipAddress: { type: String },
    withinGeofence: { type: Boolean },
    notes: { type: String, trim: true },
    onBreak: { type: Boolean, default: false },
    breakStartedAt: { type: Date },
  },
  { timestamps: true }
);

attendanceSchema.index({ organizationId: 1, employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ organizationId: 1, date: -1 });
attendanceSchema.index({ organizationId: 1, status: 1, date: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);