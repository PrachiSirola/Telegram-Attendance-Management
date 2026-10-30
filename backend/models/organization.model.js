const mongoose = require('mongoose');
const breakTimingsSchema = require('./schemas/breakTimings.schema');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: /^[a-z0-9-]+$/,
    },
    active: { type: Boolean, default: true },
    sundayOff: { type: Boolean, default: false },
    timezone: { type: String, trim: true, default: 'Asia/Kolkata' },
    shiftTiming: { type: String, trim: true, default: '10:00-19:00' },
    breakTimings: { type: breakTimingsSchema, default: () => ({}) },
    lastDailyReportDate: { type: String, default: null },
    officeLocation: {
      address: { type: String, trim: true },
      lat: { type: Number },
      lng: { type: Number },
      radiusMeters: { type: Number },
    },
    locationSharingEnabled: { type: Boolean, default: false },
    imageCaptureEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);