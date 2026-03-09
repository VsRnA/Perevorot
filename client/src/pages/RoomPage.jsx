import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { connectSocket, getSocket } from '../socket/socket';
import api from '../api/axios';

function Avatar({ username, isHost }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold text-amber-400">
          {username[0].toUpperCase()}
        </div>
        {isHost && (
          <span className="absolute -top-1 -right-1 text-xs bg-amber-500 text-gray-950 rounded-full w-5 h-5 flex items-center justify-center">
            👑
          </span>
        )}
      </div>
      <span className="text-sm text-gray-300">@{username}</span>
    </div>
  );
}

export default function RoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/rooms`).then(({ data }) => {
      const found = data.find((r) => r.id === id);
      if (found) setRoom(found);
    });

    const socket = connectSocket(token);
    socket.emit('room:join', { roomId: id });

    socket.on('room:updated', ({ players, hostId }) => {
      setRoom((prev) => prev ? { ...prev, players, hostId } : prev);
    });

    socket.on('game:started', ({ gameId }) => {
      navigate(`/game/${gameId}`);
    });

    return () => {
      socket.emit('room:leave', { roomId: id });
      socket.off('room:updated');
      socket.off('game:started');
    };
  }, [id]);

  async function leave() {
    await api.post(`/rooms/${id}/leave`);
    navigate('/lobby');
  }

  async function startGame() {
    const socket = getSocket();
    socket.emit('game:start', { roomId: id });
  }

  const isHost = room?.hostId === user?.id;
  const canStart = room?.players.length >= 2;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-gray-500 text-sm mb-1">Код комнаты</p>
          <h2 className="font-mono text-4xl font-black text-amber-400 tracking-widest">
            {room?.code ?? '------'}
          </h2>
          <p className="text-gray-600 text-sm mt-1">Поделись кодом с друзьями</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
              Игроки {room ? `${room.players.length}/${room.maxPlayers}` : ''}
            </h3>
            <span className="text-xs text-gray-600">Ожидание игроков...</span>
          </div>

          <div className="flex flex-wrap gap-6 justify-center min-h-24 mb-6">
            {room?.players.map((p) => (
              <Avatar key={p.id} username={p.username} isHost={p.id === room.hostId} />
            ))}
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-900 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={leave} className="btn-outline flex-1">Покинуть</button>
            {isHost && (
              <button
                onClick={startGame}
                disabled={!canStart}
                className="btn-primary flex-1"
                title={!canStart ? 'Нужно минимум 2 игрока' : ''}
              >
                Начать игру
              </button>
            )}
          </div>

          {isHost && !canStart && (
            <p className="text-gray-600 text-xs text-center mt-3">Нужно минимум 2 игрока для начала</p>
          )}
        </div>
      </div>
    </div>
  );
}
