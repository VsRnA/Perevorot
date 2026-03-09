const ACTION_LABELS = {
  income: 'взял доход',
  foreign_aid: 'запросил иностранную помощь',
  coup: 'провёл переворот против',
  tax: 'собрал налог',
  assassinate: 'атаковал',
  steal: 'украл у',
  exchange: 'обменял карты',
};

export function GameLog({ log }) {
  return (
    <div className="card p-3 h-40 overflow-y-auto flex flex-col gap-1.5">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Лог событий</p>
      {log.length === 0 && <p className="text-gray-700 text-xs">Игра начинается...</p>}
      {[...log].reverse().map((entry, i) => (
        <p key={i} className="text-xs text-gray-400">
          {entry.message}
        </p>
      ))}
    </div>
  );
}
