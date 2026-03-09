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

const ACTION_LABELS_RU = {
  tax: 'налог',
  assassinate: 'убийство',
  steal: 'кражу',
  exchange: 'обмен карт',
};

// ─── Докуп ────────────────────────────────────────────────────────────────────
// При потере первой карты (осталась 1 живая) — 5 монет
// При потере последней карты (выбыл) — 3 монеты
// Максимум 2 раза за игру на игрока

const BUYBACK_COST_FIRST = 5; // потерял первую, осталась одна
const BUYBACK_COST_LAST  = 3; // потерял последнюю, выбыл
const BUYBACK_MAX = 2;

function buybackCost(player) {
  const alive = player.cards.filter((c) => !c.revealed).length;
  return alive === 0 ? BUYBACK_COST_LAST : BUYBACK_COST_FIRST;
}

function canBuyback(player) {
  const used = player.buybacksUsed ?? 0;
  if (used >= BUYBACK_MAX) return false;
  return player.coins >= buybackCost(player);
}

// Переходим в фазу докупа; continuation = 'next_turn' | 'resolve_action'
// prevPendingAction нужен если continuation = 'resolve_action'
function enterBuybackPhase(state, player, continuation, prevPendingAction = null) {
  const cost = buybackCost(player);
  addLog(state, `@${player.username} может докупить карту за ${cost} монет`);
  state.pendingAction = {
    action: 'buyback',
    loserId: player.userId,
    buybackCost: cost,
    continuation,
    prevPendingAction,
  };
  state.phase = 'buyback';
  return { resolved: false };
}

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
// players: [{ id, username }]

export function initGame(players) {
  const deck = buildDeck();
  const statePlayers = players.map(({ id: userId, username }, index) => ({
    userId,
    username,
    coins: 2,
    cards: [
      { role: deck.pop(), revealed: false },
      { role: deck.pop(), revealed: false },
    ],
    isEliminated: false,
    buybacksUsed: 0,
    turnOrder: index,
  }));

  return {
    deck,
    players: statePlayers,
    currentPlayerId: players[0].id,
    phase: 'action', // action | block | challenge_action | challenge_block | lose_card | exchange | buyback
    pendingAction: null,
    log: [],
  };
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────

export function getActivePlayers(state) {
  return state.players.filter((p) => !p.isEliminated);
}

export function getCurrentPlayer(state) {
  return state.players.find((p) => p.userId === state.currentPlayerId);
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
  const currentIdx = active.findIndex((p) => p.userId === state.currentPlayerId);
  const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % active.length;
  state.currentPlayerId = active[nextIdx].userId;
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

  const current = getCurrentPlayer(state);
  if (current.userId !== actorId) throw new Error('Not your turn');
  if (state.phase !== 'action') throw new Error('Wrong phase');

  if (actor.coins >= 10 && action !== 'coup') {
    throw new Error('You must coup when you have 10+ coins');
  }

  switch (action) {
    case 'income':
      actor.coins += 1;
      addLog(state, `@${actor.username} взял доход (+1 монета)`);
      nextTurn(state);
      return { resolved: true };

    case 'foreign_aid':
      state.pendingAction = { action, actorId, targetId: null, passedBy: [] };
      state.phase = 'block';
      addLog(state, `@${actor.username} запрашивает иностранную помощь`);
      return { resolved: false };

    case 'coup':
      if (actor.coins < 7) throw new Error('Not enough coins');
      if (!target) throw new Error('Target required');
      actor.coins -= 7;
      state.pendingAction = { action, actorId, targetId };
      state.phase = 'lose_card';
      addLog(state, `@${actor.username} проводит переворот против @${target.username}`);
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

      state.pendingAction = { action, actorId, targetId, passedBy: [] };
      state.phase = 'challenge_action';
      addLog(state, `@${actor.username} заявляет ${ACTION_LABELS_RU[action] ?? action}${target ? ` против @${target.username}` : ''}`);
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

  const challenger = state.players.find((p) => p.userId === challengerId);
  if (!challenger || challenger.isEliminated) throw new Error('Eliminated players cannot act');

  const { action, actorId, blockerId, targetId } = state.pendingAction;
  const isBlockChallenge = state.phase === 'challenge_block';
  const defenderId = isBlockChallenge ? blockerId : actorId;

  if (challengerId === defenderId) throw new Error('Cannot challenge yourself');

  // Для steal/assassinate в фазе challenge_action оспорить может только цель
  if (state.phase === 'challenge_action' && (action === 'steal' || action === 'assassinate')) {
    if (challengerId !== targetId) throw new Error('Only the target can challenge this action');
  }

  const requiredRole = isBlockChallenge
    ? BLOCKS[action]?.find((r) => playerHasRole(state.players.find((p) => p.userId === defenderId), r))
    : ACTION_ROLE[action];

  const defender = state.players.find((p) => p.userId === defenderId);

  if (defender && requiredRole && playerHasRole(defender, requiredRole)) {
    // Challenger LOSES — защитник показывает карту и берёт новую из колоды
    revealCard(defender, requiredRole);
    defender.cards.push({ role: state.deck.pop(), revealed: false });
    loseRandomCard(challenger);
    checkElimination(challenger);
    addLog(state, `@${challenger.username} оспорил и проиграл — @${defender.username} имел нужную карту`);

    if (canBuyback(challenger)) {
      // continuation: block challenge → next_turn; action challenge → resolve_action
      const saved = { ...state.pendingAction };
      return enterBuybackPhase(
        state, challenger,
        isBlockChallenge ? 'next_turn' : 'resolve_action',
        isBlockChallenge ? null : saved,
      );
    }

    if (isBlockChallenge) {
      nextTurn(state);
    } else {
      return resolveAction(state);
    }
  } else {
    // Defender BLUFFING — challenger wins
    if (defender) {
      loseRandomCard(defender);
      checkElimination(defender);
    }
    addLog(state, `@${challenger.username} оспорил и выиграл — @${defender?.username} блефовал`);

    if (canBuyback(defender)) {
      const saved = { ...state.pendingAction };
      return enterBuybackPhase(
        state, defender,
        isBlockChallenge ? 'resolve_action' : 'next_turn',
        isBlockChallenge ? saved : null,
      );
    }

    if (isBlockChallenge) {
      return resolveAction(state);
    } else {
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

  const blocker = state.players.find((p) => p.userId === blockerId);
  if (!blocker || blocker.isEliminated) throw new Error('Eliminated players cannot act');

  const { action, actorId, targetId } = state.pendingAction;

  if (blockerId === actorId) throw new Error('Cannot block your own action');
  if (!BLOCKS[action]) throw new Error('This action cannot be blocked');
  if ((action === 'steal' || action === 'assassinate') && blockerId !== targetId) {
    throw new Error('Only the target can block this action');
  }

  state.pendingAction.blockerId = blockerId;
  state.pendingAction.passedBy = [];
  state.phase = 'challenge_block';
  addLog(state, `@${blocker.username} блокирует действие`);
  return { resolved: false };
}

// ─── Пропуск — консенсус всех игроков ────────────────────────────────────────

export function applyPass(state, { passerId }) {
  if (
    state.phase !== 'block' &&
    state.phase !== 'challenge_action' &&
    state.phase !== 'challenge_block'
  ) {
    throw new Error('Wrong phase');
  }

  const passer = state.players.find((p) => p.userId === passerId);
  if (!passer || passer.isEliminated) throw new Error('Eliminated players cannot act');

  const { blockerId } = state.pendingAction;
  if (!state.pendingAction.passedBy) state.pendingAction.passedBy = [];

  if (!state.pendingAction.passedBy.includes(passerId)) {
    state.pendingAction.passedBy.push(passerId);
  }

  const active = getActivePlayers(state);

  if (state.phase === 'block' || state.phase === 'challenge_action') {
    const { action: act, actorId: aId, targetId: tId } = state.pendingAction;
    const isTargetedAction = act === 'steal' || act === 'assassinate';

    // Для steal/assassinate в challenge_action достаточно пропуска только цели.
    // Для остальных (tax, exchange, foreign_aid) — все кроме актора.
    const mustPass = (state.phase === 'challenge_action' && isTargetedAction)
      ? active.filter((p) => p.userId === tId)
      : active.filter((p) => p.userId !== aId);

    if (mustPass.every((p) => state.pendingAction.passedBy.includes(p.userId))) {
      return resolveAction(state);
    }
    return { resolved: false };
  }

  if (state.phase === 'challenge_block') {
    const mustPass = active.filter((p) => p.userId !== blockerId);
    if (mustPass.every((p) => state.pendingAction.passedBy.includes(p.userId))) {
      nextTurn(state);
      return { resolved: true };
    }
    return { resolved: false };
  }
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
  addLog(state, `@${loser.username} потерял карту${loser.isEliminated ? ' и выбыл из игры' : ''}`);

  // Предлагаем докуп если игрок может себе позволить
  if (canBuyback(loser)) {
    return enterBuybackPhase(state, loser, 'next_turn');
  }

  nextTurn(state);
  return { resolved: true };
}

// ─── Докуп карты ─────────────────────────────────────────────────────────────

export function applyBuyback(state, { playerId, accept }) {
  if (state.phase !== 'buyback') throw new Error('Wrong phase');

  const { loserId, buybackCost: cost, continuation, prevPendingAction } = state.pendingAction;
  if (playerId !== loserId) throw new Error('Not your decision');

  const player = state.players.find((p) => p.userId === playerId);

  if (accept) {
    if (player.coins < cost) throw new Error('Not enough coins');
    player.coins -= cost;
    player.cards.push({ role: state.deck.pop(), revealed: false });
    player.isEliminated = false; // снимаем выбывание если выкупил последнюю карту
    player.buybacksUsed = (player.buybacksUsed ?? 0) + 1;
    addLog(state, `@${player.username} докупил карту за ${cost} монет`);
  } else {
    addLog(state, `@${player.username} отказался от докупа`);
  }

  if (continuation === 'resolve_action') {
    state.pendingAction = prevPendingAction; // восстанавливаем для resolveAction
    return resolveAction(state);
  }

  // continuation === 'next_turn' (или undefined — из applyLoseCard)
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
  // Колода хранит строки (role), возвращаем роли, не объекты
  state.deck.push(...returned.map((c) => c.role));
  state.deck = shuffle(state.deck);
  addLog(state, `@${actor.username} обменял карты`);
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
      addLog(state, `@${actor.username} получил иностранную помощь (+2 монеты)`);
      nextTurn(state);
      break;

    case 'tax':
      actor.coins += 3;
      addLog(state, `@${actor.username} собрал налог (+3 монеты)`);
      nextTurn(state);
      break;

    case 'assassinate':
      state.phase = 'lose_card';
      return { resolved: false };

    case 'steal': {
      const stolen = Math.min(2, target.coins);
      target.coins -= stolen;
      actor.coins += stolen;
      addLog(state, `@${actor.username} украл ${stolen} монет у @${target.username}`);
      nextTurn(state);
      break;
    }

    case 'exchange': {
      const drawn = [
        { role: state.deck.pop(), revealed: false },
        { role: state.deck.pop(), revealed: false },
      ];
      state.pendingAction.drawnCards = drawn;
      state.phase = 'exchange';
      return { resolved: false };
    }
  }

  return { resolved: true };
}
