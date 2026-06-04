import { create } from 'zustand';

const getStoredAuth = () => {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }

  try {
    return {
      token: localStorage.getItem('token'),
      user: JSON.parse(localStorage.getItem('user') || 'null'),
    };
  } catch (error) {
    return { token: null, user: null };
  }
};

export const useStore = create((set) => ({
  // Authentication State
  token: null,
  user: null,
  isHydrated: false,

  hydrateAuth: () => {
    const { token, user } = getStoredAuth();
    set({ token, user, isHydrated: true });
  },

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
