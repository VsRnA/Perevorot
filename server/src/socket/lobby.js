import jwt from 'jsonwebtoken';
import { User, Room, RoomPlayer } from '../models/index.js';

export function registerLobbyHandlers(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(payload.id);
      if (!user) return next(new Error('Unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Подключиться к комнате
    socket.on('room:join', async ({ roomId }) => {
      const room = await Room.findByPk(roomId, {
        include: [{ model: User, as: 'players', attributes: ['id', 'username'] }],
      });
      if (!room) return;

      socket.join(roomId);

      io.to(roomId).emit('room:updated', {
        players: room.players.map((p) => ({ id: p.id, username: p.username })),
        hostId: room.hostId,
      });
    });

    // Покинуть комнату (socket-уведомление)
    socket.on('room:leave', ({ roomId }) => {
      socket.leave(roomId);
    });

    socket.on('disconnect', () => {});
  });
}
