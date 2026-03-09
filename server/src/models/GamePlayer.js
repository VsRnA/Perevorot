import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const GamePlayer = sequelize.define('GamePlayer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  gameId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  coins: {
    type: DataTypes.INTEGER,
    defaultValue: 2,
  },
  // Карты игрока: [{ role, revealed }]
  cards: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  isEliminated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  turnOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

export default GamePlayer;
