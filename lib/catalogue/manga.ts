/**
 * Local manga/manhwa/manhua + Webtoon Originals catalogues.
 *
 * Pre-compiled by CI (scripts/build-manga-catalogue.mjs from AniList,
 * scripts/build-webtoon-catalogue.mjs from the Originals listing) and bundled
 * by Metro. Search is instant and offline; the live APIs stay authoritative
 * for full descriptions, chapters and anything not bundled.
 */

import type { Manga, MediaType, OngoingStatus } from '../types';

// Compact bundled shapes — short keys keep the JSON small
interface MangaCatEntry {
  i: number;
  t: { r?: string; e?: string; n?: string; u: string };
  sy?: string[];
  c: string;
  b?: string;
  col?: string;
  d?: string;
  st: string;
  ch?: number;
  vo?: number;
  sc?: number;
  pop?: number;
  y?: number;
  g: string[];
  co?: string;
  a: string[];
  md?: string;
}

interface WebtoonCatEntry {
  id: string;
  t: string;
  a: string[];
  c: string;
  g: string;
  d?: string;
}

interface MangaCatalogue { version: string; entries: MangaCatEntry[] }
interface WebtoonCatalogue { version: string; entries: WebtoonCatEntry[] }

let _manga: MangaCatalogue | null = null;
let _webtoon: WebtoonCatalogue | null = null;

function mangaData(): MangaCatalogue {
  if (_manga) return _manga;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    _manga = require('../../assets/manga-catalogue.json') as MangaCatalogue;
  } catch {
    _manga = { version: '', entries: [] };
  }
  return _manga;
}

function webtoonData(): WebtoonCatalogue {
  if (_webtoon) return _webtoon;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    _webtoon = require('../../assets/webtoon-catalogue.json') as WebtoonCatalogue;
  } catch {
    _webtoon = { version: '', entries: [] };
  }
  return _webtoon;
}

// ── Normalization to the app's Manga shape ────────────────────────────────────

function inferType(country?: string): MediaType {
  if (country === 'KR') return 'MANHWA';
  if (country === 'CN' || country === 'TW' || country === 'HK') return 'MANHUA';
  return 'MANGA';
}

const STATUS_MAP: Record<string, OngoingStatus> = {
  FINISHED: 'COMPLETED',
  RELEASING: 'ONGOING',
  NOT_YET_RELEASED: 'NOT_YET_RELEASED',
  CANCELLED: 'CANCELLED',
  HIATUS: 'HIATUS',
};

export function toManga(e: MangaCatEntry): Manga {
  return {
    id: String(e.i),
    source: 'anilist',
    title: {
      romaji: e.t.r,
      english: e.t.e,
      native: e.t.n,
      userPreferred: e.t.u,
    },
    coverImage: e.c,
    bannerImage: e.b,
    description: e.d,
    type: inferType(e.co),
    genres: e.g,
    tags: [],
    status: STATUS_MAP[e.st] ?? 'ONGOING',
    chapters: e.ch,
    volumes: e.vo,
    averageScore: e.sc,
    popularity: e.pop,
    year: e.y,
    authors: e.a,
    countryOfOrigin: e.co,
    accentColor: e.col,
    mangadexId: e.md,
  };
}

function toWebtoonManga(e: WebtoonCatEntry): Manga {
  return {
    id: e.id,
    source: 'webtoon',
    title: { userPreferred: e.t, english: e.t },
    coverImage: e.c,
    description: e.d,
    type: 'WEBTOON',
    genres: [e.g],
    tags: [],
    status: 'ONGOING',
    authors: e.a,
    countryOfOrigin: 'KR',
  };
}

// ── Search ────────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function matchScore(needle: string, names: Array<string | undefined>): number {
  let best = 0;
  for (const name of names) {
    if (!name) continue;
    const hay = norm(name);
    if (!hay) continue;
    if (hay === needle) return 100;
    if (hay.startsWith(needle)) best = Math.max(best, 80);
    else if (hay.includes(needle)) best = Math.max(best, 60);
  }
  return best;
}

export interface LocalMangaFilter {
  country?: 'JP' | 'KR' | 'CN';
}

/** Instant offline search over the bundled AniList top-5000 catalogue. */
export function searchLocalManga(
  query: string,
  limit = 12,
  filter?: LocalMangaFilter,
): Manga[] {
  const needle = norm(query);
  if (needle.length < 2) return [];

  const scored: Array<{ e: MangaCatEntry; score: number }> = [];
  for (const e of mangaData().entries) {
    if (filter?.country) {
      const co = e.co ?? 'JP';
      if (filter.country === 'CN' ? !['CN', 'TW', 'HK'].includes(co) : co !== filter.country) {
        continue;
      }
    }
    const score = matchScore(needle, [e.t.u, e.t.e, e.t.r, e.t.n, ...(e.sy ?? [])]);
    if (score > 0) scored.push({ e, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || (b.e.pop ?? 0) - (a.e.pop ?? 0))
    .slice(0, limit)
    .map(({ e }) => toManga(e));
}

/** Instant offline search over the bundled Webtoon Originals catalogue. */
export function searchLocalWebtoons(query: string, limit = 8): Manga[] {
  const needle = norm(query);
  if (needle.length < 2) return [];

  const scored: Array<{ e: WebtoonCatEntry; score: number }> = [];
  for (const e of webtoonData().entries) {
    const score = matchScore(needle, [e.t]);
    if (score > 0) scored.push({ e, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ e }) => toWebtoonManga(e));
}

/** AniList-id lookup for instant detail-screen first paint. */
export function findLocalManga(anilistId: string): Manga | null {
  const id = parseInt(anilistId, 10);
  if (isNaN(id)) return null;
  const entry = mangaData().entries.find(e => e.i === id);
  return entry ? toManga(entry) : null;
}

/** Webtoon-id lookup ("{title_no}:{genre}/{slug}") for detail first paint. */
export function findLocalWebtoon(id: string): Manga | null {
  const entry = webtoonData().entries.find(e => e.id === id);
  return entry ? toWebtoonManga(entry) : null;
}
