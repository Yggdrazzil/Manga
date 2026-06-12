/**
 * Local BD catalogue — pre-compiled from Wikidata, refreshed weekly by CI.
 *
 * Used as the fast path in consolidateBDSeries: if the series is known locally,
 * the Wikidata SPARQL round-trip is skipped entirely (saves ~2 s per lookup).
 * Falls back to the live API pipeline when the catalogue has no entry.
 */

import type { WikidataSeries } from '../api/wikidata';
import type { BDSeries } from '../types';
import { seriesKeyFromTitle } from '../api/openlib';

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
  desc?: string;   // Wikipedia FR series synopsis (trimmed)
  cover?: string;  // Wikipedia FR page thumbnail URL
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
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

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Token-subset match between a volume subtitle and a (possibly longer) album
 * title. Returns a confidence weight (total matched characters), or 0 when the
 * subtitle's tokens don't all appear in the title or the match is too short to
 * trust. Token matching handles long original titles — « Les Aventures de
 * Tintin, reporter du "Petit Vingtième", au pays des Soviets » matches the
 * subtitle "Tintin au pays des Soviets" even though plain substring
 * containment fails.
 */
export function subtitleMatchWeight(subtitle: string, albumTitle: string): number {
  const albumToks = new Set(tokens(albumTitle));
  if (albumToks.size === 0) return 0;
  const subToks = tokens(subtitle);
  if (subToks.length === 0) return 0;
  if (!subToks.every(t => albumToks.has(t))) return 0;
  // Total character weight guards against generic short subtitles
  // ("Le retour") matching unrelated albums.
  const weight = subToks.reduce((acc, t) => acc + t.length, 0);
  return weight >= 10 ? weight : 0;
}

/**
 * Find the parent series of an individual album title by matching volume
 * subtitles token-wise across the whole catalogue.
 */
export function findParentSeriesInCatalogue(albumTitle: string): string | null {
  let best: { title: string; weight: number } | null = null;
  for (const entry of getData().series) {
    for (const v of entry.volumes) {
      if (!v.s) continue;
      const weight = subtitleMatchWeight(v.s, albumTitle);
      if (weight === 0) continue;
      if (!best || weight > best.weight) best = { title: entry.title, weight };
    }
  }
  return best?.title ?? null;
}

/**
 * Build a provisional BDSeries straight from the catalogue — no network.
 * Used as placeholderData so the series screen renders instantly while the
 * full consolidation pipeline (covers, descriptions, publishers) runs.
 */
export function catalogueToBDSeries(entry: CatalogueEntry): BDSeries {
  const volumes = entry.volumes.map(v => ({
    num: v.n,
    title: `${entry.title} tome ${v.n}`,
    subtitle: v.s,
    publishedDate: v.d,
    authors: entry.authors,
    frwikiTitle: v.w,
  }));
  return {
    id: seriesKeyFromTitle(entry.title),
    title: entry.title,
    authors: entry.authors,
    coverImage: entry.cover,
    description: entry.desc,
    totalVolumes: volumes.length > 0 ? volumes[volumes.length - 1].num : 0,
    volumes,
    type: 'BD',
  };
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
