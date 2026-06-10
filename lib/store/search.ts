import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_RECENT = 10;

interface SearchState {
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    set => ({
      recentSearches: [],

      addRecentSearch: query => {
        const q = query.trim();
        if (q.length < 2) return;
        set(state => {
          const without = state.recentSearches.filter(
            s => s.toLowerCase() !== q.toLowerCase(),
          );
          return { recentSearches: [q, ...without].slice(0, MAX_RECENT) };
        });
      },

      removeRecentSearch: query => {
        set(state => ({
          recentSearches: state.recentSearches.filter(s => s !== query),
        }));
      },

      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: 'search-history',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
