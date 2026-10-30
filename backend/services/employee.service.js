const crypto = require('crypto');
const Employee = require('../models/employee.model');
const TelegramBotSession = require('../models/telegramBotSession.model');
const { minutesOfDayIST, parseShiftTiming } = require('../utils/dateHelpers');

function generateRegistrationCode() {
  return `EMP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const BREAK_DURATIONS = { morning: 15, lunch: 30, evening: 15 };

function normalizeBreakTimings(input) {
  const out = {};
  for (const key of Object.keys(BREAK_DURATIONS)) {
    const start = input && input[key] && typeof input[key].start === 'string'
      ? input[key].start.trim()
      : undefined;
    out[key] = { start: start || undefined, durationMins: BREAK_DURATIONS[key] };
  }
  return out;
}

async function createEmployeePayload(body, organizationId) {
  const registrationCode = generateRegistrationCode();
  return {
    organizationId,
    name: body.name,
    email: body.email || undefined,
    phone: body.phone,
    department: body.department,
    role: body.role,
    shiftTiming: body.shiftTiming,
    breakTimings: normalizeBreakTimings(body.breakTimings),
    joiningDate: body.joiningDate ? new Date(body.joiningDate) : new Date(),
    active: body.active !== false,
    registrationCode,
    leaveBalanceDays: body.leaveBalanceDays ?? 12,
  };
}

async function linkTelegramByCode(registrationCode, telegramId) {
  const emp = await Employee.findOne({ registrationCode: registrationCode.trim() });
  if (!emp) {
    const e = new Error('Invalid registration code');
    e.statusCode = 400;
    throw e;
  }
  if (emp.telegramId && emp.telegramId !== String(telegramId)) {
    const e = new Error('This employee is already linked to another Telegram account');
    e.statusCode = 400;
    throw e;
  }
  const taken = await Employee.findOne({
    organizationId: emp.organizationId,
    telegramId: String(telegramId),
    _id: { $ne: emp._id },
  });
  if (taken) {
    const e = new Error('This Telegram account is already registered for this organization');
    e.statusCode = 400;
    throw e;
  }
  emp.telegramId = String(telegramId);
  await emp.save();
  await TelegramBotSession.findOneAndUpdate(
    { telegramUserId: String(telegramId) },
    { organizationId: emp.organizationId },
    { upsert: true }
  );
  return emp;
}

function getEffectiveShiftTiming(employee, organization) {
  return (employee?.shiftTiming && employee.shiftTiming.trim()) || organization?.shiftTiming || '';
}

function formatHHMM12h(h, m) {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function describeBreakWindows(breakTimings) {
  const LABELS = { morning: 'Morning', lunch: 'Lunch', evening: 'Evening' };
  const parts = [];
  for (const key of ['morning', 'lunch', 'evening']) {
    const slot = breakTimings?.[key];
    if (!slot || !slot.start || !slot.durationMins) continue;
    const [h, m] = slot.start.split(':').map(Number);
    const windowWidth = key === 'lunch' ? 30 : Math.min((slot.durationMins || 15) * 2, 30);
    const endTotal = h * 60 + m + windowWidth;
    const endH = Math.floor(endTotal / 60) % 24;
    const endM = endTotal % 60;
    parts.push(`${LABELS[key]} ${formatHHMM12h(h, m)}–${formatHHMM12h(endH, endM)}`);
  }
  return parts.join(', ');
}

function getShiftEndStatus(employee, organization) {
  const shiftTiming = getEffectiveShiftTiming(employee, organization);
  const parsed = parseShiftTiming(shiftTiming);
  if (!parsed) return null;

  const [startH, startM] = parsed.start.split(':').map(Number);
  const [endH, endM] = parsed.end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const nowMinutes = minutesOfDayIST(new Date(), organization?.timezone);
  const endLabel = formatHHMM12h(endH, endM);
  const overnight = endMinutes <= startMinutes;

  let remaining;
  if (!overnight) {
    remaining = nowMinutes >= endMinutes ? 0 : endMinutes - nowMinutes;
  } else if (nowMinutes >= startMinutes) {

    remaining = 1440 - nowMinutes + endMinutes;
  } else if (nowMinutes < endMinutes) {

    remaining = endMinutes - nowMinutes;
  } else {

    remaining = 0;
  }

  return {
    isEarly: remaining > 0,
    remainingHours: Math.floor(remaining / 60),
    remainingMinutes: remaining % 60,
    endLabel,
  };
}


function getEffectiveBreakTimings(employee, organization) {
  const own = employee?.breakTimings;
  const hasOwn = own && (own.morning?.start || own.lunch?.start || own.evening?.start);
  return hasOwn ? own : organization?.breakTimings || {};
}

function findBreakSlotForTime(breakTimings, atDate, tz) {
  if (!breakTimings) return null;
  const atMinutes = minutesOfDayIST(atDate, tz);
  for (const key of ['morning', 'lunch', 'evening']) {
    const slot = breakTimings[key];
    if (!slot || !slot.start || !slot.durationMins) continue;
    const [h, m] = slot.start.split(':').map(Number);
    const windowStart = h * 60 + m;
    const windowWidth = key === 'lunch' ? 30 : Math.min((slot.durationMins || 15) * 2, 30);
    const windowEnd = windowStart + windowWidth;
    if (atMinutes >= windowStart && atMinutes < windowEnd) {
      return { key, durationMins: slot.durationMins, windowStart, windowEnd };
    }
  }
  return null;
}

module.exports = {
  generateRegistrationCode,
  createEmployeePayload,
  linkTelegramByCode,
  normalizeBreakTimings,
  BREAK_DURATIONS,
  getEffectiveShiftTiming,
  getEffectiveBreakTimings,
  findBreakSlotForTime,
  getShiftEndStatus,
  describeBreakWindows,
};