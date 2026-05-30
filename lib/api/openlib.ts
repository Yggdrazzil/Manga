import type { BDVolume } from '../types';

const BASE_SEARCH = 'https://openlibrary.org/search.json';
const BASE_WORKS = 'https://openlibrary.org/works';
const BASE_COVERS = 'https://covers.openlibrary.org/b/id';

export interface OLBook {
  id: string;            // e.g. "OL24228254W"
  title: string;
  authors: string[];
  coverImage?: string;
  description?: string;
  publisher?: string;
  publishedDate?: string;
  categories: string[];
}

interface OLSearchDoc {
  key: string;           // "/works/OL24228254W"
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  subject?: string[];
  publisher?: string[];
}

interface OLWorkDetail {
  key: string;
  title: string;
  covers?: number[];
  description?: string | { value: string };
  subjects?: string[];
  subtitle?: string;
}

interface OLEdition {
  title?: string;
  subtitle?: string;
  publishers?: string[];
  description?: string | { value: string };
  languages?: Array<{ key: string }>;
  number_of_pages?: number;
}

function coverUrl(coverId: number): string {
  return `${BASE_COVERS}/${coverId}-L.jpg`;
}

function extractWorkId(key: string): string {
  return key.replace('/works/', '');
}

function cleanSubjects(subjects: string[] | undefined): string[] {
  if (!subjects) return [];
  return subjects
    .filter(s => !s.startsWith('series:') && !s.includes('(Fictitious') && s.length < 40)
    .slice(0, 5);
}

function normalizeDoc(doc: OLSearchDoc): OLBook {
  return {
    id: extractWorkId(doc.key),
    title: doc.title,
    authors: doc.author_name ?? [],
    coverImage: doc.cover_i ? coverUrl(doc.cover_i) : undefined,
    publisher: doc.publisher?.[0],
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
    categories: cleanSubjects(doc.subject),
  };
}

// ── Volume / series utilities (exported for use in search + store) ────────────

export function extractVolumeNumber(title: string): number | undefined {
  // Ordered from most-specific to least-specific to avoid false matches
  const patterns = [
    /\btome\s+(\d+)/i,          // "tome 8"
    /\bt\.\s*(\d+)/i,           // "t. 3", "T.01"
    /\bT0*(\d+)\b/,             // "T01", "T8" (OL abbreviation style)
    /\bvol(?:ume)?\.?\s*(\d+)/i,// "vol. 2", "volume 12"
    /#(\d+)/,                   // "#5"
    /\(\s*(\d{1,2})\s*\)$/,     // "(1)" at end
    /[-\s]\s*0*(\d{1,3})\s*$/,  // "- 1" or " 3" bare trailing digit
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n < 1000) return n;
    }
  }
  return undefined;
}

export function seriesKeyFromTitle(title: string): string {
  return title
    .replace(/[,\s]+tome\s+\d+\b.*/i, '')
    .replace(/[,\s]+t\.\s*\d+\b.*/i, '')
    .replace(/[,\s]+T0*\d+\b.*/i, '')
    .replace(/[,\s]+vol(?:ume)?\.?\s*\d+\b.*/i, '')
    .replace(/\s+#\d+\b.*/i, '')
    .replace(/\s*\(\s*\d+\s*\)$/, '')
    .replace(/[-\s]\s*\d+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function seriesTitleFromFull(title: string): string {
  return title
    .replace(/[,\s]+tome\s+\d+\b.*/i, '')
    .replace(/[,\s]+t\.\s*\d+\b.*/i, '')
    .replace(/[,\s]+T0*\d+\b.*/i, '')
    .replace(/[,\s]+vol(?:ume)?\.?\s*\d+\b.*/i, '')
    .replace(/\s+#\d+\b.*/i, '')
    .replace(/\s*\(\s*\d+\s*\)$/, '')
    .trim();
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchComics(
  query: string,
  offset = 0,
  limit = 20,
): Promise<{ items: OLBook[]; hasMore: boolean; total: number }> {
  if (!query.trim()) return { items: [], hasMore: false, total: 0 };

  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(offset),
    fields: 'key,title,author_name,cover_i,first_publish_year,subject,publisher',
  });

  const res = await fetch(`${BASE_SEARCH}?${params}`);
  if (!res.ok) throw new Error(`Open Library error: ${res.status}`);
  const data = await res.json() as { numFound: number; docs: OLSearchDoc[] };

  const items = (data.docs ?? []).map(normalizeDoc).filter(b => b.coverImage);
  return { items, hasMore: offset + items.length < data.numFound, total: data.numFound };
}

// ── Series: fetch all volumes for a given series title ────────────────────────

export async function searchSeriesVolumes(
  seriesTitle: string,
): Promise<{ volumes: BDVolume[]; totalVolumes: number }> {
  const result = await searchComics(seriesTitle, 0, 40);
  const targetKey = seriesKeyFromTitle(seriesTitle);

  // Keep only items belonging to this series, with a detectable volume number.
  // If multiple editions exist for the same tome, prefer the one with a cover.
  const byNum = new Map<number, BDVolume>();
  for (const item of result.items) {
    if (seriesKeyFromTitle(item.title) !== targetKey) continue;
    const num = extractVolumeNumber(item.title);
    if (!num) continue;
    const existing = byNum.get(num);
    if (!existing || (!existing.coverImage && item.coverImage)) {
      byNum.set(num, {
        num,
        workId: item.id,
        title: item.title,
        coverImage: item.coverImage,
        publisher: item.publisher,
        publishedDate: item.publishedDate,
        authors: item.authors,
      });
    }
  }

  const volumes = Array.from(byNum.values()).sort((a, b) => a.num - b.num);
  const totalVolumes = volumes.length > 0 ? volumes[volumes.length - 1].num : 0;
  return { volumes, totalVolumes };
}

// ── Per-volume detail: subtitle + description + publisher (lazy) ──────────────

export async function getVolumeDetail(
  workId: string,
): Promise<{ description?: string; subtitle?: string; publisher?: string }> {
  const [workRes, editionsRes] = await Promise.allSettled([
    fetch(`${BASE_WORKS}/${workId}.json`),
    fetch(`${BASE_WORKS}/${workId}/editions.json?limit=10`),
  ]);

  let description: string | undefined;
  let subtitle: string | undefined;
  let publisher: string | undefined;

  if (workRes.status === 'fulfilled' && workRes.value.ok) {
    const work = await workRes.value.json() as OLWorkDetail;
    const raw = work.description;
    description = typeof raw === 'string' ? raw : raw?.value;
    if (work.subtitle) subtitle = work.subtitle;
  }

  if (editionsRes.status === 'fulfilled' && editionsRes.value.ok) {
    const data = await editionsRes.value.json() as { entries?: OLEdition[] };
    // Prefer a French edition for subtitle/publisher
    const entries = data.entries ?? [];
    const preferred =
      entries.find(e => e.languages?.some(l => l.key === '/languages/fre')) ??
      entries[0];
    if (preferred) {
      if (!subtitle && preferred.subtitle) subtitle = preferred.subtitle;
      if (!publisher && preferred.publishers?.[0]) publisher = preferred.publishers[0];
      if (!description) {
        const raw = preferred.description;
        if (raw) description = typeof raw === 'string' ? raw : raw.value;
      }
    }
  }

  return { description, subtitle, publisher };
}
