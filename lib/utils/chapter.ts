import type { MangaChapter } from '../types';

/**
 * Parse a MangaDex chapter label into a sortable number. Chapter labels are not
 * guaranteed numeric ("Oneshot", "Extra", "" …); those map to NaN and must never
 * leak into reading progress, so callers should guard with `isFinite`.
 */
export function chapterNumber(label: string | null | undefined): number {
  if (label == null) return NaN;
  const n = parseFloat(label);
  return Number.isFinite(n) ? n : NaN;
}

/** Sort comparator: numeric chapters ascending, non-numeric pushed to the end. */
export function compareChapters(a: MangaChapter, b: MangaChapter): number {
  const na = chapterNumber(a.chapter);
  const nb = chapterNumber(b.chapter);
  const aNaN = Number.isNaN(na);
  const bNaN = Number.isNaN(nb);
  if (aNaN && bNaN) return 0;
  if (aNaN) return 1;
  if (bNaN) return -1;
  return na - nb;
}

/** Highest finite chapter number from a set, or the existing fallback. */
export function maxChapterProgress(current: number, label: string | null | undefined): number {
  const n = chapterNumber(label);
  if (Number.isNaN(n)) return current;
  return Math.max(current, Math.floor(n));
}
