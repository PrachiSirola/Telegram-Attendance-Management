const cron = require('node-cron');
const Attendance = require('../models/attendance.model');
const Employee = require('../models/employee.model');
const Organization = require('../models/organization.model');
const { istDayBounds, resolveTz, zonedParts } = require('../utils/dateHelpers');
const { createAdminNotification } = require('../services/notification.service');
const { emitToOrganization } = require('../services/socket.service');
const { runDailyReportCheck } = require('../services/dailyReport.service');
const { findOffDaysForDate, repairAllOffDays } = require('../services/offDay.service');
const logger = require('../utils/logger');


async function markAbsentForOrg(org, date = new Date()) {
  const tz = resolveTz(org.timezone);
  const { dayStart, dayEnd } = istDayBounds(date, tz);
  const orgId = org._id;
  const activeEmployees = await Employee.find({ active: true, organizationId: orgId }).select(
    '_id name department'
  );
  const attended = await Attendance.find({
    organizationId: orgId,
    date: { $gte: dayStart, $lte: dayEnd },
    punchIn: { $ne: null },
  }).distinct('employeeId');

  const attendedSet = new Set(attended.map((id) => String(id)));
  const notAttended = activeEmployees.filter((e) => !attendedSet.has(String(e._id)));


  const offDayEntries = await findOffDaysForDate(orgId, dayStart, tz);
  const isOffDay = (emp) => offDayEntries.some((entry) => entry.coversEmployee(emp));

  let newlyAbsent = 0;
  for (const emp of notAttended) {
    const status = isOffDay(emp) ? 'day_off' : 'absent';
    const r = await Attendance.updateOne(
      { organizationId: orgId, employeeId: emp._id, date: dayStart },
      {
        $setOnInsert: {
          organizationId: orgId,
          employeeId: emp._id,
          date: dayStart,
          status,
        },
      },
      { upsert: true }
    );
    if (status === 'absent' && r.upsertedCount) newlyAbsent += 1;
  }

  if (newlyAbsent) {
    await createAdminNotification({
      organizationId: orgId,
      type: 'absent_marked',
      title: 'Daily absent summary',
      body: `${newlyAbsent} employees marked absent for ${new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        dateStyle: 'medium',
      }).format(dayStart)}`,
      meta: { count: newlyAbsent },
    });
    emitToOrganization(orgId, 'cron:absent', { date: dayStart, count: newlyAbsent });
  }
}

async function markAbsentForDay(date) {
  const orgs = await Organization.find({ active: true }).select('_id timezone');
  for (const org of orgs) await markAbsentForOrg(org, date);
}


async function markAbsentForDueOrgs() {
  const orgs = await Organization.find({ active: true }).select('_id timezone');
  for (const org of orgs) {
    const p = zonedParts(new Date(), org.timezone);
    if (p.hour * 60 + p.minute >= 23 * 60 + 5) await markAbsentForOrg(org, new Date());
  }
}

function startCronJobs() {

  cron.schedule('*/15 * * * *', async () => {
    try {
      await markAbsentForDueOrgs();
    } catch (e) {
      logger.error('Cron absent', e);
    }
  });

  cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        const orgs = await Organization.find({ active: true });
        for (const org of orgs) {
          await createAdminNotification({
            organizationId: org._id,
            type: 'shift_reminder',
            title: 'Shift reminder',
            body: 'Review attendance dashboard for late arrivals.',
          });
          emitToOrganization(org._id, 'cron:shift-reminder', { at: new Date() });
        }
      } catch (e) {
        logger.error('Cron shift reminder', e);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  cron.schedule('15 0 * * *', () => {
    logger.info('Cron: daily backup placeholder — configure DB backup to object storage.');
  });

  cron.schedule('*/15 * * * *', async () => {
    try {
      await runDailyReportCheck();
    } catch (e) {
      logger.error('Cron daily report', e);
    }
  });
  runDailyReportCheck().catch((e) => logger.error('Startup daily report check', e));
  repairAllOffDays()
    .then((n) => n && logger.info(`Off-day repair: ${n} absent record(s) set to day_off`))
    .catch((e) => logger.error('Startup off-day repair', e));

  logger.info('Cron jobs scheduled');
}

module.exports = { startCronJobs, markAbsentForDay };