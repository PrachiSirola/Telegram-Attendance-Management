const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const https = require('https');
const http = require('http');
const {
  telegramBotToken,
  telegramWebhookUrl,
  telegramWebhookPath,
  uploadsDir,
} = require('../config/env');
const logger = require('../utils/logger');
const Employee = require('../models/employee.model');
const Organization = require('../models/organization.model');
const ActivityLog = require('../models/activityLog.model');
const Attendance = require('../models/attendance.model');
const {
  linkTelegramByCode,
  getShiftEndStatus,
  findBreakSlotForTime,
  describeBreakWindows,
  getEffectiveBreakTimings,
} = require('../services/employee.service');
const {
  getOrCreateTodayAttendance,
  blockIfOnLeave,
  punchInEmployee,
  punchOutEmployee,
  breakStart,
  breakEnd,
} = require('../services/attendance.service');
const { submitLeaveRequest } = require('../services/leave.service');
const { findOffDayForEmployee } = require('../services/offDay.service');
const { emitToOrganization } = require('../services/socket.service');
const { notifySuperAdminsOfEvent } = require('../services/telegramNotify.service');
const { uploadLocalImageToCloudinary } = require('../services/upload.service');
const TelegramBotSession = require('../models/telegramBotSession.model');
const { istDayBounds, istDateParts } = require('../utils/dateHelpers');
const { getOrgTimezone } = require('../utils/orgTime');

const pending = new Map();

const absUploads = path.join(__dirname, '..', uploadsDir);

function setPending(chatId, data) {
  pending.set(String(chatId), data);
}

function getPending(chatId) {
  return pending.get(String(chatId));
}

function clearPending(chatId) {
  pending.delete(String(chatId));
}


function fileLinkToString(link) {
  if (link == null) return '';
  if (typeof link === 'string') return link;
  if (typeof link.href === 'string') return link.href;
  return String(link);
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function downloadTelegramFile(fileUrl, destPath) {
  const url = fileLinkToString(fileUrl);
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    client
      .get(url, (res) => {
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => reject(err));
      });
  });
}

function mainMenu() {
  return Markup.keyboard([
    ['📍 Punch In', '🏁 Punch Out'],
    ['☕ Break Start', '☕ Break End'],
    ['📝 Task Update', '🖼 Selfie / Proof'],
    ['🏖 Leave Request', '📅 My Attendance'],
    ['🏖 My Leave'],
  ]).resize();
}

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Other'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function buildCalendarKeyboard(viewYear, viewMonth, tentativeDay, step) {
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const rows = [];

  rows.push([
    { text: '◀️ Prev', callback_data: 'lc:nav:prev' },
    { text: `${MONTH_NAMES[viewMonth]} ${viewYear}`, callback_data: 'lc:noop' },
    { text: 'Next ▶️', callback_data: 'lc:nav:next' },
  ]);
  rows.push(WEEKDAY_LABELS.map((w) => ({ text: w, callback_data: 'lc:noop' })));

  let dayCounter = 1;
  for (let week = 0; week < 6 && dayCounter <= daysInMonth; week++) {
    const row = [];
    for (let dow = 0; dow < 7; dow++) {
      if ((week === 0 && dow < firstWeekday) || dayCounter > daysInMonth) {
        row.push({ text: ' ', callback_data: 'lc:noop' });
      } else {
        const label = dayCounter === tentativeDay ? `✅${dayCounter}` : String(dayCounter);
        row.push({ text: label, callback_data: `lc:day:${dayCounter}` });
        dayCounter += 1;
      }
    }
    rows.push(row);
  }

  rows.push([{ text: '✅ Confirm', callback_data: 'lc:confirm' }]);
  rows.push(
    step === 'to'
      ? [
          { text: '⬅️ Back', callback_data: 'lc:back' },
          { text: '❌ Cancel', callback_data: 'lc:cancel' },
        ]
      : [{ text: '❌ Cancel', callback_data: 'lc:cancel' }]
  );
  return rows;
}

function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${pad2(d)} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

async function ensureEmployee(ctx, { requireActiveOrg = true } = {}) {
  const tg = String(ctx.from.id);
  const session = await TelegramBotSession.findOne({ telegramUserId: tg });
  if (!session) {
    await ctx.reply('Please register first using your invite link from HR.');
    return null;
  }
  const emp = await Employee.findOne({
    telegramId: tg,
    organizationId: session.organizationId,
  });
  if (!emp) {
    await ctx.reply('Please register first using your invite link from HR.');
    return null;
  }
  if (requireActiveOrg) {
    const org = await Organization.findById(emp.organizationId);
    if (!org || !org.active) {
      await ctx.reply('Your organization is currently inactive. Please contact your Admin to continue.');
      return null;
    }
  }
  return emp;
}

function registerHandlers(bot) {
  bot.start(async (ctx) => {
    const code = ctx.startPayload?.trim();
    if (!code) {
      await ctx.reply(
        'Welcome. Ask your admin for an invite link to complete registration.',
        mainMenu()
      );
      return;
    }
    try {
      const emp = await linkTelegramByCode(code, ctx.from.id);
      await ctx.reply(`✅ Registered as ${emp.name}. You can use the menu below.`, mainMenu());
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
  });

  bot.command('menu', async (ctx) => {
    await ctx.reply('Main menu', mainMenu());
  });

  bot.hears('📍 Punch In', async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) return;

    try {
      const offDay = await findOffDayForEmployee(emp, new Date());
      if (offDay) {
        await ctx.reply(`📅 Today is a ${offDay.displayLabel()}. No need to punch in.`);
        return;
      }
      const att = await getOrCreateTodayAttendance(emp);
      if (att.punchIn) {
        await ctx.reply('❌ Already punched in today.');
        return;
      }
      blockIfOnLeave(att);

      const org = await Organization.findById(emp.organizationId).select(
        'locationSharingEnabled imageCaptureEnabled'
      );
      const needsSelfie = !!org?.imageCaptureEnabled;
      const needsLocation = !!org?.locationSharingEnabled;

      if (needsSelfie) {
        setPending(ctx.chat.id, { action: 'punch_in_selfie', needsLocation });
        await ctx.reply(
          'Send a selfie photo to complete punch in.',
          Markup.keyboard([['⬅️ Cancel']]).resize()
        );
        return;
      }
      if (needsLocation) {
        setPending(ctx.chat.id, { action: 'punch_in_location' });
        await ctx.reply(
          'Share your current location to complete punch in.',
          Markup.keyboard([[Markup.button.locationRequest('📍 Share my location')], ['⬅️ Cancel']]).resize()
        );
        return;
      }

      await ctx.reply(
        'Are you sure you want to punch in?',
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Confirm', 'confirm:punch_in'),
          Markup.button.callback('❌ Cancel', 'cancel_action'),
        ])
      );
    } catch (e) {
      await ctx.reply(`❌ ${e.message || 'Something went wrong. Please try again.'}`);
    }
  });

  bot.hears('⬅️ Cancel', async (ctx) => {
    const p = getPending(ctx.chat.id);
    if (p?.action === 'punch_in_location' || p?.action === 'punch_in_selfie') {
      clearPending(ctx.chat.id);
      await ctx.reply('Punch in cancelled.', mainMenu());
    }
  });

  bot.hears('🏁 Punch Out', async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) return;

    const org = await Organization.findById(emp.organizationId).select('shiftTiming timezone');
    const shiftStatus = getShiftEndStatus(emp, org);
    if (shiftStatus?.isEarly) {
      const h = shiftStatus.remainingHours;
      const m = shiftStatus.remainingMinutes;
      const remainingText = [h > 0 ? `${h} hour${h === 1 ? '' : 's'}` : null, m > 0 ? `${m} minute${m === 1 ? '' : 's'}` : null]
        .filter(Boolean)
        .join(' ');
     
      await ctx.reply(
        `You are punching out ${remainingText} before your shift ends (${shiftStatus.endLabel}). Are you sure you want to punch out?`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Confirm Punch-Out', 'confirm:punch_out'),
          Markup.button.callback('❌ Cancel', 'cancel_action'),
        ])
      );
      return;
    }

    await ctx.reply(
      'Are you sure you want to punch out?',
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes', 'confirm:punch_out'),
        Markup.button.callback('❌ Cancel', 'cancel_action'),
      ])
    );
  });

  bot.hears('☕ Break Start', async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) return;

    const org = await Organization.findById(emp.organizationId).select('breakTimings timezone');
    const effective = getEffectiveBreakTimings(emp, org);
    const slot = findBreakSlotForTime(effective, new Date(), org?.timezone);
    if (!slot) {
      const windows = describeBreakWindows(effective);
      await ctx.reply(
        windows
          ? `⏳ You can only start a break during one of your configured windows: ${windows}.`
          : '⏳ No break windows are configured for you right now.'
      );
      return;
    }

    await ctx.reply(
      'Are you sure you want to start break?',
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes', 'confirm:break_start'),
        Markup.button.callback('❌ Cancel', 'cancel_action'),
      ])
    );
  });

  bot.hears('☕ Break End', async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) return;
    await ctx.reply(
      'Are you sure you want to end break?',
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Yes', 'confirm:break_end'),
        Markup.button.callback('❌ Cancel', 'cancel_action'),
      ])
    );
  });

  bot.action(/^confirm:(punch_in|punch_out|break_start|break_end)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const emp = await ensureEmployee(ctx);
    if (!emp) {
      await ctx.editMessageText('Please register first using your invite link from HR.');
      return;
    }
    const type = ctx.match[1];
    try {
      if (type === 'punch_in') {

        const offDay = await findOffDayForEmployee(emp, new Date());
        if (offDay) {
          await ctx.editMessageText(`📅 Today is a ${offDay.displayLabel()}. No need to punch in.`);
          return;
        }
        await punchInEmployee({ employee: emp });
        await ctx.editMessageText('✅ Punch in successful.');
      } else if (type === 'punch_out') {
        const out = await punchOutEmployee({ employee: emp });
        await ctx.editMessageText(
          out?.earlyLeaveMinutes > 0
            ? `🏁 Punch out recorded (${out.earlyLeaveMinutes} min before shift end).`
            : '🏁 Punch out recorded.'
        );
      } else if (type === 'break_start') {
        const org = await Organization.findById(emp.organizationId).select('breakTimings timezone');
        const effective = getEffectiveBreakTimings(emp, org);
        if (!findBreakSlotForTime(effective, new Date(), org?.timezone)) {
          const windows = describeBreakWindows(effective);
          await ctx.editMessageText(
            windows
              ? `⏳ That break window has closed. Configured windows: ${windows}.`
              : '⏳ No break windows are configured for you right now.'
          );
          return;
        }
        await breakStart(emp);
        await ctx.editMessageText('☕ Break started.');
      } else if (type === 'break_end') {
        await breakEnd(emp);
        await ctx.editMessageText('☕ Break ended.');
      }
    } catch (e) {
      await ctx.editMessageText(e.message);
    }
  });

  bot.action('cancel_action', async (ctx) => {
    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText('Cancelled.');
  });

  bot.action(/^lc:(.+)$/, async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) {
      await ctx.answerCbQuery();
      return;
    }
    const p = getPending(ctx.chat.id);
    if (!p || p.action !== 'leave_calendar') {
      await ctx.answerCbQuery();
      return;
    }

    const data = ctx.match[1];

    if (data === 'noop') {
      await ctx.answerCbQuery();
      return;
    }

    if (data === 'cancel') {
      clearPending(ctx.chat.id);
      await ctx.answerCbQuery('Cancelled');
      await ctx.editMessageText('❌ Leave request cancelled.');
      return;
    }

    if (data.startsWith('nav:')) {
      const dir = data.split(':')[1];
      let { viewYear, viewMonth } = p;
      viewMonth += dir === 'next' ? 1 : -1;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear -= 1;
      } else if (viewMonth > 11) {
        viewMonth = 0;
        viewYear += 1;
      }
      p.viewYear = viewYear;
      p.viewMonth = viewMonth;
      p.tentativeDay = null;
      setPending(ctx.chat.id, p);
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup({
        inline_keyboard: buildCalendarKeyboard(viewYear, viewMonth, null, p.step),
      });
      return;
    }

    if (data.startsWith('day:')) {
      const day = parseInt(data.split(':')[1], 10);
      p.tentativeDay = day;
      setPending(ctx.chat.id, p);
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup({
        inline_keyboard: buildCalendarKeyboard(p.viewYear, p.viewMonth, day, p.step),
      });
      return;
    }

    if (data === 'back') {
      if (p.step !== 'to') {
        await ctx.answerCbQuery();
        return;
      }
      p.step = 'from';
      p.tentativeDay = null;
      p.toDate = null;
      setPending(ctx.chat.id, p);
      await ctx.answerCbQuery();
      await ctx.editMessageText('📅 Select your *From date*', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buildCalendarKeyboard(p.viewYear, p.viewMonth, null, 'from') },
      });
      return;
    }

    if (data === 'confirm') {
      if (!p.tentativeDay) {
        await ctx.answerCbQuery('Please select a date first.', { show_alert: true });
        return;
      }
      const selected = `${p.viewYear}-${pad2(p.viewMonth + 1)}-${pad2(p.tentativeDay)}`;
      if (p.step === 'from') {
        p.fromDate = selected;
        p.step = 'to';
        p.tentativeDay = null;
        setPending(ctx.chat.id, p);
        await ctx.answerCbQuery();
        await ctx.editMessageText('📅 Select your *To date* (choose the same date again for a single-day leave)', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buildCalendarKeyboard(p.viewYear, p.viewMonth, null, 'to') },
        });
      } else if (p.step === 'to') {
        if (selected < p.fromDate) {
          await ctx.answerCbQuery('To date cannot be before the From date.', { show_alert: true });
          return;
        }
        p.toDate = selected;
        p.step = 'type';
        setPending(ctx.chat.id, p);
        await ctx.answerCbQuery();
        await ctx.editMessageText('Select the leave type:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🟡 Casual Leave', callback_data: 'lc:type:0' }],
              [{ text: '🤒 Sick Leave', callback_data: 'lc:type:1' }],
              [{ text: '📄 Other', callback_data: 'lc:type:2' }],
            ],
          },
        });
      }
      return;
    }

    if (data.startsWith('type:')) {
      const idx = parseInt(data.split(':')[1], 10);
      p.leaveType = LEAVE_TYPES[idx];
      p.step = 'reason';
      setPending(ctx.chat.id, p);
      await ctx.answerCbQuery();
      await ctx.editMessageText('Please type your reason for leave:');
      return;
    }

    await ctx.answerCbQuery();
  });

  bot.hears('📝 Task Update', async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) return;
    setPending(ctx.chat.id, { action: 'task_text' });
    await ctx.reply('Type your task update message.');
  });

  bot.hears('🖼 Selfie / Proof', async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) return;
    setPending(ctx.chat.id, { action: 'selfie_upload' });
    await ctx.reply('Send a photo as proof.');
  });

  bot.hears('🏖 Leave Request', async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) return;
    const nowParts = istDateParts(new Date(), await getOrgTimezone(emp.organizationId));
    const pending = {
      action: 'leave_calendar',
      step: 'from',
      viewYear: nowParts.year,
      viewMonth: nowParts.month,
      tentativeDay: null,
      fromDate: null,
      toDate: null,
      leaveType: null,
    };
    setPending(ctx.chat.id, pending);
    await ctx.reply('📅 Select your *From date*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buildCalendarKeyboard(pending.viewYear, pending.viewMonth, null, 'from') },
    });
  });

  bot.hears('🏖 My Leave', async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) return;
    await ctx.reply('View your leave balance:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🟡 Casual Leave', callback_data: 'ml:cl' }],
          [{ text: '🤒 Sick Leave', callback_data: 'ml:sl' }],
        ],
      },
    });
  });

  bot.action(/^ml:(cl|sl)$/, async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery();
    const kind = ctx.match[1];
    const fresh = await Employee.findById(emp._id).select('clBalance clTotal slBalance slTotal');
    const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
    if (kind === 'cl') {
      await ctx.reply(`🟡 Casual Leave: ${fmt(fresh.clBalance)}/${fmt(fresh.clTotal)}`);
    } else {
      await ctx.reply(`🤒 Sick Leave: ${fmt(fresh.slBalance)}/${fmt(fresh.slTotal)}`);
    }
  });

  bot.hears('📅 My Attendance', async (ctx) => {
    const emp = await ensureEmployee(ctx, { requireActiveOrg: false });
    if (!emp) return;
    const tz = await getOrgTimezone(emp.organizationId);
    const from = istDayBounds(new Date(Date.now() - 30 * 86400000), tz).dayStart;
    const to = istDayBounds(new Date(), tz).dayEnd;
    const rows = await Attendance.find({
      organizationId: emp.organizationId,
      employeeId: emp._id,
      date: { $gte: from, $lte: to },
    }).sort({ date: -1 });
    if (!rows.length) {
      await ctx.reply('No attendance in the last 30 days.');
      return;
    }
    const lines = rows.map(
      (r) =>
        `${new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(r.date)} — ${r.status} — in: ${r.punchIn ? 'yes' : 'no'} — out: ${r.punchOut ? 'yes' : 'no'}`
    );
    await ctx.reply(lines.join('\n'));
  });

  bot.on('photo', async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) return;
    const p = getPending(ctx.chat.id);
    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    const fileLink = await ctx.telegram.getFileLink(best.file_id);
    const name = `${Date.now()}-${ctx.from.id}.jpg`;
    const dest = path.join(absUploads, name);
    if (!fs.existsSync(absUploads)) {
      fs.mkdirSync(absUploads, { recursive: true });
    }
    await downloadTelegramFile(fileLink, dest);
    const rel = `/uploads/${name}`;

    if (p?.action === 'punch_in_selfie') {
      const selfieHash = hashFile(dest);
      try {
        const { url, publicId } = await uploadLocalImageToCloudinary(dest);
        if (p.needsLocation) {
          setPending(ctx.chat.id, {
            action: 'punch_in_location',
            selfieUrl: url,
            selfiePublicId: publicId,
            selfieHash,
          });
          await ctx.reply(
            'Now share your current location to complete punch in.',
            Markup.keyboard([[Markup.button.locationRequest('📍 Share my location')], ['⬅️ Cancel']]).resize()
          );
        } else {
          await punchInEmployee({
            employee: emp,
            selfieRelativePath: url,
            selfiePublicId: publicId,
            selfieHash,
          });
          await ctx.reply('✅ Punch in successful.', mainMenu());
          clearPending(ctx.chat.id);
        }
      } catch (e) {
        await ctx.reply(`❌ ${e.message}`, mainMenu());
        clearPending(ctx.chat.id);
      }
      return;
    }

    if (p?.action === 'selfie_upload') {
      await ActivityLog.create({
        organizationId: emp.organizationId,
        employeeId: emp._id,
        activityType: 'selfie',
        message: 'Photo proof',
        image: rel,
        timestamp: new Date(),
      });
      emitToOrganization(emp.organizationId, 'activity:new', {
        organizationId: emp.organizationId,
        activityType: 'selfie',
        employeeId: emp._id,
        employeeName: emp.name,
        image: rel,
        timestamp: new Date(),
      });
      notifySuperAdminsOfEvent(emp, 'Activity', 'Uploaded a selfie/proof photo');
      await ctx.reply('Photo saved.');
      clearPending(ctx.chat.id);
      return;
    }

    await ctx.reply('Photo received. Use menu options to attach to punch in or proof.');
  });

  bot.on('location', async (ctx) => {
    const emp = await ensureEmployee(ctx);
    if (!emp) return;
    const p = getPending(ctx.chat.id);
    if (p?.action !== 'punch_in_location') return;

    const { latitude, longitude } = ctx.message.location;
    try {
      await punchInEmployee({
        employee: emp,
        lat: latitude,
        lng: longitude,
        selfieRelativePath: p.selfieUrl,
        selfiePublicId: p.selfiePublicId,
        selfieHash: p.selfieHash,
      });
      await ctx.reply('✅ Punch in successful.', mainMenu());
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`, mainMenu());
    }
    clearPending(ctx.chat.id);
  });

  bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    const emp = await ensureEmployee(ctx);
    if (!emp) return;
    const p = getPending(ctx.chat.id);
    if (p?.action === 'punch_in_location') {
      await ctx.reply('Please tap "📍 Share my location" to complete punch in, or "⬅️ Cancel" to stop.');
      return;
    }
    if (p?.action === 'punch_in_selfie') {
      await ctx.reply('Please send a selfie photo to complete punch in, or "⬅️ Cancel" to stop.');
      return;
    }
    if (p?.action === 'task_text') {
      await ActivityLog.create({
        organizationId: emp.organizationId,
        employeeId: emp._id,
        activityType: 'task_update',
        message: ctx.message.text,
        timestamp: new Date(),
      });
      emitToOrganization(emp.organizationId, 'activity:new', {
        organizationId: emp.organizationId,
        activityType: 'task_update',
        employeeId: emp._id,
        employeeName: emp.name,
        message: ctx.message.text,
        timestamp: new Date(),
      });
      notifySuperAdminsOfEvent(emp, 'Task update', ctx.message.text);
      await ctx.reply('Task update recorded.');
      clearPending(ctx.chat.id);
      return;
    }
    if (p?.action === 'leave_calendar' && p.step === 'reason') {
      const reason = ctx.message.text.trim();
      try {
        const doc = await submitLeaveRequest(emp, {
          startDate: p.fromDate,
          endDate: p.toDate,
          reason,
          leaveType: p.leaveType,
        });
        const dateLabel =
          p.fromDate === p.toDate
            ? formatDisplayDate(p.fromDate)
            : `${formatDisplayDate(p.fromDate)} - ${formatDisplayDate(p.toDate)}`;
        await ctx.reply(
          `✅ Leave request submitted\nDate: ${dateLabel}\nType: ${doc.leaveType}\nReason: ${reason}\nStatus: Pending Approval`
        );
      } catch (e) {
        await ctx.reply(`❌ ${e.message}`);
      }
      clearPending(ctx.chat.id);
      return;
    }

    await ctx.reply(
      'Please tap one of the menu buttons below to get started — for example, "🏖 Leave Request" or "📍 Punch In".'
    );
  });

  bot.catch((err) => logger.error('Telegraf error', err));
}

let botInstance = null;

/**
 * @param {import('express').Express} [app]
 */
function startTelegramBot(app) {
  if (!telegramBotToken) {
    logger.warn('TELEGRAM_BOT_TOKEN not set — bot disabled.');
    return null;
  }

  const telegramAgent = new https.Agent({
    family: 4,
    keepAlive: true,
  });

  const bot = new Telegraf(telegramBotToken, {
    telegram: {
      agent: telegramAgent,
    },
  });

  botInstance = bot;
  registerHandlers(bot);

  if (telegramWebhookUrl && app) {
    const mountPath = telegramWebhookPath.startsWith('/')
      ? telegramWebhookPath
      : `/${telegramWebhookPath}`;

    app.use(mountPath, bot.webhookCallback());

    const base = telegramWebhookUrl.replace(/\/$/, '');
    const full = `${base}${mountPath}`;

    bot.telegram.setWebhook(full).then(() => {
      logger.info(`Telegram webhook set: ${full}`);
    });
  } else {
    bot.launch().then(() => logger.info('Telegram bot polling started'));

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }

  return bot;
}

async function notifyEmployeeOnTelegram(employee, text) {
  if (!botInstance || !employee?.telegramId) return;
  try {
    await botInstance.telegram.sendMessage(employee.telegramId, text);
  } catch (err) {
    logger.error('Failed to notify employee on Telegram', err.message);
  }
}

module.exports = { startTelegramBot, notifyEmployeeOnTelegram };