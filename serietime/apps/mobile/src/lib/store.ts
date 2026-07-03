import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserInfo = {
  id: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  birthYear?: number | null;
  gender?: string | null;
  countryCode?: string;
};

type AppState = {
  serverUrl: string | null;
  token: string | null;
  user: UserInfo | null;
  showsGridMode: boolean;
  moviesGridMode: boolean;
  interestAnswers: Record<string, string>;
  setServerUrl: (url: string) => void;
  setAuth: (token: string, user: UserInfo) => void;
  setUser: (user: UserInfo) => void;
  logout: () => void;
  toggleShowsGrid: () => void;
  toggleMoviesGrid: () => void;
  setInterestAnswer: (mediaId: string, answer: string) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      serverUrl: (import.meta.env.VITE_DEFAULT_SERVER_URL as string | undefined) ?? null,
      token: null,
      user: null,
      showsGridMode: false,
      moviesGridMode: true,
      interestAnswers: {},
      setServerUrl: (url) => set({ serverUrl: url.replace(/\/+$/, '') }),
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      toggleShowsGrid: () => set((s) => ({ showsGridMode: !s.showsGridMode })),
      toggleMoviesGrid: () => set((s) => ({ moviesGridMode: !s.moviesGridMode })),
      setInterestAnswer: (mediaId, answer) =>
        set((s) => ({ interestAnswers: { ...s.interestAnswers, [mediaId]: answer } })),
    }),
    { name: 'serietime-app' },
  ),
);
