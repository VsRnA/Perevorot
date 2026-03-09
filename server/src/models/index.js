import User from './User.js';
import Room from './Room.js';
import RoomPlayer from './RoomPlayer.js';
import Game from './Game.js';
import GamePlayer from './GamePlayer.js';

Room.belongsTo(User, { as: 'host', foreignKey: 'hostId' });
Room.belongsToMany(User, { through: RoomPlayer, foreignKey: 'roomId', as: 'players' });
User.belongsToMany(Room, { through: RoomPlayer, foreignKey: 'userId', as: 'rooms' });
RoomPlayer.belongsTo(Room, { foreignKey: 'roomId' });

Game.belongsTo(Room, { foreignKey: 'roomId' });
Game.hasMany(GamePlayer, { foreignKey: 'gameId', as: 'gamePlayers' });
GamePlayer.belongsTo(User, { foreignKey: 'userId', as: 'user' });
GamePlayer.belongsTo(Game, { foreignKey: 'gameId' });

export { User, Room, RoomPlayer, Game, GamePlayer };
