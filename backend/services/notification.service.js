const Notification = require('../models/notification.model');
const { emitToOrganization } = require('./socket.service');
const logger = require('../utils/logger');

async function createAdminNotification({ organizationId, type, title, body, meta }) {
  try {
    const doc = await Notification.create({
      organizationId,
      type,
      title,
      body,
      meta,
      targetAdmin: true,
    });
    emitToOrganization(organizationId, 'notification:new', doc.toObject());
    return doc;
  } catch (e) {
    logger.error('createAdminNotification', e);
    throw e;
  }
}

module.exports = { createAdminNotification };
