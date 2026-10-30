const { Router } = require('express');
const authRoutes = require('./auth.routes');
const employeeRoutes = require('./employee.routes');
const attendanceRoutes = require('./attendance.routes');
const activityRoutes = require('./activity.routes');
const leaveRoutes = require('./leave.routes');
const dashboardRoutes = require('./dashboard.routes');
const notificationRoutes = require('./notification.routes');
const reportsRoutes = require('./reports.routes');
const offDayRoutes = require('./offDay.routes');

const organizationRoutes = require('./organization.routes');
const telegramBotSettingsRoutes = require('./telegramBotSettings.routes');

const { protect } = require('../../middlewares/auth');
const { createBatchHandler } = require('./batch');

const router = Router();

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/telegram-bot', telegramBotSettingsRoutes);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/activities', activityRoutes);
router.use('/leaves', leaveRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportsRoutes);
router.use('/off-days', offDayRoutes);

router.post('/batch', protect, createBatchHandler(router));

module.exports = router;