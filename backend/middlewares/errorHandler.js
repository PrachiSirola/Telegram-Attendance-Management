const logger = require('../utils/logger');
const { nodeEnv } = require('../config/env');

function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not Found: ${req.originalUrl}`));
}
function errorHandler(err, req, res, next) {
  const status =
    err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  if (status >= 500) {
    logger.error(err.message, { stack: err.stack });
  }

  res.status(status).json({
    success: false,
    message: err.message || 'Server error',
    ...(nodeEnv === 'development' && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
