/**
 * Local BD catalogue — pre-compiled from Wikidata, refreshed weekly by CI.
 *
 * Used as the fast path in consolidateBDSeries: if the series is known locally,
 * the Wikidata SPARQL round-trip is skipped entirely (saves ~2 s per lookup).
 * Falls back to the live API pipeline when the catalogue has no entry.
 */

import type { WikidataSeries } from '../api/wikidata';

export interface CatalogueVolume {
  n: number;     // ordinal
  s?: string;    // subtitle (French album title from Wikidata label)
  d?: string;    // ISO publication date
  w?: string;    // Wikipedia FR article title for per-volume synopsis
}

export interface CatalogueEntry {
  qid: string;
  title: string;
  authors: string[];
  frwikiTitle?: string;
  volumes: CatalogueVolume[];
}

interface Catalogue {
  version: string;
  series: CatalogueEntry[];
}

let _data: Catalogue | null = null;

function getData(): Catalogue {
  if (_data) return _data;
  try {
    // Metro bundles JSON files natively; require() is synchronous here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _data = require('../../assets/bd-catalogue.json') as Catalogue;
  } catch {
    _data = { version: '', series: [] };
  }
  return _data;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Case-insensitive, accent-insensitive catalogue search.
 * Returns up to `limit` series sorted by match quality (exact > prefix > substring).
 */
export function searchCatalogue(query: string, limit = 20): CatalogueEntry[] {
  if (!query.trim()) return [];
  const needle = norm(query);
  if (!needle) return [];

  const results: Array<{ entry: CatalogueEntry; score: number }> = [];
  for (const entry of getData().series) {
    const hay = norm(entry.title);
    let score = 0;
    if (hay === needle) score = 100;
    else if (hay.startsWith(needle)) score = 80;
    else if (hay.includes(needle)) score = 60;
    if (score > 0) results.push({ entry, score });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.entry);
}

/**
 * Exact-title lookup (accent/case-insensitive).
 * Returns null when the series isn't in the local catalogue.
 */
export function findCatalogueEntry(title: string): CatalogueEntry | null {
  const needle = norm(title);
  return getData().series.find(e => norm(e.title) === needle) ?? null;
}

/**
 * Convert a catalogue entry into the WikidataSeries shape expected by
 * consolidateBDSeries, so the live Wikidata SPARQL call can be skipped.
 */
export function toCatalogueWikidataSeries(entry: CatalogueEntry): WikidataSeries {
  return {
    albums: entry.volumes.map(v => ({
      num: v.n,
      title: v.s ?? '',
      date: v.d,
      wikidataId: entry.qid,
      frwikiTitle: v.w,
    })),
    authors: entry.authors,
  };
}
