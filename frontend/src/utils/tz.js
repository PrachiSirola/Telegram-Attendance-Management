import { format } from 'date-fns';

export const DEFAULT_TZ = 'Asia/Kolkata';

export function listTimezones() {
  let zones = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [
      'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
      'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/New_York',
      'America/Sao_Paulo', 'America/Toronto', 'Asia/Bangkok', 'Asia/Dhaka', 'Asia/Dubai',
      'Asia/Hong_Kong', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kuala_Lumpur', 'Asia/Manila',
      'Asia/Riyadh', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/Berlin',
      'Europe/London', 'Europe/Paris', 'Pacific/Auckland',
    ];
  }
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}

const dtfCache = new Map();
function dtf(tz) {
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

export function isValidTz(tz) {
  if (!tz) return false;
  try {
    dtf(tz);
    return true;
  } catch {
    return false;
  }
}

function parts(date, tz) {
  const o = {};
  dtf(tz)
    .formatToParts(date)
    .forEach((p) => {
      if (p.type !== 'literal') o[p.type] = Number(p.value);
    });
  return { y: o.year, mo: o.month - 1, d: o.day, h: o.hour === 24 ? 0 : o.hour, mi: o.minute, s: o.second };
}

function offsetMs(date, tz) {
  const p = parts(date, tz);
  return Date.UTC(p.y, p.mo, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}
export function tzOffsetLabel(tz) {
  if (!isValidTz(tz)) return '';
  const mins = Math.round(offsetMs(new Date(), tz) / 60000);
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export function toZonedWall(date, tz) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return d;
  const p = parts(d, isValidTz(tz) ? tz : DEFAULT_TZ);
  return new Date(p.y, p.mo, p.d, p.h, p.mi, p.s);
}

export function formatInTz(date, pattern, tz) {
  if (date == null || date === '') return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return format(toZonedWall(d, tz), pattern);
}

export function wallStringToIso(wall, tz) {
  const m = String(wall).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const zone = isValidTz(tz) ? tz : DEFAULT_TZ;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
  let ts = guess - offsetMs(new Date(guess), zone);
  ts = guess - offsetMs(new Date(ts), zone);
  return new Date(ts).toISOString();
}

export function dayStringInTz(date, tz) {
  return formatInTz(date || new Date(), 'yyyy-MM-dd', tz);
}
