const Employee = require('../models/employee.model');
const Organization = require('../models/organization.model');
const logger = require('./logger');
const { ANNUAL_CL, ANNUAL_SL, initialGrant } = require('./leaveBalanceMath');
const { istYearMonth } = require('./dateHelpers');
async function ensureLeaveBalances() {
  const now = new Date();
  const orgs = await Organization.find({}).select('_id name timezone').lean();
  for (const org of orgs) {
    const { year: currentYear, month: currentMonth } = istYearMonth(now, org.timezone);

    const needsInit = await Employee.find({
      organizationId: org._id,
      $or: [{ leaveBalanceYear: null }, { clTotal: 0, slTotal: 0 }],
    }).select('_id');
    if (needsInit.length) {
      const { cl, sl } = initialGrant(now, org.timezone);
      await Employee.updateMany(
        { _id: { $in: needsInit.map((e) => e._id) } },
        { $set: { clBalance: cl, clTotal: cl, slBalance: sl, slTotal: sl, leaveBalanceYear: currentYear } }
      );
      logger.info(
        `Leave balances [${org.name}]: granted initial CL ${cl}/${cl}, SL ${sl}/${sl} to ${needsInit.length} employee(s) (go-live month ${currentMonth}/${currentYear})`
      );
    }

    const needsReset = await Employee.find({
      organizationId: org._id,
      leaveBalanceYear: { $ne: null, $lt: currentYear },
    }).select('_id');
    if (needsReset.length) {
      await Employee.updateMany(
        { _id: { $in: needsReset.map((e) => e._id) } },
        {
          $set: {
            clBalance: ANNUAL_CL,
            clTotal: ANNUAL_CL,
            slBalance: ANNUAL_SL,
            slTotal: ANNUAL_SL,
            leaveBalanceYear: currentYear,
          },
        }
      );
      logger.info(
        `Leave balances [${org.name}]: annual reset to CL ${ANNUAL_CL}/${ANNUAL_CL}, SL ${ANNUAL_SL}/${ANNUAL_SL} for ${needsReset.length} employee(s) (year ${currentYear})`
      );
    }
  }
}

module.exports = ensureLeaveBalances;
