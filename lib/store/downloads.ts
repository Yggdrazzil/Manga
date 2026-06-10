import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DownloadedChapter {
  chapterId: string;
  source: 'mangadex' | 'comick';
  mangaTitle: string;
  chapter: string;
  title?: string;
  pageFiles: string[];    // filenames relative to the chapter dir — never absolute
                          // URIs, the iOS container path changes between updates
  sizeBytes: number;
  downloadedAt: string;
}

interface DownloadsState {
  downloads: Record<string, DownloadedChapter>;
  progress: Record<string, number>; // chapterId → 0..1, ephemeral (not persisted)
  setProgress: (chapterId: string, value: number | null) => void;
  addDownload: (d: DownloadedChapter) => void;
  removeDownload: (chapterId: string) => void;
  clearAll: () => void;
}

export const useDownloadsStore = create<DownloadsState>()(
  persist(
    set => ({
      downloads: {},
      progress: {},

      setProgress: (chapterId, value) => {
        set(state => {
          const progress = { ...state.progress };
          if (value == null) delete progress[chapterId];
          else progress[chapterId] = value;
          return { progress };
        });
      },

      addDownload: d => {
        set(state => ({ downloads: { ...state.downloads, [d.chapterId]: d } }));
      },

      removeDownload: chapterId => {
        set(state => {
          const downloads = { ...state.downloads };
          delete downloads[chapterId];
          return { downloads };
        });
      },

      clearAll: () => set({ downloads: {} }),
    }),
    {
      name: 'chapter-downloads',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ downloads: state.downloads }),
    },
  ),
);
