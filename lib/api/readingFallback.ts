import * as mangaplus from './mangaplus';
import * as webtoon from './webtoon';
import { logger } from '../utils/logger';
import type { Manga, MangaChapter, MediaSource } from '../types';

// Comick is metadata-only since the comick.dev migration (no page images),
// so it can't back a reading feed.
export type FallbackSource = Extract<MediaSource, 'mangaplus' | 'webtoon'>;

export interface FallbackFeed {
  source: FallbackSource;
  mangaId: string;
  chapters: MangaChapter[];
}

export function normalizeTitle(s?: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}

function bestMatch(target: Manga, candidates: Manga[]): Manga | null {
  const wanted = [
    target.title.english,
    target.title.romaji,
    target.title.userPreferred,
    target.title.native,
  ]
    .map(normalizeTitle)
    .filter(Boolean);

  for (const c of candidates) {
    const names = [c.title.english, c.title.romaji, c.title.userPreferred]
      .map(normalizeTitle)
      .filter(Boolean);
    if (names.some(n => wanted.includes(n))) return c;
  }
  return null;
}

const ADAPTERS: Record<
  FallbackSource,
  {
    search: (q: string) => Promise<{ items: Manga[] }>;
    chapters: (id: string, langParam?: string[]) => Promise<MangaChapter[]>;
  }
> = {
  mangaplus: {
    search: q => mangaplus.searchManga(q, 1, 8),
    chapters: id => mangaplus.getTrackingChapters(id),
  },
  webtoon: {
    // Canvas is user-generated: anyone can upload a comic named after a hit
    // series (a fake "Solo leveling" with one episode of AoT pages exists).
    // Only curated Originals are trustworthy as an identity match.
    search: q =>
      webtoon.searchManga(q, 1, 8).then(r => ({
        items: r.items.filter(m => !m.id.includes(':canvas/')),
      })),
    chapters: id => webtoon.getTrackingChapters(id),
  },
};

/**
 * When the MangaDex feed for a catalogue entry (AniList/Jikan) has no readable
 * chapter — DMCA'd titles like One Piece or Solo Leveling — look the work up on
 * sources that ship their own feed. Official sources are tried first for the
 * work's country of origin; the title must match exactly (normalized) so a
 * spin-off never silently replaces the main series.
 */
export async function resolveFallbackFeed(
  manga: Manga,
  langParam?: string[],
): Promise<FallbackFeed | null> {
  const order: FallbackSource[] =
    manga.countryOfOrigin === 'KR' || manga.countryOfOrigin === 'CN'
      ? ['webtoon', 'mangaplus']
      : ['mangaplus', 'webtoon'];

  const query = manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred;

  for (const source of order) {
    try {
      const { items } = await ADAPTERS[source].search(query);
      const match = bestMatch(manga, items);
      if (!match) continue;
      const chapters = await ADAPTERS[source].chapters(match.id, langParam);
      if (chapters.some(c => c.isReadable)) {
        return { source, mangaId: match.id, chapters };
      }
    } catch (e) {
      logger.warn('Reading fallback failed', { source, error: String(e) });
    }
  }
  return null;
}
