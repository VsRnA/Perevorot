import { GameCard } from './PlayerCard';

export function OpponentPanel({ player, isCurrentTurn, onTarget, isTargetable }) {
  return (
    <div
      className={`
        card p-3 flex flex-col items-center gap-2 transition-all w-32 sm:w-36
        ${isCurrentTurn ? 'border-amber-500 shadow-lg shadow-amber-500/20' : ''}
        ${player.isEliminated ? 'opacity-40' : ''}
      `}
    >
      {/* Avatar */}
      <div className="relative">
        <div className={`
          w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0
          ${isCurrentTurn ? 'bg-amber-500 text-gray-950' : 'bg-gray-700 text-amber-400'}
        `}>
          {player.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        {isCurrentTurn && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
        )}
      </div>

      <span className="text-xs text-gray-300 font-medium truncate w-full text-center">
        @{player.username ?? '?'}
      </span>

      {/* Coins */}
      <div className="flex items-center gap-1">
        <span className="text-amber-400 text-xs">💰</span>
        <span className="text-amber-400 font-bold text-sm">{player.coins}</span>
      </div>

      {/* Cards */}
      <div className="flex gap-1 justify-center">
        {player.cards.map((card, i) => (
          <GameCard key={i} role={card.role} revealed={card.revealed} small />
        ))}
      </div>

      {/* Target button */}
      {isTargetable && !player.isEliminated && (
        <button
          onClick={() => onTarget(player.userId)}
          className="btn-danger text-xs px-2 py-1 w-full mt-1"
        >
          Выбрать
        </button>
      )}
    </div>
  );
}
