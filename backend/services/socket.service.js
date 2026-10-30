let ioRef = null;

function setIO(io) {
  ioRef = io;
}

function emitToOrganization(organizationId, event, payload) {
  if (!ioRef || !organizationId) return;
  ioRef.to(`org:${organizationId.toString()}`).emit(event, payload);
}

module.exports = { setIO, emitToOrganization };
