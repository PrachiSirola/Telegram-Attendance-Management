require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL'];

function loadEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(
      `[env] Missing: ${missing.join(', ')} — set these in .env for production.`
    );
  }
}

module.exports = {
  loadEnv,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '1002', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendance_management',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-change-me',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  twoFactorEncryptionKey: process.env.TWO_FA_ENCRYPTION_KEY || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:1001',
  overtimeAfterMins: parseInt(process.env.OVERTIME_AFTER_MINS || '0', 10),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || 'YourBot',
  telegramWebhookPath: process.env.TELEGRAM_WEBHOOK_PATH || '/telegram/webhook',
  telegramWebhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:1002',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'attendance/punch-in',
  frontendUrl: process.env.FRONTEND_URL || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: (process.env.SMTP_USER || '').trim(),
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || 'Attendance System <no-reply@example.com>',
};