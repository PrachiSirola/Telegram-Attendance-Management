const Admin = require('../models/admin.model');
const logger = require('./logger');
async function ensureSeedAdmin({
  email = process.env.SEED_ADMIN_EMAIL || 'ronnieewood@mailinator.com',
  password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  name = process.env.SEED_ADMIN_NAME || 'Super Admin',
} = {}) {
  const existing = await Admin.findOne({ email, role: 'super_admin' }).select('+password');
  let result;
  if (existing) {
    existing.password = password;
    existing.name = name;
    existing.role = 'super_admin';
    existing.active = true;
    existing.organizationId = undefined;
    existing.refreshTokenVersion = (existing.refreshTokenVersion || 0) + 1;
    await existing.save();
    logger.info(`Seed admin: updated ${email} (org-independent Super Admin)`);
    result = existing;
  } else {
    result = await Admin.create({ email, password, name, role: 'super_admin' });
    logger.info(`Seed admin: created ${email} (org-independent Super Admin)`);
  }

  await disablePlaceholderAdmin(email);
  await unassignAllSuperAdmins();
  return result;
}
async function disablePlaceholderAdmin(justCreatedEmail) {
  const placeholder = 'admin@example.com';
  if (placeholder === justCreatedEmail) return;
  const result = await Admin.updateMany({ email: placeholder, active: true }, { $set: { active: false } });
  if (result.modifiedCount > 0) {
    logger.info(`Seed admin: deactivated ${result.modifiedCount} placeholder account(s) (${placeholder})`);
  }
}
async function unassignAllSuperAdmins() {
  const result = await Admin.updateMany(
    { role: 'super_admin', organizationId: { $ne: null } },
    { $unset: { organizationId: '' } }
  );
  if (result.modifiedCount > 0) {
    logger.info(`Seed admin: unassigned organizationId from ${result.modifiedCount} Super Admin account(s)`);
  }
}

module.exports = ensureSeedAdmin;