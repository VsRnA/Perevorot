import { create } from 'zustand';

export const useGameStore = create((set) => ({
  gameId: null,
  phase: null,
  currentPlayerIndex: null,
  pendingAction: null,
  players: [],
  log: [],
  winner: null,

  setGameState: (state) => set({ ...state }),
  setGameId: (gameId) => set({ gameId }),
  setWinner: (winnerId) => set({ winner: winnerId }),
  reset: () => set({
    gameId: null, phase: null, currentPlayerIndex: null,
    pendingAction: null, players: [], log: [], winner: null,
  }),
}));
