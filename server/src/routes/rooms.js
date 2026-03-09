import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { Room, RoomPlayer, User } from '../models/index.js';
import { generateRoomCode } from '../services/roomCode.js';

const router = Router();

function formatRoom(room) {
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    maxPlayers: room.maxPlayers,
    host: { id: room.host.id, username: room.host.username },
    players: room.players.map((p) => ({ id: p.id, username: p.username })),
  };
}

// GET /api/rooms — список открытых комнат
router.get('/', authenticate, async (req, res) => {
  const rooms = await Room.findAll({
    where: { status: 'waiting' },
    include: [
      { model: User, as: 'host', attributes: ['id', 'username'] },
      { model: User, as: 'players', attributes: ['id', 'username'] },
    ],
  });
  res.json(rooms.map(formatRoom));
});

// POST /api/rooms — создать комнату
router.post('/', authenticate, async (req, res) => {
  const { maxPlayers = 6 } = req.body;

  if (maxPlayers < 2 || maxPlayers > 6) {
    return res.status(400).json({ error: 'maxPlayers must be between 2 and 6' });
  }

  const existing = await RoomPlayer.findOne({
    where: { userId: req.user.id },
    include: [{ model: Room, where: { status: 'waiting' } }],
  });
  if (existing) {
    return res.status(409).json({ error: 'You are already in a room' });
  }

  const code = await generateRoomCode();
  const room = await Room.create({ code, hostId: req.user.id, maxPlayers });
  await RoomPlayer.create({ roomId: room.id, userId: req.user.id });

  const fullRoom = await Room.findByPk(room.id, {
    include: [
      { model: User, as: 'host', attributes: ['id', 'username'] },
      { model: User, as: 'players', attributes: ['id', 'username'] },
    ],
  });

  res.status(201).json(formatRoom(fullRoom));
});

// POST /api/rooms/join — войти по коду
router.post('/join', authenticate, async (req, res) => {
  const { code } = req.body;

  const room = await Room.findOne({
    where: { code, status: 'waiting' },
    include: [
      { model: User, as: 'host', attributes: ['id', 'username'] },
      { model: User, as: 'players', attributes: ['id', 'username'] },
    ],
  });

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  if (room.players.length >= room.maxPlayers) {
    return res.status(409).json({ error: 'Room is full' });
  }

  const alreadyIn = room.players.some((p) => p.id === req.user.id);
  if (alreadyIn) {
    return res.json(formatRoom(room));
  }

  await RoomPlayer.create({ roomId: room.id, userId: req.user.id });
  await room.reload({ include: [
    { model: User, as: 'host', attributes: ['id', 'username'] },
    { model: User, as: 'players', attributes: ['id', 'username'] },
  ]});

  res.json(formatRoom(room));
});

// POST /api/rooms/:id/leave — покинуть комнату
router.post('/:id/leave', authenticate, async (req, res) => {
  const room = await Room.findByPk(req.params.id, {
    include: [{ model: User, as: 'players', attributes: ['id'] }],
  });

  if (!room) return res.status(404).json({ error: 'Room not found' });

  await RoomPlayer.destroy({ where: { roomId: room.id, userId: req.user.id } });

  if (room.hostId === req.user.id) {
    const remaining = room.players.filter((p) => p.id !== req.user.id);
    if (remaining.length === 0) {
      await room.destroy();
    } else {
      await room.update({ hostId: remaining[0].id });
    }
  }

  res.json({ ok: true });
});

export default router;
