import { create } from 'zustand';

export const useStore = create((set) => ({
  // Authentication State
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null,
  
  setAuth: (token, user) => {
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ token, user });
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ token: null, user: null });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, activeProjectId: null, activePresence: [] });
  },

  // Active Workspace / Project
  activeProjectId: null,
  setActiveProject: (projectId) => set({ activeProjectId: projectId }),

  // Presence State (Online users list)
  activePresence: [],
  setActivePresence: (presenceList) => set({ activePresence: presenceList }),
}));
