export const earlyMinutes = (a) => (a?.activityType === 'punch_out' && a.earlyLeaveMinutes > 0 ? a.earlyLeaveMinutes : 0);

export const earlyText = (n) => `Punched out ${n} minute${n === 1 ? '' : 's'} early`;
export const activityMessage = (a) => (earlyMinutes(a) ? earlyText(earlyMinutes(a)) : a?.message);
