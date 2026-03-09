import jwt from 'jsonwebtoken';
import { User, Room, RoomPlayer } from '../models/index.js';

// Grace-period перед удалением игрока из комнаты при дисконнекте.
// Это позволяет пережить перезагрузку страницы или кратковременный разрыв.
const DISCONNECT_GRACE_MS = 5000;
const pendingDisconnects = new Map(); // userId → timeoutId

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
    // Отменяем pending-дисконнект для этого пользователя (переподключение / смена страницы)
    const userId = socket.user.id;
    if (pendingDisconnects.has(userId)) {
      clearTimeout(pendingDisconnects.get(userId));
      pendingDisconnects.delete(userId);
    }

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

    socket.on('disconnect', () => {
      const uid = socket.user.id;

      const timer = setTimeout(async () => {
        pendingDisconnects.delete(uid);
        const entries = await RoomPlayer.findAll({
          where: { userId: uid },
          include: [{ model: Room, where: { status: 'waiting' } }],
        });
        await Promise.all(entries.map((e) => e.destroy()));
      }, DISCONNECT_GRACE_MS);

      pendingDisconnects.set(uid, timer);
    });
  });
}
