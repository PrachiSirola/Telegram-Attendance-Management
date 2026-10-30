const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: function () {
        return this.role !== 'super_admin';
      },
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['super_admin', 'admin'],
      default: 'admin',
    },
    refreshTokenVersion: { type: Number, default: 0 },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorEnabledAt: { type: Date },
    twoFactorSecret: { type: String, select: false },
    twoFactorPendingSecret: { type: String, select: false },
    twoFactorPendingExpires: { type: Date, select: false },
    twoFactorSetupRequired: { type: Boolean, default: false },
    twoFactorLastStep: { type: Number, select: false },
    twoFactorFailedAttempts: { type: Number, select: false, default: 0 },
    twoFactorLockUntil: { type: Date, select: false },
    active: { type: Boolean, default: true },
    canEditOrgFeatureToggles: { type: Boolean, default: false },
    passwordResetTokenHash: { type: String, select: false, index: true },
    passwordResetExpires: { type: Date, select: false },
    telegramBotToken: { type: String, select: false },
    telegramChatId: { type: String },
    telegramWebhookSecret: { type: String, select: false },
    telegramWebhookRegistered: { type: Boolean, default: false },
  },
  { timestamps: true }
);

adminSchema.index({ organizationId: 1, email: 1 }, { unique: true });

adminSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

adminSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('Admin', adminSchema);