import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserInfo = {
  id: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
};

type AppState = {
  serverUrl: string | null;
  token: string | null;
  user: UserInfo | null;
  hydrated: boolean;
  setServerUrl: (url: string) => void;
  setAuth: (token: string, user: UserInfo) => void;
  logout: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      serverUrl: null,
      token: null,
      user: null,
      hydrated: false,
      setServerUrl: (url) => set({ serverUrl: url.replace(/\/+$/, '') }),
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'serietime-app',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ serverUrl: s.serverUrl, token: s.token, user: s.user }),
      onRehydrateStorage: () => (state) => {
        useAppStore.setState({ hydrated: true });
      },
    },
  ),
);
