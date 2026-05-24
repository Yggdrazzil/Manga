import type { Manga, PaginatedResult, MediaType, OngoingStatus } from '../types';

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
