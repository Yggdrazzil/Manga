import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LibraryEntry, Manga, ReadingStatus, ReadingStats } from '../types';

interface LibraryState {
  entries: LibraryEntry[];
  addEntry: (manga: Manga, status: ReadingStatus) => void;
  updateProgress: (mangaId: string, source: string, progress: number) => void;
  updateStatus: (mangaId: string, source: string, status: ReadingStatus) => void;
  updateScore: (mangaId: string, source: string, score: number) => void;
  updateEntry: (mangaId: string, source: string, updates: Partial<Omit<LibraryEntry, 'mangaId' | 'source' | 'manga'>>) => void;
  removeEntry: (mangaId: string, source: string) => void;
  getEntry: (mangaId: string, source: string) => LibraryEntry | undefined;
  entriesByStatus: (status: ReadingStatus) => LibraryEntry[];
  getStats: () => ReadingStats;
  toggleChapterRead: (mangaId: string, source: string, chapterId: string, chapterNum: number) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (manga, status) => {
        const existing = get().getEntry(manga.id, manga.source);
        if (existing) return;
        const entry: LibraryEntry = {
          mangaId: manga.id,
          source: manga.source,
          status,
          progress: 0,
          updatedAt: new Date().toISOString(),
          manga,
        };
        set(state => ({ entries: [entry, ...state.entries] }));
      },

      updateProgress: (mangaId, source, progress) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.mangaId === mangaId && e.source === source
              ? { ...e, progress, updatedAt: new Date().toISOString() }
              : e
          ),
        }));
      },

      updateStatus: (mangaId, source, status) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.mangaId === mangaId && e.source === source
              ? {
                  ...e,
                  status,
                  updatedAt: new Date().toISOString(),
                  ...(status === 'READING' && !e.startDate ? { startDate: new Date().toISOString() } : {}),
                  ...(status === 'COMPLETED' ? { finishDate: new Date().toISOString() } : {}),
                }
              : e
          ),
        }));
      },

      updateScore: (mangaId, source, score) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.mangaId === mangaId && e.source === source
              ? { ...e, score, updatedAt: new Date().toISOString() }
              : e
          ),
        }));
      },

      updateEntry: (mangaId, source, updates) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.mangaId === mangaId && e.source === source
              ? { ...e, ...updates, updatedAt: new Date().toISOString() }
              : e
          ),
        }));
      },

      removeEntry: (mangaId, source) => {
        set(state => ({
          entries: state.entries.filter(e => !(e.mangaId === mangaId && e.source === source)),
        }));
      },

      getEntry: (mangaId, source) => {
        return get().entries.find(e => e.mangaId === mangaId && e.source === source);
      },

      toggleChapterRead: (mangaId, source, chapterId, chapterNum) => {
        set(state => ({
          entries: state.entries.map(e => {
            if (e.mangaId !== mangaId || e.source !== source) return e;
            const ids = e.readChapterIds ?? [];
            const isRead = ids.includes(chapterId);
            const newIds = isRead ? ids.filter(id => id !== chapterId) : [...ids, chapterId];
            const newProgress = isRead ? e.progress : Math.max(e.progress, Math.floor(chapterNum));
            return { ...e, readChapterIds: newIds, progress: newProgress, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      entriesByStatus: (status) => {
        return get().entries
          .filter(e => e.status === status)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      },

      getStats: () => {
        const entries = get().entries;
        const byStatus = {
          READING: 0,
          COMPLETED: 0,
          PLAN_TO_READ: 0,
          DROPPED: 0,
          PAUSED: 0,
        } as Record<ReadingStatus, number>;

        let chaptersRead = 0;
        let volumesRead = 0;
        let totalScored = 0;
        let scoreSum = 0;
        const genreCount: Record<string, number> = {};

        for (const entry of entries) {
          byStatus[entry.status]++;
          chaptersRead += entry.progress;
          volumesRead += entry.progressVolumes ?? 0;
          if (entry.score) {
            scoreSum += entry.score;
            totalScored++;
          }
          for (const genre of entry.manga.genres) {
            genreCount[genre] = (genreCount[genre] ?? 0) + 1;
          }
        }

        const topGenres = Object.entries(genreCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([genre, count]) => ({ genre, count }));

        return {
          totalEntries: entries.length,
          chaptersRead,
          volumesRead,
          byStatus,
          topGenres,
          averageScore: totalScored > 0 ? scoreSum / totalScored : 0,
        };
      },
    }),
    {
      name: 'manga-library',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
