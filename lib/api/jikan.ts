import type { Manga, PaginatedResult, MediaType, OngoingStatus } from '../types';

const BASE = 'https://api.jikan.moe/v4';

interface JikanImage {
  image_url: string;
  small_image_url?: string;
  large_image_url?: string;
}

interface JikanManga {
  mal_id: number;
  url: string;
  images: { jpg: JikanImage; webp: JikanImage };
  title: string;
  title_english?: string;
  title_japanese?: string;
  type: string;
  chapters?: number;
  volumes?: number;
  status: string;
  score?: number;
  rank?: number;
  popularity?: number;
  genres: Array<{ name: string }>;
  themes: Array<{ name: string }>;
  authors: Array<{ name: string }>;
  published: { from?: string };
  synopsis?: string;
}

interface JikanResponse {
  pagination: { has_next_page: boolean; last_visible_page: number; current_page: number; items: { total: number } };
  data: JikanManga[];
}

interface JikanSingleResponse {
  data: JikanManga;
}

function inferType(jType: string): MediaType {
  const map: Record<string, MediaType> = {
    Manhwa: 'MANHWA',
    Manhua: 'MANHUA',
    Manga: 'MANGA',
    'Light Novel': 'BD',
    Doujin: 'MANGA',
    'One-shot': 'MANGA',
  };
  return map[jType] ?? 'MANGA';
}

function mapStatus(status: string): OngoingStatus {
  if (status.includes('Publishing') || status.includes('publishing')) return 'ONGOING';
  if (status.includes('Finished') || status.includes('finished')) return 'COMPLETED';
  if (status.includes('Hiatus')) return 'HIATUS';
  if (status.includes('Discontinued')) return 'CANCELLED';
  return 'ONGOING';
}

function normalize(manga: JikanManga): Manga {
  const year = manga.published.from ? new Date(manga.published.from).getFullYear() : undefined;
  const genres = manga.genres.map(g => g.name);
  const tags = manga.themes.map(t => t.name);
  const authors = manga.authors.map(a => a.name.split(', ').reverse().join(' '));

  return {
    id: String(manga.mal_id),
    source: 'jikan',
    title: {
      english: manga.title_english ?? manga.title,
      native: manga.title_japanese ?? undefined,
      userPreferred: manga.title_english ?? manga.title,
    },
    coverImage: manga.images.jpg.large_image_url ?? manga.images.jpg.image_url,
    description: manga.synopsis ?? undefined,
    type: inferType(manga.type),
    genres,
    tags,
    status: mapStatus(manga.status),
    chapters: manga.chapters ?? undefined,
    volumes: manga.volumes ?? undefined,
    averageScore: manga.score ? Math.round(manga.score * 10) : undefined,
    popularity: manga.popularity ?? undefined,
    year: isNaN(year as number) ? undefined : year,
    authors,
  };
}

let lastRequestTime = 0;
async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 400) await new Promise(r => setTimeout(r, 400 - elapsed));
  lastRequestTime = Date.now();
  return fetch(url);
}

async function fetchJikan<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, String(v));
  const response = await throttledFetch(url.toString());
  if (!response.ok) throw new Error(`Jikan error: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getTopManga(page = 1): Promise<PaginatedResult<Manga>> {
  const data = await fetchJikan<JikanResponse>('/top/manga', { type: 'manga', page });
  return {
    items: data.data.map(normalize),
    hasNextPage: data.pagination.has_next_page,
    total: data.pagination.items.total,
    currentPage: page,
  };
}

export async function searchManga(query: string, page = 1, type?: string): Promise<PaginatedResult<Manga>> {
  const params: Record<string, string | number> = { q: query, page };
  if (type) params.type = type;

  const data = await fetchJikan<JikanResponse>('/manga', params);
  return {
    items: data.data.map(normalize),
    hasNextPage: data.pagination.has_next_page,
    total: data.pagination.items.total,
    currentPage: page,
  };
}

export async function getMangaById(id: string): Promise<Manga> {
  const data = await fetchJikan<JikanSingleResponse>(`/manga/${id}`);
  return normalize(data.data);
}
