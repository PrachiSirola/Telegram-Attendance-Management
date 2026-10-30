const DEFAULT_TZ = 'Asia/Kolkata';

const dtfCache = new Map();
function getDtf(tz) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(tz, f);
  }
  return f;
}
function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    getDtf(tz);
    return true;
  } catch {
    return false;
  }
}
function resolveTz(tz) {
  return isValidTimezone(tz) ? tz : DEFAULT_TZ;
}
function zonedParts(date, tz = DEFAULT_TZ) {
  const out = {};
  getDtf(resolveTz(tz))
    .formatToParts(date)
    .forEach((p) => {
      if (p.type !== 'literal') out[p.type] = Number(p.value);
    });
  return {
    year: out.year,
    month: out.month - 1,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

function tzOffsetMs(date, tz = DEFAULT_TZ) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function zonedTimeToUtc(y, m0, d, h = 0, mi = 0, s = 0, ms = 0, tz = DEFAULT_TZ) {
  const guess = Date.UTC(y, m0, d, h, mi, s, ms);
  let ts = guess - tzOffsetMs(new Date(guess), tz);
  ts = guess - tzOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

function parseTimeToToday(hhmm, baseDate = new Date(), tz = DEFAULT_TZ) {
  const [h, m] = hhmm.split(':').map(Number);
  const p = zonedParts(baseDate, tz);
  return zonedTimeToUtc(p.year, p.month, p.day, h, m, 0, 0, tz);
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function istDayBounds(date = new Date(), tz = DEFAULT_TZ) {
  const p = zonedParts(date, tz);
  return {
    dayStart: zonedTimeToUtc(p.year, p.month, p.day, 0, 0, 0, 0, tz),
    dayEnd: zonedTimeToUtc(p.year, p.month, p.day, 23, 59, 59, 999, tz),
  };
}
function dayBoundsOf(input, tz = DEFAULT_TZ) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const [y, m, d] = input.trim().split('-').map(Number);
    return {
      dayStart: zonedTimeToUtc(y, m - 1, d, 0, 0, 0, 0, tz),
      dayEnd: zonedTimeToUtc(y, m - 1, d, 23, 59, 59, 999, tz),
    };
  }
  return istDayBounds(new Date(input), tz);
}

function minutesBetween(a, b) {
  return Math.round((b - a) / 60000);
}

function hoursDecimal(a, b) {
  return Math.round(((b - a) / 3600000) * 100) / 100;
}
function parseShiftTiming(value) {
  const match = String(value || '').match(/^(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})$/);
  if (!match) return null;
  const norm = (t) => t.split(':').map((n) => n.padStart(2, '0')).join(':');
  return { start: norm(match[1]), end: norm(match[2]) };
}
function minutesOfDayIST(date, tz = DEFAULT_TZ) {
  const p = zonedParts(date, tz);
  return p.hour * 60 + p.minute;
}
function istDateParts(date = new Date(), tz = DEFAULT_TZ) {
  const p = zonedParts(date, tz);
  return { year: p.year, month: p.month, day: p.day };
}
function istYearMonth(date = new Date(), tz = DEFAULT_TZ) {
  const p = zonedParts(date, tz);
  return { year: p.year, month: p.month + 1 };
}
function parseClientDateTime(value, tz = DEFAULT_TZ) {
  if (value instanceof Date) return value;
  const str = String(value).trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(str)) return new Date(str);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return new Date(NaN);
  const [, y, mo, d, h, mi, sec] = m.map(Number);
  return zonedTimeToUtc(y, mo - 1, d, h, mi, sec || 0, 0, tz);
}

module.exports = {
  DEFAULT_TZ,
  isValidTimezone,
  resolveTz,
  zonedParts,
  zonedTimeToUtc,
  dayBoundsOf,
  istYearMonth,
  parseClientDateTime,
  parseTimeToToday,
  startOfDay,
  endOfDay,
  istDayBounds,
  istDateParts,
  minutesBetween,
  hoursDecimal,
  parseShiftTiming,
  minutesOfDayIST,
};