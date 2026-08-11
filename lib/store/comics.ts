import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BDSeries, BDSeriesEntry, BDVolume, ReadingStatus } from '../types';

// Auto-computes the "natural" status from read progress.
// Manual overrides (PAUSED, DROPPED) are preserved across toggles unless the
// series becomes COMPLETED.
function computeStatus(readVolumes: number[], totalVolumes: number): ReadingStatus {
  if (readVolumes.length === 0) return 'PLAN_TO_READ';
  if (totalVolumes > 0 && readVolumes.length >= totalVolumes) return 'COMPLETED';
  return 'READING';
}

function nextStatus(current: ReadingStatus, readVolumes: number[], totalVolumes: number): ReadingStatus {
  const natural = computeStatus(readVolumes, totalVolumes);
  const isManualHold = current === 'PAUSED' || current === 'DROPPED';
  return isManualHold && natural !== 'COMPLETED' ? current : natural;
}

interface ComicsState {
  entries: BDSeriesEntry[];

  // Add a series if new. When volumeNum is provided, also mark that volume read.
  addOrUpdateSeries: (series: BDSeries, volumeNum?: number) => void;

  // Replace stored series data (refreshed consolidation) while keeping progress.
  refreshSeries: (series: BDSeries) => void;

  // Remove a series from tracking entirely.
  removeEntry: (seriesId: string) => void;

  // Toggle a single volume read/unread, then auto-recompute status.
  toggleVolumeRead: (seriesId: string, volumeNum: number) => void;

  // Manual status override (e.g. PAUSED, DROPPED).
  updateStatus: (seriesId: string, status: ReadingStatus) => void;

  toggleFavorite: (seriesId: string) => void;
  updateScore: (seriesId: string, score: number) => void;
  updateNotes: (seriesId: string, notes: string) => void;

  // Enrich stored volumes with lazily-loaded subtitle/description/publisher.
  updateVolumeDetail: (
    seriesId: string,
    volumeNum: number,
    detail: { subtitle?: string; description?: string; publisher?: string },
  ) => void;

  getEntry: (seriesId: string) => BDSeriesEntry | undefined;
  isVolumeRead: (seriesId: string, volumeNum: number) => boolean;
}

export const useComicsStore = create<ComicsState>()(
  persist(
    (set, get) => ({
      entries: [],

      addOrUpdateSeries: (series, volumeNum) => {
        const existing = get().getEntry(series.id);
        // Only volume numbers ≥ 1 are real tomes — guards against phantom "volume 0"
        const markVolume = volumeNum != null && volumeNum >= 1 ? volumeNum : undefined;
        if (existing) {
          if (markVolume == null || existing.readVolumes.includes(markVolume)) return;
          const readVolumes = [...existing.readVolumes, markVolume].sort((a, b) => a - b);
          const status = nextStatus(existing.status, readVolumes, existing.series.totalVolumes);
          set(state => ({
            entries: state.entries.map(e =>
              e.seriesId === series.id
                ? { ...e, readVolumes, status, updatedAt: new Date().toISOString() }
                : e,
            ),
          }));
          return;
        }
        const readVolumes = markVolume != null ? [markVolume] : [];
        const entry: BDSeriesEntry = {
          seriesId: series.id,
          status: computeStatus(readVolumes, series.totalVolumes),
          readVolumes,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          series,
        };
        set(state => ({ entries: [entry, ...state.entries] }));
      },

      // Un rafraîchissement ne doit JAMAIS appauvrir ce qui est déjà stocké.
      // Les sources (Wikidata, BnF, Open Library…) échouent indépendamment :
      // sur un réseau dégradé, le pipeline peut ne remonter que 3 tomes sur 24.
      // Remplacer la liste ferait disparaître des tomes cochés et recalculerait
      // le statut sur un total rétréci — la série passerait à « Terminé ».
      refreshSeries: series => {
        set(state => ({
          entries: state.entries.map(e => {
            if (e.seriesId !== series.id) return e;

            // Distinguer une panne d'une réparation.
            //
            // Un stock pollué (ancienne exécution ayant ajouté des tomes
            // positionnels en plus des vrais) est toujours PLUS gros que la
            // vérité : comparer les tailles brutes ne réparerait donc jamais
            // rien. On raisonne en proportion — un effondrement (3 tomes sur
            // 24) trahit des sources tombées et déclenche l'union protectrice,
            // une baisse légère est traitée comme une correction et le frais
            // fait autorité sur la liste.
            // Dans tous les cas, un tome que l'utilisateur a coché est conservé.
            const HEALTHY_RATIO = 0.6;
            const healthy =
              series.volumes.length >= Math.ceil(e.series.volumes.length * HEALTHY_RATIO);
            const fresh = new Set(series.volumes.map(v => v.num));
            const ticked = new Set(e.readVolumes);

            // Union par numéro de tome : l'ancien sert de base, le frais
            // complète champ par champ sans jamais écraser par undefined.
            const byNum = new Map<number, BDVolume>();
            for (const old of e.series.volumes) {
              if (healthy && !fresh.has(old.num) && !ticked.has(old.num)) continue;
              byNum.set(old.num, old);
            }
            for (const v of series.volumes) {
              const old = byNum.get(v.num);
              byNum.set(v.num, old
                ? {
                    ...old,
                    ...v,
                    subtitle: v.subtitle ?? old.subtitle,
                    description: v.description ?? old.description,
                    publisher: v.publisher ?? old.publisher,
                    coverImage: v.coverImage ?? old.coverImage,
                    publishedDate: v.publishedDate ?? old.publishedDate,
                    frwikiTitle: v.frwikiTitle ?? old.frwikiTitle,
                    authors: v.authors?.length ? v.authors : old.authors,
                  }
                : v);
            }
            const volumes = Array.from(byNum.values()).sort((a, b) => a.num - b.num);

            const merged: BDSeries = {
              ...e.series,
              ...series,
              description: series.description ?? e.series.description,
              coverImage: series.coverImage ?? e.series.coverImage,
              authors: series.authors.length ? series.authors : e.series.authors,
              volumes,
              // Le nombre de tomes réellement connus. Pas de Math.max avec
              // l'ancien total : les entrées ajoutées avant la correction
              // portent un total gonflé (le plus grand ordinal, ex. 435 pour
              // 39 tomes) qui ne redescendrait alors jamais. L'union ci-dessus
              // garantit déjà qu'un refresh dégradé ne peut pas réduire la
              // liste.
              totalVolumes: volumes.length,
            };

            // Keep user progress; recompute status against the merged total.
            const status = nextStatus(e.status, e.readVolumes, merged.totalVolumes);
            // A metadata refresh is not user activity: updatedAt stays untouched
            // so the library's staleness grouping remains meaningful.
            return { ...e, series: merged, status };
          }),
        }));
      },

      removeEntry: seriesId => {
        set(state => ({ entries: state.entries.filter(e => e.seriesId !== seriesId) }));
      },

      toggleVolumeRead: (seriesId, volumeNum) => {
        set(state => ({
          entries: state.entries.map(e => {
            if (e.seriesId !== seriesId) return e;
            const alreadyRead = e.readVolumes.includes(volumeNum);
            const readVolumes = alreadyRead
              ? e.readVolumes.filter(v => v !== volumeNum)
              : [...e.readVolumes, volumeNum].sort((a, b) => a - b);
            const status = nextStatus(e.status, readVolumes, e.series.totalVolumes);
            return { ...e, readVolumes, status, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      updateStatus: (seriesId, status) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.seriesId === seriesId
              ? { ...e, status, updatedAt: new Date().toISOString() }
              : e,
          ),
        }));
      },

      toggleFavorite: seriesId => {
        set(state => ({
          entries: state.entries.map(e =>
            e.seriesId === seriesId
              ? { ...e, favorite: !e.favorite, updatedAt: new Date().toISOString() }
              : e,
          ),
        }));
      },

      updateScore: (seriesId, score) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.seriesId === seriesId
              ? { ...e, score, updatedAt: new Date().toISOString() }
              : e,
          ),
        }));
      },

      updateNotes: (seriesId, notes) => {
        set(state => ({
          entries: state.entries.map(e =>
            e.seriesId === seriesId
              ? { ...e, notes, updatedAt: new Date().toISOString() }
              : e,
          ),
        }));
      },

      updateVolumeDetail: (seriesId, volumeNum, detail) => {
        set(state => ({
          entries: state.entries.map(e => {
            if (e.seriesId !== seriesId) return e;
            const volumes: BDVolume[] = e.series.volumes.map(v =>
              v.num === volumeNum ? { ...v, ...detail } : v,
            );
            return { ...e, series: { ...e.series, volumes } };
          }),
        }));
      },

      getEntry: seriesId => get().entries.find(e => e.seriesId === seriesId),

      isVolumeRead: (seriesId, volumeNum) => {
        const entry = get().getEntry(seriesId);
        return entry?.readVolumes.includes(volumeNum) ?? false;
      },
    }),
    {
      name: 'comics-library',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (_persistedState, version) => {
        // v1 used per-tome ComicEntry; v2 uses series-level BDSeriesEntry
        if (version < 2) return { entries: [] };
        return _persistedState as { entries: BDSeriesEntry[] };
      },
    },
  ),
);
