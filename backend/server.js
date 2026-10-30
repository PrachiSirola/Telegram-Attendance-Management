const http = require('http');
const connectDB = require('./config/database');
const app = require('./app');
const { initSocket } = require('./socket');
const { startCronJobs } = require('./jobs/cronJobs');
const { startTelegramBot } = require('./bot/telegramBot');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { port } = require('./config/env');
const logger = require('./utils/logger');
const ensureSeedAdmin = require('./utils/ensureSeedAdmin');
const ensureLeaveBalances = require('./utils/ensureLeaveBalances');
const { initEmployeeIdCounters } = require('./services/employeeId.service');

let server;
let bot;

async function main() {
  await connectDB();
  await ensureSeedAdmin().catch((e) => logger.error('Seed admin failed', e));
  await ensureLeaveBalances().catch((e) => logger.error('Leave balance init failed', e));
  await initEmployeeIdCounters().catch((e) => logger.error('Employee ID counter init failed', e));
  server = http.createServer(app);
  initSocket(server);
  startCronJobs();
  bot = startTelegramBot(app);
  app.use(notFound);
  app.use(errorHandler);
  server.listen(port, () => {
    logger.info(`HTTP + Socket.IO listening on port ${port}`);
  });
}

function shutdown(signal) {
  logger.info(`Received ${signal}, closing server gracefully...`);
  if (bot && typeof bot.stop === 'function') {
    try { bot.stop(signal); } catch {}
  }
  if (server) {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(0);
    }, 1500).unref();
  } else {
    process.exit(0);
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGUSR2', () => shutdown('SIGUSR2'));

main().catch((e) => {
  logger.error('Server failed to start', e);
  process.exit(1);
});