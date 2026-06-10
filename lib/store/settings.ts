import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, DEFAULT_THEME, type ThemeId } from '@/constants/theme';

export type ScanLang = 'fr' | 'en';

interface SettingsState {
  theme: ThemeId;
  scanLang: ScanLang;       // preferred language for readable scans
  dataSaver: boolean;       // lower-quality reader images (MangaDex data-saver)
  haptics: boolean;         // haptic feedback on interactions
  notifications: boolean;   // new-chapter local notifications (permission-gated)

  setTheme: (theme: ThemeId) => void;
  setScanLang: (lang: ScanLang) => void;
  setDataSaver: (on: boolean) => void;
  setHaptics: (on: boolean) => void;
  setNotifications: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      theme: DEFAULT_THEME,
      scanLang: 'fr',
      dataSaver: false,
      haptics: true,
      notifications: false,

      setTheme: theme => {
        applyTheme(theme);
        set({ theme });
      },
      setScanLang: scanLang => set({ scanLang }),
      setDataSaver: dataSaver => set({ dataSaver }),
      setHaptics: haptics => set({ haptics }),
      setNotifications: notifications => set({ notifications }),
    }),
    {
      name: 'app-settings',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => state => {
        // Apply the persisted theme as soon as storage loads; _layout remounts
        // the tree when `theme` changes so every styled surface follows.
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
