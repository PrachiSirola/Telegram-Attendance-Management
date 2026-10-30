const https = require('https');
const querystring = require('querystring');
const crypto = require('crypto');
const Admin = require('../models/admin.model');
const Organization = require('../models/organization.model');
const logger = require('../utils/logger');
const { resolveTz } = require('../utils/dateHelpers');
const { telegramWebhookUrl } = require('../config/env');
function callTelegramApi(botToken, method, params = {}) {
  return new Promise((resolve) => {
    const body = JSON.stringify(params);
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/${method}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', (err) => {
      logger.error(`Telegram API ${method} failed`, err.message);
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

function sendTelegramMessage(botToken, chatId, text, inlineKeyboard) {
  return new Promise((resolve) => {
    const qs = querystring.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const url = `https://api.telegram.org/bot${botToken}/sendMessage?${qs}`;
    if (inlineKeyboard) {
      callTelegramApi(botToken, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      }).then(() => resolve());
      return;
    }
    https
      .get(url, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve());
      })
      .on('error', (err) => {
        logger.error('Telegram notify failed', err.message);
        resolve();
      });
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTime(date, tz) {
  return (date instanceof Date ? date : new Date(date)).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: resolveTz(tz),
  });
}
function buildMessage({ name, employeeId, company, eventLabel, eventDetail, time, location, timezone }) {
  const lines = [`<b>${escapeHtml(name)}</b>`];
  if (employeeId) lines.push(`Employee ID - ${escapeHtml(employeeId)}`);
  lines.push(`Company - ${escapeHtml(company)}`);
  lines.push(`${escapeHtml(eventLabel)} - ${escapeHtml(eventDetail)}`);
  if (location && location.lat != null && location.lng != null) {
    const mapUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
    lines.push(`Location - <a href="${mapUrl}">View on map</a>`);
  }
  lines.push(`Time - ${formatTime(time, timezone)}`);
  return lines.join('\n');
}

async function sendToAdmins(filter, text, inlineKeyboard) {
  try {
    const admins = await Admin.find({
      ...filter,
      active: true,
      telegramChatId: { $exists: true, $ne: null, $ne: '' },
    }).select('+telegramBotToken telegramChatId');

    const configured = admins.filter((a) => a.telegramBotToken && a.telegramChatId);
    await Promise.all(
      configured.map((a) => sendTelegramMessage(a.telegramBotToken, a.telegramChatId, text, inlineKeyboard))
    );
  } catch (err) {
    logger.error('sendToAdmins error', err);
  }
}

async function notifySuperAdmins(text) {
  return sendToAdmins({ role: 'super_admin' }, text);
}
async function notifyOrgAdmins(organizationId, text) {
  if (!organizationId) return;
  return sendToAdmins({ role: 'admin', organizationId }, text);
}

async function notifyLeaveRequestWithButtons(organizationId, text, leaveId) {
  const inlineKeyboard = [
    [
      { text: '✅ Approve', callback_data: `lv:ask:approve:${leaveId}` },
      { text: '❌ Reject', callback_data: `lv:ask:reject:${leaveId}` },
    ],
  ];
  await Promise.all([
    sendToAdmins({ role: 'super_admin' }, text, inlineKeyboard),
    organizationId ? sendToAdmins({ role: 'admin', organizationId }, text, inlineKeyboard) : Promise.resolve(),
  ]);
}

async function registerAdminWebhook(adminId, botToken) {
  if (!telegramWebhookUrl) {
    return { ok: false, error: 'TELEGRAM_WEBHOOK_URL is not configured on the server.' };
  }
  const secret = crypto.randomBytes(24).toString('hex');
  const base = telegramWebhookUrl.replace(/\/$/, '');
  const url = `${base}/telegram/admin-webhook/${adminId}`;
  const result = await callTelegramApi(botToken, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['callback_query'],
  });
  if (!result || !result.ok) {
    return { ok: false, error: result?.description || 'Telegram rejected the webhook registration.' };
  }
  return { ok: true, secret };
}

async function notifySuperAdminsOfEvent(employee, eventLabel, eventDetail, time = new Date(), location) {
  try {
    const org = await Organization.findById(employee.organizationId).select('name timezone');
    const text = buildMessage({
      timezone: org?.timezone,
      name: employee.name,
      employeeId: employee.employeeId,
      company: org?.name || 'Unknown organization',
      eventLabel,
      eventDetail,
      time,
      location,
    });
    await Promise.all([notifySuperAdmins(text), notifyOrgAdmins(employee.organizationId, text)]);
  } catch (err) {
    logger.error('notifySuperAdminsOfEvent error', err);
  }
}

async function notifySuperAdminsOfAdminEvent(
  adminName,
  organizationId,
  orgName,
  eventLabel,
  eventDetail,
  time = new Date()
) {
  const orgDoc = await Organization.findById(organizationId).select('timezone').lean();
  const text = buildMessage({
    timezone: orgDoc?.timezone,
    name: adminName,
    employeeId: null,
    company: orgName,
    eventLabel,
    eventDetail,
    time,
  });
  await Promise.all([notifySuperAdmins(text), notifyOrgAdmins(organizationId, text)]);
}

module.exports = {
  notifySuperAdmins,
  notifyOrgAdmins,
  notifySuperAdminsOfEvent,
  notifySuperAdminsOfAdminEvent,
  notifyLeaveRequestWithButtons,
  registerAdminWebhook,
  callTelegramApi,
  escapeHtml,
};