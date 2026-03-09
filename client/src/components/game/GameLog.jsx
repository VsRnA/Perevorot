export function GameLog({ log }) {
  return (
    <div className="card p-3 h-36 overflow-y-auto flex flex-col-reverse gap-1">
      <div className="flex flex-col gap-1">
        {log.length === 0 && (
          <p className="text-gray-700 text-xs">Игра начинается…</p>
        )}
        {[...log].reverse().map((entry, i) => (
          <p key={i} className={`text-xs ${i === 0 ? 'text-gray-300' : 'text-gray-500'}`}>
            {entry.message}
          </p>
        ))}
      </div>
      <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-1 shrink-0">
        Лог событий
      </p>
    </div>
  );
}
