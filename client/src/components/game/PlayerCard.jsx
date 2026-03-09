const ROLE_LABELS = {
  duke: 'Герцог',
  assassin: 'Убийца',
  captain: 'Капитан',
  ambassador: 'Посол',
  contessa: 'Контесса',
  hidden: '?',
};

const ROLE_COLORS = {
  duke: 'from-purple-900 to-purple-700 border-purple-500',
  assassin: 'from-red-900 to-red-700 border-red-500',
  captain: 'from-blue-900 to-blue-700 border-blue-500',
  ambassador: 'from-green-900 to-green-700 border-green-500',
  contessa: 'from-pink-900 to-pink-700 border-pink-500',
  hidden: 'from-gray-800 to-gray-700 border-gray-600',
};

export function GameCard({ role, revealed, selectable, selected, onClick }) {
  const colorClass = revealed ? 'from-gray-900 to-gray-800 border-gray-700 opacity-40' : ROLE_COLORS[role] || ROLE_COLORS.hidden;

  return (
    <button
      onClick={onClick}
      disabled={!selectable}
      className={`
        relative w-20 h-28 rounded-xl border-2 bg-gradient-to-b flex flex-col items-center justify-center
        transition-all duration-200
        ${colorClass}
        ${selectable ? 'cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-amber-500/20' : 'cursor-default'}
        ${selected ? 'ring-2 ring-amber-400 scale-105' : ''}
      `}
    >
      <span className="text-2xl mb-1">
        {revealed ? '💀' : role === 'hidden' ? '🂠' : roleEmoji(role)}
      </span>
      <span className="text-xs font-semibold text-center px-1">
        {revealed ? 'Раскрыта' : ROLE_LABELS[role]}
      </span>
    </button>
  );
}

function roleEmoji(role) {
  const map = { duke: '👑', assassin: '🗡️', captain: '⚓', ambassador: '🤝', contessa: '💎' };
  return map[role] || '🂠';
}
