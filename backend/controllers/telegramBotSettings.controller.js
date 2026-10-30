const Admin = require('../models/admin.model');
const asyncHandler = require('../utils/asyncHandler');

const getSettings = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select('+telegramBotToken telegramChatId');
  res.json({
    success: true,
    data: {
      chatId: admin.telegramChatId || '',
      hasToken: !!admin.telegramBotToken,
    },
  });
});
const revealToken = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select('+telegramBotToken');
  res.json({
    success: true,
    data: { botToken: admin.telegramBotToken || '' },
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select('+telegramBotToken');
  const { botToken, chatId } = req.body;
  if (typeof botToken === 'string' && botToken.trim()) {
    admin.telegramBotToken = botToken.trim();
  }
  if (typeof chatId === 'string') {
    admin.telegramChatId = chatId.trim();
  }
  await admin.save();

  res.json({
    success: true,
    data: {
      chatId: admin.telegramChatId || '',
      hasToken: !!admin.telegramBotToken,
    },
  });
});

module.exports = { getSettings, updateSettings, revealToken };