import type { Manga, MangaChapter, PaginatedResult, MediaType, OngoingStatus } from '../types';
import { fillChapterGaps } from '../utils/chapter';

const BASE = 'https://api.mangadex.org';
const WEBTOON_TAG_ID = '3e2b8dae-350e-4ab8-a3ac-3a6f9a58f83b'; // Long Strip tag

interface MDTitle {
  en?: string;
  ja?: string;
  'ja-ro'?: string;
  ko?: string;
  'ko-ro'?: string;
  [lang: string]: string | undefined;
}

interface MDTag {
  id: string;
  type: 'tag';
  attributes: { name: MDTitle; group: string };
}

interface MDRelationship {
  id: string;
  type: string;
  attributes?: { name?: string; fileName?: string };
}

interface MDManga {
  id: string;
  type: 'manga';
  attributes: {
    title: MDTitle;
    altTitles: MDTitle[];
    description: MDTitle;
    originalLanguage: string;
    status: string;
    year?: number | null;
    tags: MDTag[];
    availableTranslatedLanguages: string[];
    latestUploadedChapter?: string | null;
  };
  relationships: MDRelationship[];
}

interface MDResponse {
  result: string;
  response: string;
  data: MDManga[];
  total: number;
  limit: number;
  offset: number;
}

interface MDSingleResponse {
  result: string;
  response: string;
  data: MDManga;
}

interface MDChapter {
  id: string;
  type: 'chapter';
  attributes: {
    volume?: string | null;
    chapter?: string | null;
    title?: string | null;
    translatedLanguage: string;
    pages: number;
    publishAt: string;
    readableAt: string;
    externalUrl?: string | null;
  };
  relationships: MDRelationship[];
}

interface MDChapterFeedResponse {
  result: string;
  data: MDChapter[];
  total: number;
  limit: number;
  offset: number;
}

function pickTitle(title: MDTitle): string {
  return title.en ?? title['ja-ro'] ?? title['ko-ro'] ?? Object.values(title)[0] ?? 'Unknown';
}

function inferType(manga: MDManga): MediaType {
  const lang = manga.attributes.originalLanguage;
  const isLongStrip = manga.attributes.tags.some(t => t.id === WEBTOON_TAG_ID);
  if (lang === 'ko') return isLongStrip ? 'WEBTOON' : 'MANHWA';
  if (lang === 'zh' || lang === 'zh-hk') return 'MANHUA';
  return 'MANGA';
}

function mapStatus(status: string): OngoingStatus {
  const map: Record<string, OngoingStatus> = {
    ongoing: 'ONGOING',
    completed: 'COMPLETED',
    hiatus: 'HIATUS',
    cancelled: 'CANCELLED',
  };
  return map[status] ?? 'ONGOING';
}

function coverUrl(manga: MDManga): string {
  const coverRel = manga.relationships.find(r => r.type === 'cover_art');
  if (coverRel?.attributes?.fileName) {
    return `https://uploads.mangadex.org/covers/${manga.id}/${coverRel.attributes.fileName}.512.jpg`;
  }
  return '';
}

function normalize(manga: MDManga): Manga {
  const authors = manga.relationships
    .filter(r => r.type === 'author' || r.type === 'artist')
    .map(r => r.attributes?.name ?? '')
    .filter(Boolean);

  const genres = manga.attributes.tags
    .filter(t => t.attributes.group === 'genre')
    .map(t => pickTitle(t.attributes.name));

  const tags = manga.attributes.tags
    .filter(t => t.attributes.group !== 'genre')
    .map(t => pickTitle(t.attributes.name));

  const mainTitle = pickTitle(manga.attributes.title);
  const altTitles = manga.attributes.altTitles.map(t => Object.values(t)[0]).filter(Boolean);
  const englishTitle = manga.attributes.title.en ?? altTitles.find(t => t);

  const readingLangs = (manga.attributes.availableTranslatedLanguages ?? [])
    .filter(l => l === 'fr' || l === 'en');

  return {
    id: manga.id,
    source: 'mangadex',
    title: {
      english: englishTitle,
      native: manga.attributes.title[manga.attributes.originalLanguage],
      userPreferred: englishTitle ?? mainTitle,
    },
    coverImage: coverUrl(manga),
    description: manga.attributes.description.en ?? undefined,
    type: inferType(manga),
    genres,
    tags,
    status: mapStatus(manga.attributes.status),
    year: manga.attributes.year ?? undefined,
    authors: [...new Set(authors)],
    countryOfOrigin: manga.attributes.originalLanguage,
    availableReadingLanguages: readingLangs.length > 0 ? readingLangs : undefined,
  };
}

async function fetchMD<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(`${key}[]`, String(v)));
    } else if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) throw new Error(`MangaDex error: ${response.status}`);
  return response.json() as Promise<T>;
}

const INCLUDES = ['cover_art', 'author', 'artist'];
const CONTENT_RATINGS = ['safe', 'suggestive'];

export async function getWebtoons(page = 1, perPage = 20): Promise<PaginatedResult<Manga>> {
  const data = await fetchMD<MDResponse>('/manga', {
    limit: perPage,
    offset: (page - 1) * perPage,
    includes: INCLUDES,
    contentRating: CONTENT_RATINGS,
    originalLanguage: ['ko'],
    includedTags: [WEBTOON_TAG_ID],
    'order[followedCount]': 'desc',
  });

  return {
    items: data.data.map(normalize),
    hasNextPage: data.offset + data.limit < data.total,
    total: data.total,
    currentPage: page,
  };
}

export async function getPopular(page = 1, perPage = 20): Promise<PaginatedResult<Manga>> {
  const data = await fetchMD<MDResponse>('/manga', {
    limit: perPage,
    offset: (page - 1) * perPage,
    includes: INCLUDES,
    contentRating: CONTENT_RATINGS,
    'order[followedCount]': 'desc',
  });

  return {
    items: data.data.map(normalize),
    hasNextPage: data.offset + data.limit < data.total,
    total: data.total,
    currentPage: page,
  };
}

export async function searchManga(
  query: string,
  page = 1,
  perPage = 20,
  lang?: string,
): Promise<PaginatedResult<Manga>> {
  const params: Record<string, unknown> = {
    limit: perPage,
    offset: (page - 1) * perPage,
    includes: INCLUDES,
    contentRating: CONTENT_RATINGS,
    'order[relevance]': 'desc',
  };
  if (query) params.title = query;
  if (lang) params.originalLanguage = [lang];

  const data = await fetchMD<MDResponse>('/manga', params);

  return {
    items: data.data.map(normalize),
    hasNextPage: data.offset + data.limit < data.total,
    total: data.total,
    currentPage: page,
  };
}

export async function getMangaById(id: string): Promise<Manga> {
  const data = await fetchMD<MDSingleResponse>(`/manga/${id}`, { includes: INCLUDES });
  return normalize(data.data);
}

function normalizeChapter(ch: MDChapter): MangaChapter {
  const mangaRel = ch.relationships.find(r => r.type === 'manga');
  return {
    id: ch.id,
    mangaId: mangaRel?.id ?? '',
    chapter: ch.attributes.chapter ?? '0',
    volume: ch.attributes.volume ?? undefined,
    title: ch.attributes.title ?? undefined,
    pages: ch.attributes.pages,
    publishAt: ch.attributes.publishAt,
    translatedLanguage: ch.attributes.translatedLanguage,
    externalUrl: ch.attributes.externalUrl ?? undefined,
    isReadable: (ch.attributes.pages ?? 0) > 0 && !ch.attributes.externalUrl,
  };
}

export async function getMangaChapters(
  mangaId: string,
  opts?: { lang?: string[]; page?: number; perPage?: number }
): Promise<{ chapters: MangaChapter[]; total: number; hasNext: boolean }> {
  const lang = opts?.lang ?? ['en', 'fr'];
  const perPage = opts?.perPage ?? 100;
  const page = opts?.page ?? 1;

  const data = await fetchMD<MDChapterFeedResponse>(`/manga/${mangaId}/feed`, {
    limit: perPage,
    offset: (page - 1) * perPage,
    translatedLanguage: lang,
    'order[chapter]': 'desc',
    'order[publishAt]': 'desc',
    contentRating: CONTENT_RATINGS,
  });

  const seen = new Set<string>();
  const deduped: MDChapter[] = [];
  for (const ch of data.data) {
    const num = ch.attributes.chapter ?? 'none';
    if (!seen.has(num)) {
      seen.add(num);
      deduped.push(ch);
    }
  }

  return {
    chapters: deduped.map(normalizeChapter),
    total: data.total,
    hasNext: data.offset + data.limit < data.total,
  };
}

export async function getChaptersForLibrary(
  mangaIds: string[],
  lang?: string[]
): Promise<MangaChapter[]> {
  if (mangaIds.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - 14);

  const data = await fetchMD<MDChapterFeedResponse>('/chapter', {
    manga: mangaIds,
    translatedLanguage: lang ?? ['en', 'fr'],
    'publishAt[gte]': since.toISOString(),
    'order[publishAt]': 'desc',
    limit: 100,
    contentRating: CONTENT_RATINGS,
    includeExternalUrl: 0,
  });

  // MangaDex renvoie un enregistrement par langue ET par groupe de scantrad :
  // un même chapitre remonte donc plusieurs fois. Sans dédoublonnage, le fil
  // des sorties affichait « Ch. 1152 » trois fois, marquer une version lue ne
  // faisait pas disparaître les autres, et les doublons consommaient le
  // plafond de 100 au point de masquer les sorties les plus anciennes.
  // getMangaChapters déduplique déjà de la même façon.
  const preferred = (lang ?? ['en', 'fr'])[0];
  const best = new Map<string, MDChapter>();
  for (const ch of data.data) {
    const key = `${ch.relationships?.find(r => r.type === 'manga')?.id ?? ''}#${ch.attributes.chapter ?? 'none'}`;
    const current = best.get(key);
    if (!current) {
      best.set(key, ch);
      continue;
    }
    // À chapitre égal, on garde la langue préférée de l'utilisateur.
    if (
      ch.attributes.translatedLanguage === preferred &&
      current.attributes.translatedLanguage !== preferred
    ) {
      best.set(key, ch);
    }
  }

  return Array.from(best.values()).map(normalizeChapter);
}

function normalizeTitleString(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function candidateTitles(manga: MDManga): string[] {
  const out: string[] = [];
  for (const v of Object.values(manga.attributes.title)) {
    if (v) out.push(v);
  }
  for (const alt of manga.attributes.altTitles) {
    for (const v of Object.values(alt)) {
      if (v) out.push(v);
    }
  }
  return out;
}

export async function findMangadexId(
  title: string,
  hints?: { year?: number }
): Promise<string | null> {
  const data = await fetchMD<MDResponse>('/manga', {
    title,
    limit: 10,
    contentRating: CONTENT_RATINGS,
  });

  const query = normalizeTitleString(title);

  let bestId: string | null = null;
  let bestScore = -Infinity;

  for (const manga of data.data) {
    const candidates = candidateTitles(manga).map(normalizeTitleString).filter(Boolean);
    let score = 0;
    for (const cand of candidates) {
      if (cand === query) {
        score = Math.max(score, 3);
      } else if (cand.startsWith(query) || query.startsWith(cand)) {
        score = Math.max(score, 2);
      } else if (cand.includes(query) || query.includes(cand)) {
        score = Math.max(score, 1);
      }
    }
    if (hints?.year != null && manga.attributes.year === hints.year) {
      score += 0.5;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = manga.id;
    }
  }

  if (bestScore < 2) return null;
  return bestId;
}

export async function getReadableChapters(
  mangaId: string,
  lang?: string[]
): Promise<MangaChapter[]> {
  const limit = 100;
  const MAX_PAGES = 30;
  const seen = new Set<string>();
  const readable: MangaChapter[] = [];

  let offset = 0;
  let total = Infinity;
  let pages = 0;

  while (offset < total && pages < MAX_PAGES) {
    const data = await fetchMD<MDChapterFeedResponse>(`/manga/${mangaId}/feed`, {
      limit,
      offset,
      translatedLanguage: lang ?? ['en', 'fr'],
      'order[chapter]': 'asc',
      includeExternalUrl: 0,
      contentRating: CONTENT_RATINGS,
    });

    for (const ch of data.data) {
      if ((ch.attributes.pages ?? 0) <= 0 || ch.attributes.externalUrl) continue;
      const num = ch.attributes.chapter ?? 'none';
      if (seen.has(num)) continue;
      seen.add(num);
      readable.push(normalizeChapter(ch));
    }

    total = data.total;
    offset += limit;
    pages += 1;
  }

  return readable;
}

interface MDAggregateChapter {
  chapter: string;
  id: string;
  others: string[];
  count: number;
}

interface MDAggregateVolume {
  volume: string;
  count: number;
  chapters: Record<string, MDAggregateChapter> | MDAggregateChapter[];
}

interface MDAggregateResponse {
  result: string;
  volumes: Record<string, MDAggregateVolume> | MDAggregateVolume[];
}

// The /aggregate endpoint returns the complete chapter map (every chapter
// number with its volume) in a single request. Called WITHOUT a language
// filter it yields the true full list across all languages — the only
// reliable count for ongoing series like One Piece (1100+ chapters), where
// AniList reports null and a language-filtered feed only sees a few uploads.
export async function getChapterAggregate(
  mangaId: string,
  lang?: string[],
): Promise<Array<{ chapter: string; volume?: string; id: string }>> {
  const params: Record<string, unknown> = {};
  if (lang && lang.length > 0) params.translatedLanguage = lang;

  const data = await fetchMD<MDAggregateResponse>(`/manga/${mangaId}/aggregate`, params);

  const volumes = Array.isArray(data.volumes)
    ? data.volumes
    : Object.values(data.volumes ?? {});

  const out: Array<{ chapter: string; volume?: string; id: string }> = [];
  for (const vol of volumes) {
    const chapters = Array.isArray(vol.chapters)
      ? vol.chapters
      : Object.values(vol.chapters ?? {});
    for (const ch of chapters) {
      if (!ch.chapter) continue;
      out.push({
        chapter: ch.chapter,
        volume: vol.volume && vol.volume !== 'none' ? vol.volume : undefined,
        id: ch.id,
      });
    }
  }
  return out;
}

// Best-effort pass over the feed to attach rich metadata (title, date, pages,
// readability) to each chapter number. External/zero-page chapters are kept
// here (unlike getReadableChapters) so series like One Piece still get titles.
async function getChapterFeedMeta(
  mangaId: string,
  lang: string[],
): Promise<Map<string, MangaChapter>> {
  const limit = 100;
  const MAX_PAGES = 20;
  const byNum = new Map<string, MangaChapter>();

  let offset = 0;
  let total = Infinity;
  let pages = 0;

  while (offset < total && pages < MAX_PAGES) {
    const data = await fetchMD<MDChapterFeedResponse>(`/manga/${mangaId}/feed`, {
      limit,
      offset,
      translatedLanguage: lang,
      'order[chapter]': 'asc',
      'order[publishAt]': 'asc',
      contentRating: CONTENT_RATINGS,
    });

    const preferred = lang[0];
    for (const ch of data.data) {
      const num = ch.attributes.chapter;
      if (!num) continue;
      const existing = byNum.get(num);
      // Prefer the user's first language when both are returned in one feed
      if (!existing || (existing.translatedLanguage !== preferred && ch.attributes.translatedLanguage === preferred)) {
        byNum.set(num, normalizeChapter(ch));
      }
    }

    total = data.total;
    offset += limit;
    pages += 1;
  }

  return byNum;
}

// Full chapter list for tracking (TV-Time style): every chapter as a checkable
// card. Combines the authoritative aggregate count with feed metadata. A
// chapter that is readable in-app keeps its real id + isReadable flag so the
// reader still works; the rest become checkable-only cards.
export async function getTrackingChapters(
  mangaId: string,
  lang?: string[],
): Promise<MangaChapter[]> {
  const languages = lang ?? ['fr', 'en'];

  const [aggResult, metaResult] = await Promise.allSettled([
    // Full list across ALL languages = the real chapter count.
    getChapterAggregate(mangaId),
    // Metadata (title/date) + in-app readability, scoped to en/fr.
    getChapterFeedMeta(mangaId, languages),
  ]);

  const agg = aggResult.status === 'fulfilled' ? aggResult.value : [];
  const meta = metaResult.status === 'fulfilled' ? metaResult.value : new Map<string, MangaChapter>();

  if (agg.length === 0) {
    return Array.from(meta.values());
  }

  const seen = new Set<string>();
  const chapters: MangaChapter[] = [];
  for (const a of agg) {
    if (seen.has(a.chapter)) continue;
    seen.add(a.chapter);

    const m = meta.get(a.chapter);
    if (m) {
      chapters.push({ ...m, volume: m.volume ?? a.volume });
    } else {
      // Aggregate-only chapter: no fr/en upload exists. NEVER reuse a.id here —
      // it points at a real upload in an arbitrary language (pl, vi, …) and the
      // reader would happily render those pages. Synthetic id = checkable-only.
      chapters.push({
        id: `${mangaId}-agg-${a.chapter}`,
        mangaId,
        chapter: a.chapter,
        volume: a.volume,
        pages: 0,
        publishAt: '',
        translatedLanguage: '',
        isReadable: false,
      });
    }
  }

  // MangaDex drops licensed chapters entirely (One Piece: 57-370 missing from
  // the aggregate) — fill the holes so tracking shows a contiguous list.
  return fillChapterGaps(chapters, mangaId);
}

interface MDAtHomeResponse {
  result: string;
  baseUrl: string;
  chapter: { hash: string; data: string[]; dataSaver: string[] };
}

export async function getChapterPages(
  chapterId: string,
  dataSaver = false
): Promise<string[]> {
  const url = `${BASE}/at-home/server/${chapterId}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`MangaDex at-home error: ${res.status}`);
  const d = (await res.json()) as MDAtHomeResponse;
  const quality = dataSaver ? 'data-saver' : 'data';
  const files = dataSaver ? d.chapter.dataSaver : d.chapter.data;
  return files.map(f => `${d.baseUrl}/${quality}/${d.chapter.hash}/${f}`);
}
