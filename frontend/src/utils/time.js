export function to12h(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return '';
  let [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function toMins(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const value = `${String(h).padStart(2, '0')}:${m}`;
  return { value, label: to12h(value) };
});

function minsToHHMM(mins) {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function breakWindowSlots(shiftStart, shiftEnd, durationMins, breakKey) {
  const start = toMins(shiftStart);
  const end = toMins(shiftEnd);
  const windowWidth = breakKey === 'lunch' || durationMins === 30 ? 30 : Math.min((durationMins || 15) * 2, 30);
  if (start == null || end == null || !windowWidth) return [];
  const span = start <= end ? end - start : 24 * 60 - start + end;
  const slots = [];
  for (let offset = 0; offset + windowWidth <= span; offset += windowWidth) {
    const winStart = minsToHHMM(start + offset);
    const winEnd = minsToHHMM(start + offset + windowWidth);
    slots.push({ value: winStart, label: `${to12h(winStart)} – ${to12h(winEnd)}` });
  }
  return slots;
}

export function breakSlots(shiftStart, shiftEnd) {
  const start = toMins(shiftStart);
  const end = toMins(shiftEnd);
  if (start == null || end == null) return TIME_SLOTS;
  return TIME_SLOTS.filter((s) => {
    const t = toMins(s.value);
    return start <= end ? t >= start && t <= end : t >= start || t <= end;
  });
}
export function endTime(start, durationMins) {
  if (!/^\d{2}:\d{2}$/.test(start || '')) return null;
  const [h, m] = start.split(':').map(Number);
  const total = (h * 60 + m + durationMins) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
export function parseShiftTiming(value) {
  const m = String(value || '').match(/^(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})$/);
  return m ? { start: m[1], end: m[2] } : { start: '', end: '' };
}
export function formatShiftTiming(value) {
  const { start, end } = parseShiftTiming(value);
  if (!start || !end) return value || '';
  return `${to12h(start)} – ${to12h(end)}`;
}