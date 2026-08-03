let io = null;

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    socket.on('join-role', (role) => {
      if (role) socket.join(`role:${role}`);
    });
    socket.on('join-family', (familyGroupId) => {
      if (familyGroupId) socket.join(`family:${familyGroupId}`);
    });
    socket.join('broadcast');
  });

  return io;
}

function getIO() {
  return io;
}

function emitNewReport(report) {
  if (io) io.emit('new-report', report);
}

function emitAlertBroadcast(alert) {
  if (io) io.emit('alert-broadcast', alert);
}

function emitStatusUpdate(report) {
  if (io) io.emit('status-update', report);
}

function emitFamilyUpdate(familyGroupId, payload) {
  if (io) io.to(`family:${familyGroupId}`).emit('family-update', payload);
}

module.exports = {
  initSocket,
  getIO,
  emitNewReport,
  emitAlertBroadcast,
  emitStatusUpdate,
  emitFamilyUpdate,
};
