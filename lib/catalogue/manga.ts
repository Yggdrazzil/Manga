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

function matchScore(needle: string, keys: string[]): number {
  let best = 0;
  for (const hay of keys) {
    if (hay === needle) return 100;
    if (hay.startsWith(needle)) best = Math.max(best, 80);
    else if (hay.includes(needle)) best = Math.max(best, 60);
  }
  return best;
}

// Index de recherche pré-normalisé.
//
// Normaliser à la volée coûtait ~40 000 créations de chaînes par frappe
// (5000 œuvres × jusqu'à 8 titres/synonymes), mesuré à 58 ms par recherche sur
// un poste de bureau — plusieurs centaines de millisecondes de thread JS bloqué
// sur mobile, à chaque lettre tapée. En pré-calculant les clés une seule fois,
// la recherche retombe à ~4 ms.
interface MangaIndexRow { e: MangaCatEntry; keys: string[]; co: string }
interface WebtoonIndexRow { e: WebtoonCatEntry; keys: string[] }

let _mangaIndex: MangaIndexRow[] | null = null;
let _webtoonIndex: WebtoonIndexRow[] | null = null;

function mangaIndex(): MangaIndexRow[] {
  if (_mangaIndex) return _mangaIndex;
  _mangaIndex = mangaData().entries.map(e => ({
    e,
    co: e.co ?? 'JP',
    keys: [e.t.u, e.t.e, e.t.r, e.t.n, ...(e.sy ?? [])]
      .filter((s): s is string => !!s)
      .map(norm)
      .filter(Boolean),
  }));
  return _mangaIndex;
}

function webtoonIndex(): WebtoonIndexRow[] {
  if (_webtoonIndex) return _webtoonIndex;
  _webtoonIndex = webtoonData().entries.map(e => ({
    e,
    keys: [norm(e.t)].filter(Boolean),
  }));
  return _webtoonIndex;
}

export interface LocalMangaFilter {
  country?: 'JP' | 'KR' | 'CN';
}

const CHINA = ['CN', 'TW', 'HK'];

/** Instant offline search over the bundled AniList top-5000 catalogue. */
export function searchLocalManga(
  query: string,
  limit = 12,
  filter?: LocalMangaFilter,
): Manga[] {
  const needle = norm(query);
  if (needle.length < 2) return [];

  const scored: Array<{ e: MangaCatEntry; score: number }> = [];
  for (const row of mangaIndex()) {
    if (filter?.country) {
      const ok = filter.country === 'CN' ? CHINA.includes(row.co) : row.co === filter.country;
      if (!ok) continue;
    }
    const score = matchScore(needle, row.keys);
    if (score > 0) scored.push({ e: row.e, score });
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
  for (const row of webtoonIndex()) {
    const score = matchScore(needle, row.keys);
    if (score > 0) scored.push({ e: row.e, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ e }) => toWebtoonManga(e));
}

/**
 * Matérialise les catalogues et construit les index HORS du chemin de rendu.
 *
 * Sans ça, la toute première recherche de la session payait, en synchrone dans
 * le render, le require() des JSON puis la construction des index : le champ de
 * saisie se figeait une demi-seconde juste après le debounce.
 */
export function warmCatalogues(): void {
  mangaIndex();
  webtoonIndex();
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
