import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Game = sequelize.define('Game', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  roomId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'finished'),
    defaultValue: 'active',
  },
  currentPlayerIndex: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Полное состояние игры: колода, ожидающие действия и т.д.
  state: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  winnerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
});

export default Game;
