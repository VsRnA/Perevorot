import jwt from 'jsonwebtoken';
import { User, Room, RoomPlayer, Game, GamePlayer } from '../models/index.js';
import { initGame } from '../services/gameEngine.js';

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

    // Старт игры (только хост)
    socket.on('game:start', async ({ roomId }) => {
      const room = await Room.findByPk(roomId, {
        include: [{ model: User, as: 'players', attributes: ['id', 'username'] }],
      });
      if (!room) return;
      if (room.hostId !== socket.user.id) return;
      if (room.players.length < 2) return;

      const playerIds = room.players.map((p) => p.id);
      const gameState = initGame(playerIds);

      const game = await Game.create({
        roomId: room.id,
        state: gameState,
        currentPlayerIndex: 0,
      });

      await Promise.all(
        gameState.players.map((p) =>
          GamePlayer.create({
            gameId: game.id,
            userId: p.userId,
            coins: p.coins,
            cards: p.cards,
            isEliminated: p.isEliminated,
            turnOrder: p.turnOrder,
          })
        )
      );

      await room.update({ status: 'playing' });

      io.to(roomId).emit('game:started', { gameId: game.id });
    });

    socket.on('disconnect', () => {});
  });
}
