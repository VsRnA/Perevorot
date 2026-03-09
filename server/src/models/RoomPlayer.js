import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RoomPlayer = sequelize.define('RoomPlayer', {
  roomId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
});

export default RoomPlayer;
