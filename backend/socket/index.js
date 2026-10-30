const { Server } = require('socket.io');
const { verifyAccess } = require('../utils/jwt');
const { setIO } = require('../services/socket.service');
const { corsOrigin, nodeEnv } = require('../config/env');
const logger = require('../utils/logger');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Unauthorized'));
      }
      const decoded = verifyAccess(token);
      if (decoded.type !== 'admin') {
        return next(new Error('Forbidden'));
      }
      if (!decoded.organizationId && decoded.role !== 'super_admin') {
        return next(new Error('Forbidden'));
      }
      socket.data.adminId = decoded.sub;
      socket.data.organizationId = decoded.organizationId || null;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    if (!socket.data.organizationId) {
      if (nodeEnv === 'development') {
        logger.debug(`Socket admin ${socket.data.adminId} connected with no organization room`);
      }
      socket.on('disconnect', () => {});
      return;
    }
    const room = `org:${socket.data.organizationId}`;
    socket.join(room);
    if (nodeEnv === 'development') {
      logger.debug(`Socket admin ${socket.data.adminId} joined ${room}`);
    }
    socket.on('disconnect', () => {});
  });

  setIO(io);
  return io;
}

module.exports = { initSocket };