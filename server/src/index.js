import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import sequelize from './config/database.js';
import './models/index.js';
import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
import { registerLobbyHandlers } from './socket/lobby.js';
import { registerGameHandlers } from './socket/game.js';

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);

registerLobbyHandlers(io);
registerGameHandlers(io);

async function start() {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Database connected');

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch(console.error);
