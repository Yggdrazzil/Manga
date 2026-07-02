import { env } from '../../config/env.js';
import { prisma } from '../../db/client.js';

const TVMAZE_BASE = 'https://api.tvmaze.com';
const DAY = 86_400_000;

// Fallback séries (spec §16.2) : épisodes, air dates, lookup IMDb/TVDB.
async function cachedGet<T>(path: string, ttlMs: number): Promise<T | null> {
  if (!env.TVMAZE_ENABLED) return null;
  const cached = await prisma.apiCache.findUnique({
    where: { source_cacheKey: { source: 'tvmaze', cacheKey: path } },
  });
  if (cached && cached.expiresAt > new Date()) return JSON.parse(cached.responseJson) as T;
  try {
    const res = await fetch(`${TVMAZE_BASE}${path}`);
    if (!res.ok) return cached ? (JSON.parse(cached.responseJson) as T) : null;
    const data = (await res.json()) as T;
    await prisma.apiCache.upsert({
      where: { source_cacheKey: { source: 'tvmaze', cacheKey: path } },
      create: {
        source: 'tvmaze',
        cacheKey: path,
        responseJson: JSON.stringify(data),
        expiresAt: new Date(Date.now() + ttlMs),
      },
      update: { responseJson: JSON.stringify(data), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return data;
  } catch {
    return cached ? (JSON.parse(cached.responseJson) as T) : null;
  }
}

export type TvmazeShow = {
  id: number;
  name: string;
  premiered?: string | null;
  externals?: { thetvdb?: number | null; imdb?: string | null };
  image?: { medium?: string; original?: string } | null;
  network?: { name?: string } | null;
  webChannel?: { name?: string } | null;
  schedule?: { time?: string; days?: string[] };
};

export async function tvmazeLookupByTvdb(tvdbId: string): Promise<TvmazeShow | null> {
  return cachedGet(`/lookup/shows?thetvdb=${encodeURIComponent(tvdbId)}`, 30 * DAY);
}

export async function tvmazeLookupByImdb(imdbId: string): Promise<TvmazeShow | null> {
  return cachedGet(`/lookup/shows?imdb=${encodeURIComponent(imdbId)}`, 30 * DAY);
}

export async function tvmazeSearchShows(query: string): Promise<{ score: number; show: TvmazeShow }[]> {
  return (await cachedGet(`/search/shows?q=${encodeURIComponent(query)}`, 7 * DAY)) ?? [];
}

export type TvmazeEpisode = {
  id: number;
  season: number;
  number: number | null;
  name?: string;
  summary?: string | null;
  airdate?: string;
  airtime?: string;
  airstamp?: string;
  runtime?: number | null;
  image?: { medium?: string; original?: string } | null;
};

export async function tvmazeEpisodes(tvmazeShowId: number): Promise<TvmazeEpisode[]> {
  return (await cachedGet(`/shows/${tvmazeShowId}/episodes?specials=1`, 1 * DAY)) ?? [];
}
