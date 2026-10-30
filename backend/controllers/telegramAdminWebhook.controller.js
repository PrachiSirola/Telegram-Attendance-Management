const Admin = require('../models/admin.model');
const { callTelegramApi } = require('../services/telegramNotify.service');
const { decideLeaveCore } = require('./leave.controller');
const logger = require('../utils/logger');
async function handleAdminWebhook(req, res) {
  res.sendStatus(200);

  try {
    const { adminId } = req.params;
    const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
    const admin = await Admin.findById(adminId).select(
      '+telegramBotToken +telegramWebhookSecret telegramChatId role organizationId name active'
    );
    if (!admin || !admin.active || !admin.telegramWebhookSecret || !admin.telegramBotToken) return;
    if (secretHeader !== admin.telegramWebhookSecret) {
      logger.error(`Admin webhook secret mismatch for admin ${adminId}`);
      return;
    }

    const update = req.body;
    const cb = update?.callback_query;
    if (!cb || !cb.data) return;

    const botToken = admin.telegramBotToken;
    const chatId = cb.message.chat.id;
    const messageId = cb.message.message_id;
    const originalText = cb.message.text || '';

    const [ns, step, action, leaveId] = String(cb.data).split(':');
    if (ns !== 'lv') return;

    await callTelegramApi(botToken, 'answerCallbackQuery', { callback_query_id: cb.id });

    if (step === 'ask') {
      const verb = action === 'approve' ? 'approve' : 'reject';
      await callTelegramApi(botToken, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: `${originalText}\n\nAre you sure you want to ${verb} this leave request?`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirm', callback_data: `lv:confirm:${action}:${leaveId}` },
              { text: '↩️ Cancel', callback_data: `lv:cancel:${action}:${leaveId}` },
            ],
          ],
        },
      });
      return;
    }

    if (step === 'cancel') {
      await callTelegramApi(botToken, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: `${originalText}\n\nCancelled — the leave request is unchanged.`,
        parse_mode: 'HTML',
      });
      return;
    }

    if (step === 'confirm') {
      try {
        await decideLeaveCore(leaveId, {
          action,
          admin: { _id: admin._id, name: admin.name, role: admin.role, organizationId: admin.organizationId },
        });
        const verbPast = action === 'approve' ? 'Approved' : 'Rejected';
        await callTelegramApi(botToken, 'editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `${originalText}\n\n✅ ${verbPast}.`,
          parse_mode: 'HTML',
        });
      } catch (err) {
        await callTelegramApi(botToken, 'editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `${originalText}\n\n⚠️ ${
            err.code === 'INSUFFICIENT_BALANCE'
              ? `${err.message}. Open the web dashboard to approve it as Paid (override) or Unpaid leave.`
              : err.message
          }`,
          parse_mode: 'HTML',
        });
      }
    }
  } catch (err) {
    logger.error('Admin webhook handling failed', err);
  }
}

module.exports = { handleAdminWebhook };