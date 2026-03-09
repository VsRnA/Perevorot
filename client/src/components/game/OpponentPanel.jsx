import { GameCard } from './PlayerCard';

export function OpponentPanel({ player, isCurrentTurn, onTarget, isTargetable }) {
  return (
    <div
      className={`
        card p-3 flex flex-col items-center gap-2 transition-all
        ${isCurrentTurn ? 'border-amber-500 shadow-lg shadow-amber-500/20' : ''}
        ${player.isEliminated ? 'opacity-40' : ''}
      `}
    >
      {/* Avatar */}
      <div className="relative">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
          ${isCurrentTurn ? 'bg-amber-500 text-gray-950' : 'bg-gray-700 text-amber-400'}`}>
          {player.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        {isCurrentTurn && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
        )}
      </div>

      <span className="text-xs text-gray-300 font-medium truncate max-w-20">@{player.username}</span>

      {/* Coins */}
      <div className="flex items-center gap-1">
        <span className="text-amber-400 text-xs">💰</span>
        <span className="text-amber-400 font-bold text-sm">{player.coins}</span>
      </div>

      {/* Cards */}
      <div className="flex gap-1">
        {player.cards.map((card, i) => (
          <GameCard key={i} role={card.role} revealed={card.revealed} />
        ))}
      </div>

      {/* Target button */}
      {isTargetable && !player.isEliminated && (
        <button onClick={() => onTarget(player.userId)} className="btn-danger text-xs px-2 py-1 w-full">
          Выбрать
        </button>
      )}
    </div>
  );
}
