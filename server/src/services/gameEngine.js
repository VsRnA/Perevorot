// Роли и их способности
export const ROLES = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];

// Какие роли блокируют какие действия
export const BLOCKS = {
  foreign_aid: ['duke'],
  assassinate: ['contessa'],
  steal: ['captain', 'ambassador'],
};

// Какие роли нужны для действия (null = любой)
export const ACTION_ROLE = {
  income: null,
  foreign_aid: null,
  coup: null,
  tax: 'duke',
  assassinate: 'assassin',
  steal: 'captain',
  exchange: 'ambassador',
};

// ─── Колода ──────────────────────────────────────────────────────────────────

function buildDeck() {
  const deck = [];
  for (const role of ROLES) {
    for (let i = 0; i < 3; i++) deck.push(role);
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Инициализация игры ───────────────────────────────────────────────────────

export function initGame(playerIds) {
  const deck = buildDeck();
  const players = playerIds.map((userId, index) => ({
    userId,
    coins: 2,
    cards: [
      { role: deck.pop(), revealed: false },
      { role: deck.pop(), revealed: false },
    ],
    isEliminated: false,
    turnOrder: index,
  }));

  return {
    deck,
    players,
    currentPlayerIndex: 0,
    phase: 'action', // action | block | challenge_action | challenge_block | lose_card | exchange
    pendingAction: null,
    log: [],
  };
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────

export function getActivePlayers(state) {
  return state.players.filter((p) => !p.isEliminated);
}

export function getCurrentPlayer(state) {
  const active = getActivePlayers(state);
  return active[state.currentPlayerIndex % active.length];
}

function playerHasRole(player, role) {
  return player.cards.some((c) => !c.revealed && c.role === role);
}

function revealCard(player, role) {
  const card = player.cards.find((c) => !c.revealed && c.role === role);
  if (card) card.revealed = true;
}

function loseRandomCard(player) {
  const alive = player.cards.filter((c) => !c.revealed);
  if (alive.length === 0) return;
  alive[Math.floor(Math.random() * alive.length)].revealed = true;
}

function checkElimination(player) {
  player.isEliminated = player.cards.every((c) => c.revealed);
}

function nextTurn(state) {
  const active = getActivePlayers(state);
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % active.length;
  state.phase = 'action';
  state.pendingAction = null;
}

function addLog(state, message) {
  state.log.push({ message, ts: Date.now() });
}

// ─── Проверка победителя ──────────────────────────────────────────────────────

export function checkWinner(state) {
  const alive = getActivePlayers(state);
  if (alive.length === 1) return alive[0].userId;
  return null;
}

// ─── Обработка действий ──────────────────────────────────────────────────────

export function applyAction(state, { actorId, action, targetId }) {
  const actor = state.players.find((p) => p.userId === actorId);
  const target = targetId ? state.players.find((p) => p.userId === targetId) : null;

  // Проверка: ход текущего игрока
  const current = getCurrentPlayer(state);
  if (current.userId !== actorId) throw new Error('Not your turn');
  if (state.phase !== 'action') throw new Error('Wrong phase');

  // Проверка монет для переворота
  if (actor.coins >= 10 && action !== 'coup') {
    throw new Error('You must coup when you have 10+ coins');
  }

  switch (action) {
    case 'income':
      actor.coins += 1;
      addLog(state, `${actorId} took income`);
      nextTurn(state);
      return { resolved: true };

    case 'foreign_aid':
      state.pendingAction = { action, actorId, targetId: null };
      state.phase = 'block';
      addLog(state, `${actorId} claims foreign aid`);
      return { resolved: false };

    case 'coup':
      if (actor.coins < 7) throw new Error('Not enough coins');
      if (!target) throw new Error('Target required');
      actor.coins -= 7;
      state.pendingAction = { action, actorId, targetId };
      state.phase = 'lose_card';
      addLog(state, `${actorId} launched coup on ${targetId}`);
      return { resolved: false };

    case 'tax':
    case 'assassinate':
    case 'steal':
    case 'exchange':
      if (action === 'assassinate') {
        if (actor.coins < 3) throw new Error('Not enough coins');
        if (!target) throw new Error('Target required');
        actor.coins -= 3;
      }
      if (action === 'steal' && !target) throw new Error('Target required');

      state.pendingAction = { action, actorId, targetId };
      state.phase = 'challenge_action';
      addLog(state, `${actorId} claims ${action}`);
      return { resolved: false };

    default:
      throw new Error('Unknown action');
  }
}

// ─── Оспаривание действия ────────────────────────────────────────────────────

export function applyChallenge(state, { challengerId }) {
  if (state.phase !== 'challenge_action' && state.phase !== 'challenge_block') {
    throw new Error('Wrong phase');
  }

  const { action, actorId, blockerId } = state.pendingAction;
  const isBlockChallenge = state.phase === 'challenge_block';

  const defenderId = isBlockChallenge ? blockerId : actorId;
  const requiredRole = isBlockChallenge
    ? BLOCKS[action]?.find((r) => playerHasRole(state.players.find((p) => p.userId === defenderId), r))
    : ACTION_ROLE[action];

  const defender = state.players.find((p) => p.userId === defenderId);
  const challenger = state.players.find((p) => p.userId === challengerId);

  if (defender && requiredRole && playerHasRole(defender, requiredRole)) {
    // Challenger loses — блефовавшего нет, защитник заменяет карту
    revealCard(defender, requiredRole);
    defender.cards.push({ role: state.deck.pop(), revealed: false });
    loseRandomCard(challenger);
    checkElimination(challenger);
    addLog(state, `${challengerId} challenged and lost`);

    if (isBlockChallenge) {
      // Блок устоял — продолжаем как будто было заблокировано
      nextTurn(state);
    } else {
      // Действие подтверждено — выполняем его
      return resolveAction(state);
    }
  } else {
    // Defender was bluffing
    if (defender) {
      loseRandomCard(defender);
      checkElimination(defender);
    }
    addLog(state, `${challengerId} challenged and won`);

    if (isBlockChallenge) {
      // Блок снят — выполняем действие
      return resolveAction(state);
    } else {
      // Действие отменено
      nextTurn(state);
    }
  }

  return { resolved: true };
}

// ─── Блокировка ──────────────────────────────────────────────────────────────

export function applyBlock(state, { blockerId }) {
  if (state.phase !== 'block' && state.phase !== 'challenge_action') {
    throw new Error('Wrong phase');
  }

  state.pendingAction.blockerId = blockerId;
  state.phase = 'challenge_block';
  addLog(state, `${blockerId} blocks`);
  return { resolved: false };
}

// ─── Пропуск (все согласны) ───────────────────────────────────────────────────

export function applyPass(state, { passerId }) {
  // passerId = ID игрока, который пропускает возможность оспорить/заблокировать
  // Логика отслеживания кто пропустил — на уровне socket-handler
  if (state.phase === 'block' || state.phase === 'challenge_action') {
    return resolveAction(state);
  }
  if (state.phase === 'challenge_block') {
    nextTurn(state);
    return { resolved: true };
  }
  throw new Error('Wrong phase');
}

// ─── Потеря карты (coup / assassinate) ───────────────────────────────────────

export function applyLoseCard(state, { loserId, cardIndex }) {
  if (state.phase !== 'lose_card') throw new Error('Wrong phase');

  const loser = state.players.find((p) => p.userId === loserId);
  const { targetId } = state.pendingAction;
  if (loser.userId !== targetId) throw new Error('Not your turn to lose a card');

  const card = loser.cards[cardIndex];
  if (!card || card.revealed) throw new Error('Invalid card');
  card.revealed = true;
  checkElimination(loser);
  addLog(state, `${loserId} lost a card`);
  nextTurn(state);
  return { resolved: true };
}

// ─── Обмен карт (ambassador) ─────────────────────────────────────────────────

export function applyExchange(state, { actorId, keptIndices }) {
  if (state.phase !== 'exchange') throw new Error('Wrong phase');

  const actor = state.players.find((p) => p.userId === actorId);
  const { actorId: pendingActor, drawnCards } = state.pendingAction;
  if (actorId !== pendingActor) throw new Error('Not your turn');

  const aliveCount = actor.cards.filter((c) => !c.revealed).length;
  if (keptIndices.length !== aliveCount) throw new Error('Wrong number of cards');

  const combined = [...actor.cards.filter((c) => !c.revealed), ...drawnCards];
  const kept = keptIndices.map((i) => combined[i]);
  const returned = combined.filter((_, i) => !keptIndices.includes(i));

  actor.cards = [...actor.cards.filter((c) => c.revealed), ...kept];
  state.deck.push(...returned);
  state.deck = shuffle(state.deck);
  addLog(state, `${actorId} exchanged cards`);
  nextTurn(state);
  return { resolved: true };
}

// ─── Выполнение действия ─────────────────────────────────────────────────────

function resolveAction(state) {
  const { action, actorId, targetId } = state.pendingAction;
  const actor = state.players.find((p) => p.userId === actorId);
  const target = targetId ? state.players.find((p) => p.userId === targetId) : null;

  switch (action) {
    case 'foreign_aid':
      actor.coins += 2;
      nextTurn(state);
      break;

    case 'tax':
      actor.coins += 3;
      nextTurn(state);
      break;

    case 'assassinate':
      state.phase = 'lose_card';
      return { resolved: false };

    case 'steal':
      const stolen = Math.min(2, target.coins);
      target.coins -= stolen;
      actor.coins += stolen;
      nextTurn(state);
      break;

    case 'exchange': {
      const drawn = [state.deck.pop(), state.deck.pop()];
      state.pendingAction.drawnCards = drawn;
      state.phase = 'exchange';
      return { resolved: false };
    }
  }

  return { resolved: true };
}
