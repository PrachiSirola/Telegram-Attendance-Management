const mongoose = require('mongoose');
const { initialGrant } = require('../utils/leaveBalanceMath');

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: Number,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const breakSlotSchema = new mongoose.Schema(
  {
    start: { type: String, trim: true }, 
    durationMins: { type: Number },
  },
  { _id: false }
);

const breakTimingsSchema = new mongoose.Schema(
  {
    morning: { type: breakSlotSchema, default: () => ({ durationMins: 15 }) },
    lunch: { type: breakSlotSchema, default: () => ({ durationMins: 30 }) },
    evening: { type: breakSlotSchema, default: () => ({ durationMins: 15 }) },
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    employeeId: { type: String, required: true, trim: true, immutable: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    phone: { type: String, trim: true },
    telegramId: { type: String, sparse: true },
    department: { type: String, trim: true, default: 'General' },
    role: { type: String, trim: true, default: 'Employee' },
    shiftTiming: { type: String, trim: true },
    breakTimings: { type: breakTimingsSchema, default: () => ({}) },
    joiningDate: { type: Date },
    active: { type: Boolean, default: true },
    profilePhoto: { type: String },
    registrationCode: { type: String, required: true, trim: true, unique: true },
    lastSeenLocation: locationSchema,
    leaveBalanceDays: { type: Number, default: 12 },
    clBalance: { type: Number, default: 0 },
    clTotal: { type: Number, default: 0 },
    slBalance: { type: Number, default: 0 },
    slTotal: { type: Number, default: 0 },
    leaveBalanceYear: { type: Number, default: null },
  },
  { timestamps: true }
);

employeeSchema.pre('save', async function grantOpeningLeave() {
  if (this.isNew && (this.leaveBalanceYear === null || this.leaveBalanceYear === undefined)) {
    const org = await mongoose.model('Organization').findById(this.organizationId).select('timezone').lean();
    const { year, cl, sl } = initialGrant(new Date(), org?.timezone);
    this.clBalance = cl;
    this.clTotal = cl;
    this.slBalance = sl;
    this.slTotal = sl;
    this.leaveBalanceYear = year;
  }
});

employeeSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ organizationId: 1, email: 1 }, { unique: true, sparse: true });
employeeSchema.index(
  { organizationId: 1, telegramId: 1 },
  {
    unique: true,
    name: 'organizationId_1_telegramId_1',
    partialFilterExpression: { telegramId: { $type: 'string' } },
  }
);

employeeSchema.index({ organizationId: 1, createdAt: -1 });
employeeSchema.index({ organizationId: 1, active: 1 });
employeeSchema.index({ organizationId: 1, active: 1, createdAt: -1 });

module.exports = mongoose.model('Employee', employeeSchema);