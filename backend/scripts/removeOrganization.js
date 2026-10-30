require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('../models/organization.model');
const Employee = require('../models/employee.model');
const Attendance = require('../models/attendance.model');
const ActivityLog = require('../models/activityLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const Admin = require('../models/admin.model');
const Notification = require('../models/notification.model');
const TelegramBotSession = require('../models/telegramBotSession.model');
const { mongoUri } = require('../config/env');

async function run() {
  const slug = (process.argv[2] || '').toLowerCase().trim();
  if (!slug) {
    console.error('Usage: node scripts/removeOrganization.js <slug>');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const org = await Organization.findOne({ slug });
  if (!org) {
    console.log('No organization found with slug:', slug);
    process.exit(0);
  }

  const totalOrgs = await Organization.countDocuments();
  if (totalOrgs <= 1) {
    console.error(`Refusing to delete "${org.name}" — it's the only organization left in the system.`);
    process.exit(1);
  }

  const orgId = org._id;
  const [employees, attendance, activity, leaves, admins, notifications, botSessions] = await Promise.all([
    Employee.deleteMany({ organizationId: orgId }),
    Attendance.deleteMany({ organizationId: orgId }),
    ActivityLog.deleteMany({ organizationId: orgId }),
    LeaveRequest.deleteMany({ organizationId: orgId }),
    Admin.deleteMany({ organizationId: orgId, role: 'admin' }), 
    Notification.deleteMany({ organizationId: orgId }),
    TelegramBotSession.deleteMany({ organizationId: orgId }),
  ]);
  await Organization.deleteOne({ _id: orgId });

  console.log(`Deleted organization: ${org.name} (${org.slug})`);
  console.log(`  Employees removed: ${employees.deletedCount}`);
  console.log(`  Attendance records removed: ${attendance.deletedCount}`);
  console.log(`  Activity logs removed: ${activity.deletedCount}`);
  console.log(`  Leave requests removed: ${leaves.deletedCount}`);
  console.log(`  Admin accounts removed: ${admins.deletedCount}`);
  console.log(`  Notifications removed: ${notifications.deletedCount}`);
  console.log(`  Telegram bot sessions removed: ${botSessions.deletedCount}`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});