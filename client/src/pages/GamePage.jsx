import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';
import { getSocket } from '../socket/socket';
import { OpponentPanel } from '../components/game/OpponentPanel';
import { GameCard } from '../components/game/PlayerCard';
import { ActionPanel } from '../components/game/ActionPanel';
import { GameLog } from '../components/game/GameLog';
import { CardReference } from '../components/game/CardReference';

export default function GamePage() {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { phase, currentPlayerId, pendingAction, players, log, winner, setGameState, setWinner, reset } = useGameStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) { navigate('/lobby'); return; }

    function onState(state) { setGameState(state); }
    function onOver({ winnerId }) { setWinner(winnerId); }
    // При переподключении повторно запрашиваем состояние игры
    function onConnect() { socket.emit('game:join', { gameId }); }

    socket.on('game:state', onState);
    socket.on('game:over', onOver);
    socket.on('connect', onConnect);

    // Запрашиваем текущее состояние игры при загрузке страницы
    socket.emit('game:join', { gameId });

    return () => {
      socket.off('game:state', onState);
      socket.off('game:over', onOver);
      socket.off('connect', onConnect);
      reset();
    };
  }, [gameId]);

  const myPlayer = players.find((p) => p.userId === user?.id);
  const opponents = players.filter((p) => p.userId !== user?.id);

  if (winner) {
    const winnerPlayer = players.find((p) => p.userId === winner);
    const isMe = winner === user?.id;
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-12 text-center max-w-sm w-full">
          <div className="text-6xl mb-4">{isMe ? '🏆' : '💀'}</div>
          <h2 className="text-2xl font-black mb-2">
            {isMe ? 'Ты победил!' : `Победил @${winnerPlayer?.username ?? '?'}`}
          </h2>
          <p className="text-gray-500 mb-6">{isMe ? 'Все соперники устранены.' : 'В следующий раз повезёт.'}</p>
          <button onClick={() => navigate('/lobby')} className="btn-primary w-full">В лобби</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-amber-400 tracking-widest uppercase">Переворот</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 uppercase tracking-widest">
            {phaseLabel(phase)}
          </span>
          <span className="text-gray-600 text-sm">@{user?.username}</span>
        </div>
      </div>

      {/* Opponents */}
      <div className="flex flex-wrap gap-3 justify-center">
        {opponents.map((p) => (
          <OpponentPanel
            key={p.userId}
            player={p}
            isCurrentTurn={p.userId === currentPlayerId}
          />
        ))}
      </div>

      {/* Center: pending action info */}
      {pendingAction && (
        <div className="card px-4 py-3 text-center space-y-1">
          <p className="text-sm text-gray-300">
            <span className="text-amber-400 font-semibold">
              @{players.find((p) => p.userId === pendingAction.actorId)?.username}
            </span>
            {' '}заявляет{' '}
            <span className="text-white font-semibold">{actionLabel(pendingAction.action)}</span>
            {pendingAction.targetId && (
              <span> против{' '}
                <span className="text-red-400 font-semibold">
                  @{players.find((p) => p.userId === pendingAction.targetId)?.username}
                </span>
              </span>
            )}
          </p>
          {pendingAction.blockerId && (
            <p className="text-sm text-gray-400">
              🛡️{' '}
              <span className="text-blue-300 font-semibold">
                @{players.find((p) => p.userId === pendingAction.blockerId)?.username}
              </span>
              {' '}блокирует
            </p>
          )}
          <p className="text-xs text-gray-600 uppercase tracking-widest">{phaseLabel(phase)}</p>
        </div>
      )}

      {/* Log */}
      <GameLog log={log} />

      {/* My cards + coins */}
      {myPlayer && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Твои карты</span>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400">💰</span>
              <span className="text-amber-400 font-bold text-lg">{myPlayer.coins}</span>
              <span className="text-gray-600 text-xs">монет</span>
            </div>
          </div>
          <div className="flex gap-3">
            {myPlayer.cards.map((card, i) => (
              <GameCard key={i} role={card.role} revealed={card.revealed} />
            ))}
          </div>
        </div>
      )}

      {/* Action panel */}
      {myPlayer && (
        <ActionPanel
          gameId={gameId}
          myPlayer={myPlayer}
          players={players}
          phase={phase}
          pendingAction={pendingAction}
          myUserId={user?.id}
          currentPlayerId={currentPlayerId}
        />
      )}

      {/* Card reference */}
      <CardReference />
    </div>
  );
}

function phaseLabel(phase) {
  const map = {
    action: 'Ход игрока',
    block: 'Блокировка',
    challenge_action: 'Оспаривание',
    challenge_block: 'Оспаривание блока',
    lose_card: 'Выбор карты',
    exchange: 'Обмен карт',
  };
  return map[phase] ?? '';
}

function actionLabel(action) {
  const map = {
    income: 'доход',
    foreign_aid: 'иностранную помощь',
    coup: 'переворот',
    tax: 'налог',
    assassinate: 'убийство',
    steal: 'кражу',
    exchange: 'обмен',
  };
  return map[action] ?? action;
}
