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
  ds?: string;   // pre-harvested synopsis (Wikipedia FR / Google Books)
  cv?: string;   // pre-harvested cover thumbnail URL
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

// Index pré-normalisé : titres de séries et jetons des sous-titres de tomes.
// Sans lui, chaque frappe re-normalisait 573 titres et chaque résolution
// d'album re-découpait les 7669 sous-titres en jetons.
interface BdIndexRow {
  entry: CatalogueEntry;
  key: string;                      // titre de série normalisé
  volumes: Array<{ toks: string[]; weight: number }>;
}

let _index: BdIndexRow[] | null = null;

function bdIndex(): BdIndexRow[] {
  if (_index) return _index;
  _index = getData().series.map(entry => ({
    entry,
    key: norm(entry.title),
    volumes: entry.volumes
      .filter(v => !!v.s)
      .map(v => {
        const toks = tokens(v.s as string);
        return { toks, weight: toks.reduce((acc, t) => acc + t.length, 0) };
      })
      .filter(v => v.toks.length > 0 && v.weight >= MIN_MATCH_WEIGHT),
  }));
  return _index;
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
  for (const row of bdIndex()) {
    let score = 0;
    if (row.key === needle) score = 100;
    else if (row.key.startsWith(needle)) score = 80;
    else if (row.key.includes(needle)) score = 60;
    if (score > 0) results.push({ entry: row.entry, score });
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
  return bdIndex().find(row => row.key === needle)?.entry ?? null;
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
// Poids minimal (en caractères) pour qu'une correspondance de sous-titre soit
// digne de confiance — évite qu'un sous-titre générique comme « Le retour »
// ne se rattache à n'importe quel album.
const MIN_MATCH_WEIGHT = 10;

export function subtitleMatchWeight(subtitle: string, albumTitle: string): number {
  const albumToks = new Set(tokens(albumTitle));
  if (albumToks.size === 0) return 0;
  const subToks = tokens(subtitle);
  if (subToks.length === 0) return 0;
  if (!subToks.every(t => albumToks.has(t))) return 0;
  const weight = subToks.reduce((acc, t) => acc + t.length, 0);
  return weight >= MIN_MATCH_WEIGHT ? weight : 0;
}

/**
 * Find the parent series of an individual album title by matching volume
 * subtitles token-wise across the whole catalogue.
 */
export function findParentSeriesInCatalogue(albumTitle: string): string | null {
  const albumToks = new Set(tokens(albumTitle));
  if (albumToks.size === 0) return null;

  let best: { title: string; weight: number } | null = null;
  for (const row of bdIndex()) {
    for (const v of row.volumes) {
      if (best && v.weight <= best.weight) continue; // ne peut plus gagner
      if (!v.toks.every(t => albumToks.has(t))) continue;
      best = { title: row.entry.title, weight: v.weight };
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
    description: v.ds,
    coverImage: v.cv,
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
    // Nombre de tomes RÉELLEMENT connus, pas le plus grand ordinal : 165 des
    // 573 séries du catalogue ont des trous (Ranma ½ : dernier tome n°52 mais
    // 15 tomes présents). Annoncer 52 pour 15 cartes rendait la progression
    // impossible à terminer.
    totalVolumes: volumes.length,
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
