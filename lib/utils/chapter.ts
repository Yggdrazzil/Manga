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

/**
 * Fills integer gaps in a chapter list with synthetic checkable-only cards.
 * MangaDex drops licensed chapters from its catalogue (e.g. One Piece EN
 * 57–370), so even the "authoritative" aggregate is not contiguous. Tracking
 * needs every chapter to exist as a card. Only integers strictly between the
 * lowest and highest observed numbers are added; decimals (56.5 extras) and
 * non-numeric labels are left untouched.
 */
export function fillChapterGaps(chapters: MangaChapter[], mangaId: string): MangaChapter[] {
  const nums = chapters
    .map(c => chapterNumber(c.chapter))
    .filter(n => Number.isFinite(n));
  if (nums.length === 0) return chapters;

  const present = new Set(nums.filter(n => Number.isInteger(n)));
  const min = Math.ceil(Math.min(...nums));
  const max = Math.floor(Math.max(...nums));

  const filled = [...chapters];
  for (let n = min; n <= max; n++) {
    if (present.has(n)) continue;
    filled.push({
      id: `${mangaId}-syn-${n}`,
      mangaId,
      chapter: String(n),
      pages: 0,
      publishAt: '',
      translatedLanguage: '',
      isReadable: false,
    });
  }
  return filled.sort(compareChapters);
}
