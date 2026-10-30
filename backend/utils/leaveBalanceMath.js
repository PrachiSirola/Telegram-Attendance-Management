const { istYearMonth } = require('./dateHelpers');

const ANNUAL_CL = 12;
const ANNUAL_SL = 6;

function initialGrant(now = new Date(), tz) {
  const { year, month } = istYearMonth(now, tz);
  const monthsRemaining = 12 - month + 1;
  const cl = monthsRemaining * 1;
  const sl = monthsRemaining * 0.5;
  return { year, month, cl, sl };
}

module.exports = { ANNUAL_CL, ANNUAL_SL, initialGrant };
