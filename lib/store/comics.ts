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

      refreshSeries: series => {
        set(state => ({
          entries: state.entries.map(e => {
            if (e.seriesId !== series.id) return e;
            // Keep user progress; recompute status against the fresh totalVolumes
            const status = nextStatus(e.status, e.readVolumes, series.totalVolumes);
            return { ...e, series, status, updatedAt: new Date().toISOString() };
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
