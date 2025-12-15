import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ConfigState {
  pollInterval: number;
  setPollInterval: (interval: number) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      pollInterval: 5000,
      setPollInterval: (interval) => set({ pollInterval: interval }),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'whalemology-config',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
