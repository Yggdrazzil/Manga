import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Comic, ComicEntry, ReadingStatus } from '../types';

interface ComicsState {
  entries: ComicEntry[];
  addEntry: (comic: Comic, status: ReadingStatus) => void;
  removeEntry: (comicId: string) => void;
  updateStatus: (comicId: string, status: ReadingStatus) => void;
  toggleVolumeRead: (comicId: string, volumeNum: number) => void;
  setTotalVolumes: (comicId: string, total: number) => void;
  getEntry: (comicId: string) => ComicEntry | undefined;
}

export const useComicsStore = create<ComicsState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (comic, status) => {
        if (get().getEntry(comic.id)) return;
        const entry: ComicEntry = {
          comicId: comic.id,
          status,
          readVolumes: [],
          totalVolumes: comic.totalVolumes,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          comic,
        };
        set(state => ({ entries: [entry, ...state.entries] }));
      },

      removeEntry: (comicId) => {
        set(state => ({ entries: state.entries.filter(e => e.comicId !== comicId) }));
      },

      updateStatus: (comicId, status) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.comicId === comicId
              ? { ...e, status, updatedAt: new Date().toISOString() }
              : e
          ),
        }));
      },

      toggleVolumeRead: (comicId, volumeNum) => {
        set(state => ({
          entries: state.entries.map(e => {
            if (e.comicId !== comicId) return e;
            const read = e.readVolumes.includes(volumeNum);
            const readVolumes = read
              ? e.readVolumes.filter(v => v !== volumeNum)
              : [...e.readVolumes, volumeNum].sort((a, b) => a - b);
            return { ...e, readVolumes, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      setTotalVolumes: (comicId, total) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.comicId === comicId
              ? { ...e, totalVolumes: total, updatedAt: new Date().toISOString() }
              : e
          ),
        }));
      },

      getEntry: (comicId) => get().entries.find(e => e.comicId === comicId),
    }),
    {
      name: 'comics-library',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
