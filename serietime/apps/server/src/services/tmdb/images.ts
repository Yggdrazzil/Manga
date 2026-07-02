import { env } from '../../config/env.js';
import { prisma } from '../../db/client.js';

const DAY = 86_400_000;

export async function tmdbImages(
  type: 'tv' | 'movie',
  tmdbId: string,
): Promise<{ posters: string[]; backdrops: string[] } | null> {
  if (!env.TMDB_API_KEY && !env.TMDB_READ_ACCESS_TOKEN) return null;
  const cacheKey = `/images/${type}/${tmdbId}`;
  const cached = await prisma.apiCache.findUnique({
    where: { source_cacheKey: { source: 'tmdb', cacheKey } },
  });
  if (cached && cached.expiresAt > new Date()) return JSON.parse(cached.responseJson);

  const search = new URLSearchParams({ include_image_language: 'fr,en,null' });
  if (env.TMDB_API_KEY) search.set('api_key', env.TMDB_API_KEY);
  const headers: Record<string, string> = {};
  if (!env.TMDB_API_KEY && env.TMDB_READ_ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`;
  }
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/images?${search}`, { headers });
    if (!res.ok) return cached ? JSON.parse(cached.responseJson) : null;
    const data = (await res.json()) as {
      posters?: { file_path: string }[];
      backdrops?: { file_path: string }[];
    };
    const result = {
      posters: (data.posters ?? []).slice(0, 20).map((p) => p.file_path),
      backdrops: (data.backdrops ?? []).slice(0, 20).map((b) => b.file_path),
    };
    await prisma.apiCache.upsert({
      where: { source_cacheKey: { source: 'tmdb', cacheKey } },
      create: {
        source: 'tmdb',
        cacheKey,
        responseJson: JSON.stringify(result),
        expiresAt: new Date(Date.now() + 30 * DAY),
      },
      update: { responseJson: JSON.stringify(result), expiresAt: new Date(Date.now() + 30 * DAY) },
    });
    return result;
  } catch {
    return cached ? JSON.parse(cached.responseJson) : null;
  }
}
