const { nodeEnv } = require('../config/env');

function log(level, message, meta) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${message}`;
  if (meta !== undefined) {
    console[level === 'error' ? 'error' : 'log'](line, meta);
  } else {
    console[level === 'error' ? 'error' : 'log'](line);
  }
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  debug: (msg, meta) => {
    if (nodeEnv === 'development') log('info', msg, meta);
  },
};
