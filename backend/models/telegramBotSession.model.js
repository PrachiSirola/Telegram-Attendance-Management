const mongoose = require('mongoose');
const telegramBotSessionSchema = new mongoose.Schema(
  {
    telegramUserId: { type: String, required: true, unique: true, index: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TelegramBotSession', telegramBotSessionSchema);
