import { create } from 'zustand';
import api from '../api/axios';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  // Если токен есть — ждём результата fetchMe прежде чем рендерить защищённые маршруты
  loading: !!localStorage.getItem('token'),

  login: async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token, loading: false });
  },

  register: async (username, password) => {
    const { data } = await api.post('/auth/register', { username, password });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token, loading: false });
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, loading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, loading: false });
  },
}));
