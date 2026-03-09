import { useState, useEffect } from 'react';
import { getSocket } from '../../socket/socket';
import { OpponentPanel } from './OpponentPanel';
import { GameCard } from './PlayerCard';

const ACTIONS = [
  { id: 'income',       label: 'Доход',           desc: '+1 монета',                  needsTarget: false, cost: 0 },
  { id: 'foreign_aid',  label: 'Иностр. помощь',  desc: '+2 монеты',                  needsTarget: false, cost: 0 },
  { id: 'coup',         label: 'Переворот',        desc: '-7 монет, устранить',        needsTarget: true,  cost: 7 },
  { id: 'tax',          label: 'Налог',            desc: '+3 монеты (Герцог)',          needsTarget: false, cost: 0 },
  { id: 'assassinate',  label: 'Убийство',         desc: '-3 монеты (Убийца)',          needsTarget: true,  cost: 3 },
  { id: 'steal',        label: 'Кража',            desc: '+2 монеты цели (Капитан)',    needsTarget: true,  cost: 0 },
  { id: 'exchange',     label: 'Обмен',            desc: 'Сменить карты (Посол)',       needsTarget: false, cost: 0 },
];

function findUsername(players, userId) {
  return players.find((p) => p.userId === userId)?.username ?? '?';
}

export function ActionPanel({ gameId, myPlayer, players, phase, pendingAction, myUserId, currentPlayerId }) {
  const socket = getSocket();
  const isMyTurn = myPlayer && myUserId === currentPlayerId;
  const [selectingTarget, setSelectingTarget] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState([]);

  // Сбрасываем выбор при смене фазы
  useEffect(() => {
    setSelectedIndices([]);
  }, [phase]);

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

  function challenge() { socket.emit('game:challenge', { gameId }); }
  function block()     { socket.emit('game:block',     { gameId }); }
  function pass()      { socket.emit('game:pass',      { gameId }); }

  const isActor  = pendingAction?.actorId  === myUserId;
  const isTarget = pendingAction?.targetId === myUserId;
  const opponents = players.filter((p) => p.userId !== myUserId && !p.isEliminated);

  // ── Выбор цели ──────────────────────────────────────────────────────────────
  if (selectingTarget) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-400 text-sm font-semibold">Выбери цель:</p>
          <button onClick={() => setSelectingTarget(null)} className="btn-ghost text-xs px-2 py-1">
            Отмена
          </button>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {opponents.map((p) => (
            <OpponentPanel
              key={p.userId}
              player={p}
              isCurrentTurn={false}
              isTargetable
              onTarget={(id) => sendAction(selectingTarget, id)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Потеря карты ─────────────────────────────────────────────────────────────
  if (phase === 'lose_card' && isTarget) {
    return (
      <div className="card p-4">
        <p className="text-amber-400 font-semibold mb-3">Выбери карту для потери:</p>
        <div className="flex gap-3 flex-wrap">
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

  // ── Докуп карты ──────────────────────────────────────────────────────────────
  if (phase === 'buyback' && pendingAction?.loserId === myUserId) {
    const cost = pendingAction.buybackCost;
    const canAfford = myPlayer.coins >= cost;

    return (
      <div className="card p-4 border border-amber-600/40">
        <p className="text-amber-400 font-semibold mb-1">Докуп карты</p>
        <p className="text-gray-400 text-sm mb-4">
          Хочешь докупить карту из колоды за{' '}
          <span className="text-amber-400 font-bold">{cost} монет</span>?{' '}
          У тебя сейчас <span className="text-amber-400 font-bold">{myPlayer.coins}</span> монет.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => socket.emit('game:buyback', { gameId, accept: true })}
            disabled={!canAfford}
            className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Докупить за {cost} монет
          </button>
          <button
            onClick={() => socket.emit('game:buyback', { gameId, accept: false })}
            className="btn-ghost flex-1"
          >
            Отказаться
          </button>
        </div>
        {!canAfford && (
          <p className="text-red-400 text-xs mt-2">Недостаточно монет</p>
        )}
      </div>
    );
  }

  if (phase === 'buyback' && pendingAction?.loserId !== myUserId) {
    const loserName = findUsername(players, pendingAction?.loserId);
    return (
      <div className="card p-4 text-center text-gray-600 text-sm">
        @{loserName} решает — докупить карту…
      </div>
    );
  }

  // ── Обмен карт ───────────────────────────────────────────────────────────────
  if (phase === 'exchange' && isActor) {
    const drawnCards = pendingAction?.drawnCards ?? [];
    const aliveCards = myPlayer.cards.filter((c) => !c.revealed);
    const combined = [...aliveCards, ...drawnCards]; // индексы для game:exchange
    const mustKeep = aliveCards.length; // сколько карт нужно оставить

    function toggleIndex(i) {
      setSelectedIndices((prev) =>
        prev.includes(i)
          ? prev.filter((x) => x !== i)
          : prev.length < mustKeep
            ? [...prev, i]
            : prev
      );
    }

    function confirmExchange() {
      socket.emit('game:exchange', { gameId, keptIndices: selectedIndices });
    }

    return (
      <div className="card p-4">
        <p className="text-amber-400 font-semibold mb-1">
          Обмен карт — выбери {mustKeep} {mustKeep === 1 ? 'карту' : 'карты'} для сохранения:
        </p>
        <p className="text-gray-500 text-xs mb-3">
          Выбрано: {selectedIndices.length} / {mustKeep}
        </p>
        <div className="flex flex-wrap gap-3 justify-center mb-4">
          {combined.map((card, i) => {
            const isDrawn = i >= aliveCards.length;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <GameCard
                  role={card.role}
                  revealed={false}
                  selectable
                  selected={selectedIndices.includes(i)}
                  onClick={() => toggleIndex(i)}
                />
                <span className="text-xs text-gray-500">
                  {isDrawn ? 'Новая' : 'Моя'}
                </span>
              </div>
            );
          })}
        </div>
        <button
          onClick={confirmExchange}
          disabled={selectedIndices.length !== mustKeep}
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Подтвердить выбор
        </button>
      </div>
    );
  }

  // ── Блок / оспаривание ───────────────────────────────────────────────────────
  const shouldShowReaction =
    ((phase === 'block' || phase === 'challenge_action') && !isActor) ||
    (phase === 'challenge_block' && isActor);

  if (shouldShowReaction) {
    const canBlock     = (phase === 'block' || phase === 'challenge_action') && !isActor;
    const canChallenge = phase === 'challenge_action' || phase === 'challenge_block';

    return (
      <div className="card p-4">
        <p className="text-gray-400 text-sm mb-3">
          {phase === 'challenge_block' ? (
            <>
              <span className="text-blue-300 font-semibold">
                @{findUsername(players, pendingAction?.blockerId)}
              </span>
              {' '}блокирует твоё действие. Оспорить блок?
            </>
          ) : (
            <>
              <span className="text-amber-400 font-semibold">
                @{findUsername(players, pendingAction?.actorId)}
              </span>
              {' '}заявляет действие. Твой ответ:
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {canChallenge && (
            <button onClick={challenge} className="btn-danger flex-1 min-w-[120px]">
              ⚔️ Оспорить
            </button>
          )}
          {canBlock && (
            <button onClick={block} className="btn-outline flex-1 min-w-[120px]">
              🛡️ Заблокировать
            </button>
          )}
          <button onClick={pass} className="btn-ghost flex-1 min-w-[100px]">
            ✓ Пропустить
          </button>
        </div>
      </div>
    );
  }

  // ── Мой ход ──────────────────────────────────────────────────────────────────
  if (phase === 'action' && isMyTurn) {
    const coins = myPlayer.coins;
    const mustCoup = coins >= 10;

    return (
      <div className="card p-4">
        <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Твой ход
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ACTIONS.map((action) => {
            const disabled =
              (mustCoup && action.id !== 'coup') ||
              (action.cost > 0 && coins < action.cost) ||
              (action.id === 'coup' && coins < 7);

            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                disabled={disabled}
                className={`
                  btn-ghost flex flex-col items-start px-3 py-2.5 text-left
                  disabled:opacity-30 disabled:cursor-not-allowed
                  ${action.id === 'coup' ? 'border border-red-700' : ''}
                `}
                title={action.desc}
              >
                <span className="text-sm font-semibold">{action.label}</span>
                <span className="text-xs text-gray-500">{action.desc}</span>
              </button>
            );
          })}
        </div>
        {mustCoup && (
          <p className="text-amber-400 text-xs mt-3">
            ⚠️ 10+ монет — обязателен переворот
          </p>
        )}
      </div>
    );
  }

  // ── Ожидание ─────────────────────────────────────────────────────────────────
  return (
    <div className="card p-4 text-center text-gray-600 text-sm">
      {phase === 'action'
        ? `Ход @${findUsername(players, currentPlayerId)}…`
        : 'Ожидание…'}
    </div>
  );
}
