import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User, Room, RoomPlayer } from '../models/index.js';

const DISCONNECT_GRACE_MS = 5000;
const pendingDisconnects = new Map(); // userId → timeoutId

// Комнаты, ожидающие дольше этого времени, закрываются автоматически
const STALE_ROOM_TIMEOUT_MS = 30 * 60 * 1000; // 30 минут
const STALE_ROOM_CHECK_MS   =      60 * 1000;  // проверяем каждую минуту

async function cleanupStaleRooms(io) {
  const cutoff = new Date(Date.now() - STALE_ROOM_TIMEOUT_MS);
  const staleRooms = await Room.findAll({
    where: { status: 'waiting', createdAt: { [Op.lt]: cutoff } },
  });

  for (const room of staleRooms) {
    io.to(room.id).emit('room:closed', { reason: 'Комната закрыта — долгое ожидание' });
    await RoomPlayer.destroy({ where: { roomId: room.id } });
    await room.destroy();
  }
}

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

  // Запускаем периодическую очистку устаревших комнат
  setInterval(() => cleanupStaleRooms(io).catch(console.error), STALE_ROOM_CHECK_MS);

  io.on('connection', (socket) => {
    // Отменяем pending-дисконнект для этого пользователя
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
