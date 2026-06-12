import type { Manga, MangaChapter, MediaType, OngoingStatus, PaginatedResult } from '../types';

// comick.fun's DNS is gone — the API now lives on comick.dev.
const BASE = 'https://api.comick.dev';
const CDN = 'https://meo.comick.pictures';

// ── Raw Comick API types ──────────────────────────────────────────────────────

interface CKCover {
  b2key: string;
  vol?: string | null;
}

interface CKSearchResult {
  hid: string;
  title: string;
  slug: string;
  country?: string;
  demographic?: number | null;
  genres?: Array<{ name: string }>;
  status?: number;
  year?: number | null;
  last_chapter?: number | null;
  md_covers?: CKCover[];
  authors?: Array<{ name: string; role?: string }>;
  artists?: Array<{ name: string }>;
  availableLanguages?: string[];
}

interface CKComicDetail {
  comic: CKSearchResult & {
    desc?: string | null;
    last_chapter?: number | null;
    volume_count?: number | null;
    links?: Record<string, string>;
  };
  genres?: Array<{ name: string }>;
  authors?: Array<{ name: string; role?: string }>;
  artists?: Array<{ name: string }>;
  availableLanguages?: string[];
}

interface CKChapter {
  id: number;
  chap?: string | null;
  vol?: string | null;
  title?: string | null;
  lang: string;
  hid: string;
  created_at: string;
  updated_at: string;
  group_name?: string[];
}

interface CKChapterFeedResponse {
  chapters: CKChapter[];
  total: number;
}

interface CKChapterDetail {
  chapter: {
    chap?: string | null;
    vol?: string | null;
    title?: string | null;
    images: Array<{ url: string; b2key?: string }>;
    md_images?: Array<{ b2key: string; w?: number; h?: number }>;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// 1=ongoing, 2=completed, 3=cancelled, 4=hiatus
const STATUS_MAP: Record<number, OngoingStatus> = {
  1: 'ONGOING',
  2: 'COMPLETED',
  3: 'CANCELLED',
  4: 'HIATUS',
};

// Comick country codes → media type
function inferType(country?: string, genres?: Array<{ name: string }>): MediaType {
  const gs = (genres ?? []).map(g => g.name.toLowerCase());
  if (gs.includes('webtoon')) return 'WEBTOON';
  if (country === 'kr') return gs.includes('webtoon') ? 'WEBTOON' : 'MANHWA';
  if (country === 'cn' || country === 'hk') return 'MANHUA';
  return 'MANGA';
}

function coverUrl(covers?: CKCover[]): string {
  const first = covers?.find(c => c.b2key);
  return first ? `${CDN}/${first.b2key}` : '';
}

function normalizeAuthors(
  authors?: Array<{ name: string; role?: string }>,
  artists?: Array<{ name: string }>,
): string[] {
  const all: string[] = [
    ...(authors ?? []).map(a => a.name),
    ...(artists ?? []).map(a => a.name),
  ];
  return [...new Set(all.filter(Boolean))];
}

async function fetchCK<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'MangaApp/1.0 tachiyomi' },
  });
  if (!res.ok) throw new Error(`Comick error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

function normalizeSearch(r: CKSearchResult): Manga {
  const readLangs = (r.availableLanguages ?? []).filter(l => l === 'fr' || l === 'en');
  return {
    id: r.hid,
    source: 'comick',
    title: { userPreferred: r.title, english: r.title },
    coverImage: coverUrl(r.md_covers),
    type: inferType(r.country, r.genres),
    genres: (r.genres ?? []).map(g => g.name),
    tags: [],
    status: STATUS_MAP[r.status ?? 1] ?? 'ONGOING',
    year: r.year ?? undefined,
    authors: normalizeAuthors(r.authors, r.artists),
    countryOfOrigin: r.country,
    chapters: r.last_chapter ?? undefined,
    availableReadingLanguages: readLangs.length > 0 ? readLangs : undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchManga(
  query: string,
  page = 1,
  perPage = 20,
): Promise<PaginatedResult<Manga>> {
  const data = await fetchCK<CKSearchResult[]>('/v1.0/search/', {
    q: query,
    tachiyomi: 'true',
    type: 'comic',
    sort: 'view',
    limit: perPage,
    page,
  });

  return {
    items: (data ?? []).map(normalizeSearch),
    hasNextPage: data?.length === perPage,
    currentPage: page,
  };
}

export async function getMangaById(hid: string): Promise<Manga> {
  const data = await fetchCK<CKComicDetail>(`/comic/${hid}`, { tachiyomi: 'true' });
  const c = data.comic;
  const readLangs = (data.availableLanguages ?? []).filter(l => l === 'fr' || l === 'en');
  const authors = normalizeAuthors(data.authors ?? c.authors, data.artists ?? c.artists);

  return {
    id: c.hid,
    source: 'comick',
    title: { userPreferred: c.title, english: c.title },
    coverImage: coverUrl(c.md_covers),
    description: c.desc ?? undefined,
    type: inferType(c.country, data.genres ?? c.genres),
    genres: (data.genres ?? c.genres ?? []).map(g => g.name),
    tags: [],
    status: STATUS_MAP[c.status ?? 1] ?? 'ONGOING',
    year: c.year ?? undefined,
    authors,
    countryOfOrigin: c.country,
    chapters: c.last_chapter ?? undefined,
    volumes: c.volume_count ?? undefined,
    availableReadingLanguages: readLangs.length > 0 ? readLangs : undefined,
  };
}

function normalizeChapter(ch: CKChapter, mangaId: string): MangaChapter {
  return {
    id: ch.hid,
    mangaId,
    chapter: ch.chap ?? '0',
    volume: ch.vol ?? undefined,
    title: ch.title ?? undefined,
    pages: 0, // Comick doesn't return page count in feed; fetched lazily
    publishAt: ch.created_at,
    translatedLanguage: ch.lang,
    isReadable: true,
  };
}

export async function getTrackingChapters(
  hid: string,
  lang?: string[],
): Promise<MangaChapter[]> {
  const languages = lang ?? ['fr', 'en'];
  const limit = 100;
  const chapters: MangaChapter[] = [];
  // Shared across languages: the first language wins a chapter number, the
  // second only fills numbers the first didn't have.
  const seen = new Set<string>();

  for (const l of languages) {
    let page = 1;
    let fetched = 0;
    let total = Infinity;

    while (fetched < total || page === 1) {
      const data = await fetchCK<CKChapterFeedResponse>(`/comic/${hid}/chapters`, {
        lang: l,
        limit,
        page,
        'chap-order': 1, // ascending
        tachiyomi: 'true',
      });

      if (page === 1) total = data.total ?? 0;
      const batch = data.chapters ?? [];
      fetched += batch.length;

      for (const ch of batch) {
        // Trust but verify: the API has returned off-language chapters in the
        // past, and one bad hid means the reader renders the wrong language.
        if (ch.lang !== l) continue;
        const num = ch.chap ?? 'none';
        if (seen.has(num)) continue;
        seen.add(num);
        chapters.push(normalizeChapter(ch, hid));
      }

      if (batch.length < limit || fetched >= total) break;
      page += 1;

      if (page > 30) break; // safety
    }
  }

  return chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
}

export async function getChapterPages(hid: string): Promise<string[]> {
  const data = await fetchCK<CKChapterDetail>(`/chapter/${hid}`);
  const images = data.chapter?.images ?? [];

  return images.map(img => {
    // Prefer direct URL if present, fall back to CDN + b2key
    if (img.url && img.url.startsWith('http')) return img.url;
    if (img.b2key) return `${CDN}/${img.b2key}`;
    return img.url ?? '';
  }).filter(Boolean);
}

export async function findComickId(title: string): Promise<string | null> {
  try {
    const data = await fetchCK<CKSearchResult[]>('/v1.0/search/', {
      q: title,
      tachiyomi: 'true',
      limit: 5,
    });
    if (!data?.length) return null;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const q = norm(title);
    for (const r of data) {
      if (norm(r.title) === q) return r.hid;
    }
    return data[0]?.hid ?? null;
  } catch {
    return null;
  }
}
