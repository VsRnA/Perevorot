import { Room, Game, GamePlayer, User, RoomPlayer } from '../models/index.js';
import {
  initGame,
  applyAction,
  applyChallenge,
  applyBlock,
  applyPass,
  applyLoseCard,
  applyExchange,
  checkWinner,
  getActivePlayers,
} from '../services/gameEngine.js';

// Отправить состояние игры всем игрокам.
// Каждый игрок видит только свои закрытые карты.
async function broadcastState(io, _roomId, game, gamePlayers) {
  const state = game.state;

  for (const gp of gamePlayers) {
    // Ищем сокет среди всех подключённых, а не только внутри комнаты,
    // чтобы избежать гонки при переходе lobby → game page.
    let targetSocket = null;
    for (const [, s] of io.sockets.sockets) {
      if (s.user?.id === gp.userId) { targetSocket = s; break; }
    }
    if (!targetSocket) continue;

    const visiblePlayers = state.players.map((p) => {
      if (p.userId === gp.userId) return p; // свои карты видны
      return {
        ...p,
        cards: p.cards.map((c) => (c.revealed ? c : { role: 'hidden', revealed: false })),
      };
    });

    targetSocket.emit('game:state', {
      gameId: game.id,
      phase: state.phase,
      currentPlayerId: state.currentPlayerId,
      pendingAction: state.pendingAction
        ? {
            action: state.pendingAction.action,
            actorId: state.pendingAction.actorId,
            targetId: state.pendingAction.targetId,
            blockerId: state.pendingAction.blockerId ?? null,
            // drawnCards отправляем только самому актору
            drawnCards: gp.userId === state.pendingAction.actorId
              ? (state.pendingAction.drawnCards ?? null)
              : null,
          }
        : null,
      players: visiblePlayers,
      log: state.log.slice(-20),
    });
  }
}

async function saveAndBroadcast(io, roomId, game) {
  const gamePlayers = await GamePlayer.findAll({ where: { gameId: game.id } });
  await game.save();
  await broadcastState(io, roomId, game, gamePlayers);

  const winner = checkWinner(game.state);
  if (winner) {
    await game.update({ status: 'finished', winnerId: winner });
    await Room.update({ status: 'finished' }, { where: { id: roomId } });
    io.to(roomId).emit('game:over', { winnerId: winner });
  }
}

export function registerGameHandlers(io) {
  io.on('connection', (socket) => {
    // ── Присоединиться к игре (запрос текущего состояния) ─────────────────────
    socket.on('game:join', async ({ gameId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return;
        const roomId = game.roomId;
        socket.join(roomId);
        const gamePlayers = await GamePlayer.findAll({ where: { gameId } });
        await broadcastState(io, roomId, game, gamePlayers);
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    // ── Старт игры (только хост) ─────────────────────────────────────────────
    socket.on('game:start', async ({ roomId }) => {
      try {
        const room = await Room.findByPk(roomId, {
          include: [{ model: User, as: 'players', attributes: ['id', 'username'] }],
        });

        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (room.hostId !== socket.user.id) return socket.emit('error', { message: 'Only host can start' });
        if (room.players.length < 2) return socket.emit('error', { message: 'Need at least 2 players' });
        if (room.status !== 'waiting') return socket.emit('error', { message: 'Game already started' });

        const players = room.players.map((p) => ({ id: p.id, username: p.username }));
        const state = initGame(players);

        const game = await Game.create({ roomId, state });
        await GamePlayer.bulkCreate(
          state.players.map((p) => ({
            gameId: game.id,
            userId: p.userId,
            coins: p.coins,
            cards: p.cards,
            turnOrder: p.turnOrder,
          })),
        );

        await room.update({ status: 'playing' });
        io.to(roomId).emit('game:started', { gameId: game.id });
        await saveAndBroadcast(io, roomId, game);
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    // ── Действие ─────────────────────────────────────────────────────────────
    socket.on('game:action', async ({ gameId, action, targetId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });

        applyAction(game.state, { actorId: socket.user.id, action, targetId });
        game.changed('state', true);

        const room = await Room.findByPk(game.roomId);
        await saveAndBroadcast(io, room.id, game);
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    // ── Оспаривание ───────────────────────────────────────────────────────────
    socket.on('game:challenge', async ({ gameId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });

        applyChallenge(game.state, { challengerId: socket.user.id });
        game.changed('state', true);

        const room = await Room.findByPk(game.roomId);
        await saveAndBroadcast(io, room.id, game);
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    // ── Блокировка ────────────────────────────────────────────────────────────
    socket.on('game:block', async ({ gameId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });

        applyBlock(game.state, { blockerId: socket.user.id });
        game.changed('state', true);

        const room = await Room.findByPk(game.roomId);
        await saveAndBroadcast(io, room.id, game);
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    // ── Пропуск (согласиться с действием/блоком) ──────────────────────────────
    socket.on('game:pass', async ({ gameId }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });

        applyPass(game.state, { passerId: socket.user.id });
        game.changed('state', true);

        const room = await Room.findByPk(game.roomId);
        await saveAndBroadcast(io, room.id, game);
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    // ── Потеря карты ──────────────────────────────────────────────────────────
    socket.on('game:lose_card', async ({ gameId, cardIndex }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });

        applyLoseCard(game.state, { loserId: socket.user.id, cardIndex });
        game.changed('state', true);

        const room = await Room.findByPk(game.roomId);
        await saveAndBroadcast(io, room.id, game);
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });

    // ── Обмен карт (ambassador) ───────────────────────────────────────────────
    socket.on('game:exchange', async ({ gameId, keptIndices }) => {
      try {
        const game = await Game.findByPk(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found' });

        applyExchange(game.state, { actorId: socket.user.id, keptIndices });
        game.changed('state', true);

        const room = await Room.findByPk(game.roomId);
        await saveAndBroadcast(io, room.id, game);
      } catch (e) {
        socket.emit('error', { message: e.message });
      }
    });
  });
}
