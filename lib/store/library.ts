import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChapterNote, LibraryEntry, Manga, ReadingStatus, ReadingStats } from '../types';
import { maxChapterProgress } from '@/lib/utils/chapter';

interface LibraryState {
  entries: LibraryEntry[];
  avatar?: string;
  banner?: string;
  readingPositions: Record<string, number>; // chapterId → last page (1-based)
  setAvatar: (uri: string) => void;
  setBanner: (uri: string) => void;
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
  markChapterRead: (mangaId: string, source: string, chapterId: string, chapterNumber?: number) => void;
  toggleFavorite: (mangaId: string, source: string) => void;
  updateChapterNote: (mangaId: string, source: string, chapterId: string, note: Partial<ChapterNote>) => void;
  markVolumeRead: (mangaId: string, source: string, chapters: Array<{ id: string; num: number }>) => void;
  unmarkAllRead: (mangaId: string, source: string) => void;
  saveReadingPosition: (chapterId: string, page: number) => void;
  getReadingPosition: (chapterId: string) => number | undefined;
  clearReadingPosition: (chapterId: string) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      entries: [],
      avatar: undefined,
      banner: undefined,
      readingPositions: {},

      setAvatar: (uri) => set({ avatar: uri }),
      setBanner: (uri) => set({ banner: uri }),

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
          entries: state.entries.map(e => {
            if (e.mangaId !== mangaId || e.source !== source) return e;
            const now = new Date().toISOString();
            const enteringCompleted = status === 'COMPLETED' && e.status !== 'COMPLETED';
            const leavingCompleted = status !== 'COMPLETED' && e.status === 'COMPLETED';
            return {
              ...e,
              status,
              updatedAt: now,
              ...(status === 'READING' && !e.startDate ? { startDate: now } : {}),
              ...(enteringCompleted ? { finishDate: now } : {}),
              ...(leavingCompleted ? { finishDate: undefined } : {}),
            };
          }),
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
            const num = Number.isFinite(chapterNum) ? chapterNum : NaN;
            const now = new Date().toISOString();
            const ids = e.readChapterIds ?? [];
            const isRead = ids.includes(chapterId);
            const chapterData = { ...(e.chapterData ?? {}) };
            let newIds: string[];
            let progress = e.progress;

            if (!isRead) {
              newIds = [...ids, chapterId];
              chapterData[chapterId] = {
                ...(chapterData[chapterId] ?? {}),
                readAt: chapterData[chapterId]?.readAt ?? now,
              };
              progress = Number.isFinite(num) ? Math.max(progress, Math.floor(num)) : progress;
            } else {
              newIds = ids.filter(id => id !== chapterId);
              const existing = chapterData[chapterId];
              if (existing) {
                const rest: ChapterNote = { ...existing };
                delete rest.readAt;
                if (Object.keys(rest).length === 0) {
                  delete chapterData[chapterId];
                } else {
                  chapterData[chapterId] = rest;
                }
              }
              if (Number.isFinite(num) && Math.floor(num) <= progress) {
                progress = Math.max(0, Math.floor(num) - 1);
              }
            }

            return { ...e, readChapterIds: newIds, progress, chapterData, updatedAt: now };
          }),
        }));
      },

      markChapterRead: (mangaId, source, chapterId, chapterNumber) => {
        set(state => ({
          entries: state.entries.map(e => {
            if (e.mangaId !== mangaId || e.source !== source) return e;
            const now = new Date().toISOString();
            const ids = e.readChapterIds ?? [];
            const readChapterIds = ids.includes(chapterId) ? ids : [...ids, chapterId];
            const chapterData = {
              ...(e.chapterData ?? {}),
              [chapterId]: {
                ...(e.chapterData?.[chapterId] ?? {}),
                readAt: e.chapterData?.[chapterId]?.readAt ?? now,
              },
            };
            const progress =
              chapterNumber != null && Number.isFinite(chapterNumber)
                ? Math.max(e.progress, Math.floor(chapterNumber))
                : e.progress;

            let status: ReadingStatus = e.status === 'PLAN_TO_READ' ? 'READING' : e.status;
            const total = e.manga.chapters ?? 0;
            if (status === 'READING' && total > 0 && progress >= total && e.manga.status === 'COMPLETED') {
              status = 'COMPLETED';
            }

            return {
              ...e,
              readChapterIds,
              chapterData,
              progress,
              status,
              updatedAt: now,
              ...(status === 'READING' && !e.startDate ? { startDate: now } : {}),
              ...(status === 'COMPLETED' && e.status !== 'COMPLETED' ? { finishDate: now } : {}),
            };
          }),
        }));
      },

      toggleFavorite: (mangaId, source) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.mangaId === mangaId && e.source === source
              ? { ...e, favorite: !e.favorite, updatedAt: new Date().toISOString() }
              : e,
          ),
        }));
      },

      updateChapterNote: (mangaId, source, chapterId, note) => {
        set(state => ({
          entries: state.entries.map(e => {
            if (e.mangaId !== mangaId || e.source !== source) return e;
            const chapterData = { ...(e.chapterData ?? {}), [chapterId]: { ...(e.chapterData?.[chapterId] ?? {}), ...note } };
            return { ...e, chapterData, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      unmarkAllRead: (mangaId, source) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.mangaId === mangaId && e.source === source
              ? { ...e, readChapterIds: [], progress: 0, updatedAt: new Date().toISOString() }
              : e
          ),
        }));
      },

      markVolumeRead: (mangaId, source, chapters) => {
        set(state => ({
          entries: state.entries.map(e => {
            if (e.mangaId !== mangaId || e.source !== source) return e;
            const ids = new Set(e.readChapterIds ?? []);
            const chapterData = { ...(e.chapterData ?? {}) };
            const now = new Date().toISOString();
            let maxProgress = e.progress;
            for (const ch of chapters) {
              ids.add(ch.id);
              chapterData[ch.id] = { ...(chapterData[ch.id] ?? {}), readAt: chapterData[ch.id]?.readAt ?? now };
              maxProgress = maxChapterProgress(maxProgress, String(ch.num));
            }
            return { ...e, readChapterIds: Array.from(ids), chapterData, progress: maxProgress, updatedAt: now };
          }),
        }));
      },

      saveReadingPosition: (chapterId, page) => {
        set(state => ({
          readingPositions: { ...state.readingPositions, [chapterId]: page },
        }));
      },

      getReadingPosition: (chapterId) => {
        return get().readingPositions[chapterId];
      },

      clearReadingPosition: (chapterId) => {
        set(state => {
          const next = { ...state.readingPositions };
          delete next[chapterId];
          return { readingPositions: next };
        });
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
