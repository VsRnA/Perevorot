import { useState } from 'react';

const CARDS = [
  {
    role: 'duke',
    label: 'Герцог',
    emoji: '👑',
    color: 'border-purple-500 bg-purple-900/30',
    headerColor: 'text-purple-300',
    actions: ['Налог: +3 монеты'],
    blocks: ['Иностранную помощь'],
  },
  {
    role: 'assassin',
    label: 'Убийца',
    emoji: '🗡️',
    color: 'border-red-500 bg-red-900/30',
    headerColor: 'text-red-300',
    actions: ['Убийство: цель теряет карту (-3 монеты)'],
    blocks: [],
  },
  {
    role: 'captain',
    label: 'Капитан',
    emoji: '⚓',
    color: 'border-blue-500 bg-blue-900/30',
    headerColor: 'text-blue-300',
    actions: ['Кража: +2 монеты от цели'],
    blocks: ['Кражу'],
  },
  {
    role: 'ambassador',
    label: 'Посол',
    emoji: '🤝',
    color: 'border-green-500 bg-green-900/30',
    headerColor: 'text-green-300',
    actions: ['Обмен: взять 2 карты из колоды, выбрать'],
    blocks: ['Кражу'],
  },
  {
    role: 'contessa',
    label: 'Контесса',
    emoji: '💎',
    color: 'border-pink-500 bg-pink-900/30',
    headerColor: 'text-pink-300',
    actions: [],
    blocks: ['Убийство'],
  },
];

export function CardReference() {
  const [open, setOpen] = useState(false);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Справочник карт
        </span>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <div key={card.role} className={`rounded-lg border p-3 ${card.color}`}>
              <div className={`flex items-center gap-2 mb-2 font-semibold text-sm ${card.headerColor}`}>
                <span>{card.emoji}</span>
                <span>{card.label}</span>
              </div>
              {card.actions.length > 0 && (
                <div className="mb-1">
                  {card.actions.map((a) => (
                    <p key={a} className="text-xs text-gray-300">⚡ {a}</p>
                  ))}
                </div>
              )}
              {card.blocks.length > 0 && (
                <div>
                  {card.blocks.map((b) => (
                    <p key={b} className="text-xs text-gray-400">🛡️ Блок: {b}</p>
                  ))}
                </div>
              )}
              {card.actions.length === 0 && card.blocks.length === 0 && (
                <p className="text-xs text-gray-600 italic">Только защита</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
