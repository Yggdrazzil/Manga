/**
 * Positions de reprise de lecture, dans un store SÉPARÉ.
 *
 * Elles vivaient dans le store `manga-library`, aux côtés de toute la
 * bibliothèque. Or zustand/persist réécrit l'intégralité de l'état à chaque
 * `set()`, et le lecteur enregistre la page courante toutes les 1,5 s pendant
 * qu'on fait défiler : une bibliothèque de 100 séries (~330 Ko une fois les
 * fiches complètes sérialisées) était donc entièrement re-sérialisée et
 * réécrite dans AsyncStorage, en plein geste de défilement. Le coût grandissait
 * avec la taille de la bibliothèque — plus on suit de séries, plus le lecteur
 * saccade.
 *
 * Isolée ici, la même écriture ne porte plus que sur quelques centaines
 * d'octets.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Au-delà, on oublie les positions les plus anciennes. */
const MAX_TRACKED = 300;

interface ReadingPositionsState {
  positions: Record<string, number>;
  savePosition: (chapterId: string, page: number) => void;
  getPosition: (chapterId: string) => number | undefined;
  clearPosition: (chapterId: string) => void;
}

export const useReadingPositionsStore = create<ReadingPositionsState>()(
  persist(
    (set, get) => ({
      positions: {},

      savePosition: (chapterId, page) => {
        if (!chapterId || !Number.isFinite(page) || page < 1) return;
        set(state => {
          if (state.positions[chapterId] === page) return state; // pas d'écriture inutile
          const next = { ...state.positions, [chapterId]: page };
          // Purge bornée : sans elle, la table grossirait indéfiniment et on
          // aurait juste déplacé le problème.
          const keys = Object.keys(next);
          if (keys.length > MAX_TRACKED) {
            for (const k of keys.slice(0, keys.length - MAX_TRACKED)) delete next[k];
          }
          return { positions: next };
        });
      },

      getPosition: chapterId => get().positions[chapterId],

      clearPosition: chapterId => {
        set(state => {
          if (!(chapterId in state.positions)) return state;
          const next = { ...state.positions };
          delete next[chapterId];
          return { positions: next };
        });
      },
    }),
    {
      name: 'reading-positions',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
