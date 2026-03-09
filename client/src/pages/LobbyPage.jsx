import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';

export default function LobbyPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRooms() {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data);
    } catch {}
  }

  async function createRoom() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/rooms');
      navigate(`/room/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания комнаты');
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    if (!joinCode.trim()) return;
    setError('');
    try {
      const { data } = await api.post('/rooms/join', { code: joinCode.toUpperCase() });
      navigate(`/room/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Комната не найдена');
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-black text-amber-400 tracking-widest uppercase">Переворот</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">@{user?.username}</span>
          <button onClick={logout} className="btn-ghost text-sm px-3 py-1.5">Выйти</button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {/* Join / Create */}
        <div className="flex flex-col sm:flex-row gap-2 mb-8">
          <input
            className="input flex-1"
            placeholder="Код комнаты (например: AB12CD)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            maxLength={6}
          />
          <div className="flex gap-2">
            <button onClick={joinRoom} className="btn-outline flex-1 sm:flex-none whitespace-nowrap">
              Войти
            </button>
            <button onClick={createRoom} className="btn-primary flex-1 sm:flex-none whitespace-nowrap" disabled={loading}>
              + Создать
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-900 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {/* Rooms list */}
        <div>
          <h2 className="text-gray-400 text-sm font-semibold uppercase tracking-widest mb-3">
            Открытые комнаты
          </h2>

          {rooms.length === 0 ? (
            <div className="card p-12 text-center text-gray-600">
              Нет открытых комнат — создай первую!
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} onJoin={() => navigate(`/room/${room.id}`)} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function RoomCard({ room, onJoin }) {
  const navigate = useNavigate();

  async function join() {
    try {
      await api.post('/rooms/join', { code: room.code });
      navigate(`/room/${room.id}`);
    } catch {}
  }

  const isFull = room.players.length >= room.maxPlayers;

  return (
    <div className="card px-4 py-3 flex items-center gap-3">
      {/* Код */}
      <span className="font-mono text-amber-400 font-bold tracking-widest shrink-0">{room.code}</span>

      {/* Хост + слоты */}
      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
        <span className="text-gray-300 text-sm truncate">@{room.host.username}</span>
        <div className="flex gap-1 shrink-0">
          {Array.from({ length: room.maxPlayers }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i < room.players.length ? 'bg-amber-400' : 'bg-gray-700'}`}
            />
          ))}
        </div>
        <span className="text-gray-500 text-xs shrink-0">{room.players.length}/{room.maxPlayers}</span>
      </div>

      {/* Кнопка всегда справа, не сжимается */}
      <button onClick={join} className="btn-ghost text-sm px-3 py-1.5 shrink-0" disabled={isFull}>
        {isFull ? 'Полная' : 'Войти'}
      </button>
    </div>
  );
}
