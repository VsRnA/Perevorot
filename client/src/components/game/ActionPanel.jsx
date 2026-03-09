import { useState } from 'react';
import { getSocket } from '../../socket/socket';

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

const ACTIONS = [
  { id: 'income', label: 'Доход', desc: '+1 монета', needsTarget: false, role: null, cost: 0 },
  { id: 'foreign_aid', label: 'Иностр. помощь', desc: '+2 монеты', needsTarget: false, role: null, cost: 0 },
  { id: 'coup', label: 'Переворот', desc: '-7 монет, устранить', needsTarget: true, role: null, cost: 7 },
  { id: 'tax', label: 'Налог', desc: '+3 монеты (Герцог)', needsTarget: false, role: 'duke', cost: 0 },
  { id: 'assassinate', label: 'Убийство', desc: '-3 монеты (Убийца)', needsTarget: true, role: 'assassin', cost: 3 },
  { id: 'steal', label: 'Кража', desc: '+2 монеты цели (Капитан)', needsTarget: true, role: 'captain', cost: 0 },
  { id: 'exchange', label: 'Обмен', desc: 'Сменить карты (Посол)', needsTarget: false, role: 'ambassador', cost: 0 },
];

function findUsername(players, userId) {
  return players.find((p) => p.userId === userId)?.username ?? '?';
}

export function ActionPanel({ gameId, myPlayer, players, phase, pendingAction, myUserId, currentPlayerId }) {
  const socket = getSocket();
  const isMyTurn = myPlayer && myUserId === currentPlayerId;
  const [selectingTarget, setSelectingTarget] = useState(null);

  function sendAction(action, targetId = null) {
    socket.emit('game:action', { gameId, action, targetId });
    setSelectingTarget(null);
  }

  function handleActionClick(action) {
    if (action.needsTarget) {
      setSelectingTarget(action.id);
    } else {
      sendAction(action.id);
    }
  }

  function handleTarget(targetUserId) {
    sendAction(selectingTarget, targetUserId);
  }

  function challenge() { socket.emit('game:challenge', { gameId }); }
  function block() { socket.emit('game:block', { gameId }); }
  function pass() { socket.emit('game:pass', { gameId }); }

  const isActor = pendingAction?.actorId === myUserId;
  const isTarget = pendingAction?.targetId === myUserId;
  const opponents = players.filter((p) => p.userId !== myUserId && !p.isEliminated);

  // Фаза: выбор цели
  if (selectingTarget) {
    return (
      <div className="card p-4">
        <p className="text-gray-400 text-sm mb-3">Выбери цель:</p>
        <div className="flex flex-wrap gap-2">
          {opponents.map((p) => (
            <button key={p.userId} onClick={() => handleTarget(p.userId)} className="btn-danger">
              @{p.username}
            </button>
          ))}
          <button onClick={() => setSelectingTarget(null)} className="btn-ghost">Отмена</button>
        </div>
      </div>
    );
  }

  // Фаза: потеря карты
  if (phase === 'lose_card' && isTarget) {
    return (
      <div className="card p-4">
        <p className="text-amber-400 font-semibold mb-3">Выбери карту для потери:</p>
        <div className="flex gap-3">
          {myPlayer.cards.map((card, i) =>
            !card.revealed ? (
              <button
                key={i}
                onClick={() => socket.emit('game:lose_card', { gameId, cardIndex: i })}
                className="btn-danger"
              >
                Потерять карту {i + 1}
              </button>
            ) : null
          )}
        </div>
      </div>
    );
  }

  // Фаза: обмен карт
  if (phase === 'exchange' && isActor) {
    return (
      <div className="card p-4">
        <p className="text-amber-400 font-semibold mb-3">Обмен реализуется после выбора карт...</p>
      </div>
    );
  }

  // Фаза: блок / оспаривание
  const shouldShowReaction =
    ((phase === 'block' || phase === 'challenge_action') && !isActor) ||
    (phase === 'challenge_block' && isActor);

  if (shouldShowReaction) {
    const canBlock = phase === 'block' || phase === 'challenge_action';
    const canChallenge = phase === 'challenge_action' || phase === 'challenge_block';
    const action = pendingAction?.action;

    return (
      <div className="card p-4">
        <p className="text-gray-400 text-sm mb-3">
          {phase === 'challenge_block'
            ? <>
                <span className="text-blue-300 font-semibold">@{findUsername(players, pendingAction?.blockerId)}</span>
                {' '}блокирует твоё действие «{actionLabel(action)}». Оспорить блок?
              </>
            : <>
                <span className="text-amber-400 font-semibold">@{findUsername(players, pendingAction?.actorId)}</span>
                {' '}заявляет «{actionLabel(action)}». Ваш ответ:
              </>
          }
        </p>
        <div className="flex flex-wrap gap-2">
          {canChallenge && (
            <button onClick={challenge} className="btn-danger">⚔️ Оспорить</button>
          )}
          {canBlock && phase !== 'challenge_block' && (
            <button onClick={block} className="btn-outline">🛡️ Заблокировать</button>
          )}
          <button onClick={pass} className="btn-ghost">✓ Пропустить</button>
        </div>
      </div>
    );
  }

  // Фаза: мой ход
  if (phase === 'action' && isMyTurn) {
    const coins = myPlayer.coins;
    const mustCoup = coins >= 10;

    return (
      <div className="card p-4">
        <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3">Твой ход</p>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((action) => {
            const disabled = mustCoup && action.id !== 'coup'
              || (action.cost > 0 && coins < action.cost)
              || (action.id === 'coup' && coins < 7);

            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                disabled={disabled}
                className={`btn-ghost flex flex-col items-start px-3 py-2 text-left ${action.id === 'coup' ? 'border border-red-700' : ''}`}
                title={action.desc}
              >
                <span className="text-sm font-semibold">{action.label}</span>
                <span className="text-xs text-gray-500">{action.desc}</span>
              </button>
            );
          })}
        </div>
        {mustCoup && (
          <p className="text-amber-400 text-xs mt-2">⚠️ 10+ монет — обязателен переворот</p>
        )}
      </div>
    );
  }

  return (
    <div className="card p-4 text-center text-gray-600 text-sm">
      Ожидание хода...
    </div>
  );
}
