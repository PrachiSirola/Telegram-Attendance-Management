const path = require('path');
const perfTrace = require('./middlewares/perfTrace');
perfTrace.install();
require('./utils/authCache').install();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const { loadEnv, corsOrigin, nodeEnv } = require('./config/env');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const v1 = require('./routes/v1');
const { uploadsDir } = require('./config/env');
const logger = require('./utils/logger');

loadEnv();

const app = express();

app.set('trust proxy', 1);
app.use(perfTrace.middleware);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: nodeEnv === 'production' ? 300 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(mongoSanitize());

app.use(
  `/${uploadsDir}`,
  express.static(path.join(__dirname, uploadsDir), {
    maxAge: nodeEnv === 'production' ? '7d' : 0,
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: nodeEnv });
});
const { handleAdminWebhook } = require('./controllers/telegramAdminWebhook.controller');
app.post('/telegram/admin-webhook/:adminId', handleAdminWebhook);

app.use('/api/v1', v1);

app.use(notFound);
app.use(errorHandler);

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', err);
});

module.exports = app;