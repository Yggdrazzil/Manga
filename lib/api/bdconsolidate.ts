/**
 * Multi-source BD consolidation pipeline.
 *
 * Called ONCE when the user adds a series (+ tap on search result).
 * Runs all sources in parallel, merges the best available data, and returns
 * a complete BDSeries ready to persist — or null when no source knows the
 * series (callers surface "introuvable" instead of a fabricated empty entry).
 *
 * Source priority:
 *   Structure (tome nums + French titles) : Wikidata > BnF SRU > Open Library
 *   Publication dates                     : Wikidata > BnF     > GB/OL
 *   Publisher                             : BnF      > Google Books > OL
 *   Per-volume description (FR)           : Google Books             > OL
 *   Cover images                          : Open Library             > Google Books
 *   Series synopsis                       : Wikipedia FR
 */

import type { BDSeries, BDVolume } from '../types';
import { searchBnFSeries } from './bnf';
import { searchGoogleBooksSeries } from './googlebooks';
import { searchSeriesVolumes, extractVolumeNumber, seriesKeyFromTitle } from './openlib';
import { getWikipediaSeriesSummary } from './wikipedia';
import { searchWikidataSeries } from './wikidata';

// ── Google Books matcher ──────────────────────────────────────────────────────

function normalizeForMatch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

// Given GB results for a series, find the best match for a specific tome.
// Strategy: match by volume number from title, or by episode title substring.
function findGBMatch(
  gbItems: Awaited<ReturnType<typeof searchGoogleBooksSeries>>,
  tomeNum: number,
  episodeTitle?: string,
) {
  // 1. By explicit volume number in the GB title
  const byNum = gbItems.filter(it => {
    const n = extractVolumeNumber(it.volumeInfo.title ?? '');
    return n === tomeNum;
  });
  if (byNum.length === 1) return byNum[0];
  // Among multiple matches, pick the one with a description
  if (byNum.length > 1) return byNum.find(it => it.volumeInfo.description) ?? byNum[0];

  // 2. By episode title substring
  if (episodeTitle) {
    const key = normalizeForMatch(episodeTitle);
    const byTitle = gbItems.find(it =>
      normalizeForMatch(it.volumeInfo.title ?? '').includes(key) ||
      normalizeForMatch(it.volumeInfo.subtitle ?? '').includes(key),
    );
    if (byTitle) return byTitle;
  }

  return undefined;
}

// ── Main consolidation ────────────────────────────────────────────────────────

export async function consolidateBDSeries(
  seriesTitle: string,
  authorHint?: string,
): Promise<BDSeries | null> {
  const seriesId = seriesKeyFromTitle(seriesTitle);

  // Fire all sources in parallel — failures are silenced via allSettled
  const [wdResult, bnfResult, gbResult, olResult, wikiResult] = await Promise.allSettled([
    searchWikidataSeries(seriesTitle),
    searchBnFSeries(seriesTitle),
    searchGoogleBooksSeries(seriesTitle),
    searchSeriesVolumes(seriesTitle),
    getWikipediaSeriesSummary(seriesTitle),
  ]);

  const wd = wdResult.status === 'fulfilled' ? wdResult.value : { albums: [], authors: [] };
  const wdAlbums = wd.albums;
  const bnfTomes = bnfResult.status === 'fulfilled' ? bnfResult.value : [];
  const gbItems  = gbResult.status  === 'fulfilled' ? gbResult.value  : [];
  const olData   = olResult.status  === 'fulfilled' ? olResult.value  : { volumes: [], totalVolumes: 0 };
  const seriesDescription = wikiResult.status === 'fulfilled' ? wikiResult.value : undefined;

  // ── Build volume map ────────────────────────────────────────────────────────
  const map = new Map<number, BDVolume>();

  // Layer 1 — Open Library (provides cover images + OL workId)
  for (const olVol of olData.volumes) {
    map.set(olVol.num, {
      num: olVol.num,
      workId: olVol.workId,
      title: olVol.title,
      subtitle: undefined,
      coverImage: olVol.coverImage,
      description: undefined,
      publisher: olVol.publisher,
      publishedDate: olVol.publishedDate,
      authors: olVol.authors,
    });
  }

  // Layer 2 — Wikidata (authoritative album structure: ordinals, FR titles, dates)
  for (const wd of wdAlbums) {
    const existing = map.get(wd.num);
    map.set(wd.num, {
      num: wd.num,
      workId: existing?.workId,
      title: existing?.title ?? `${seriesTitle} tome ${wd.num}`,
      subtitle: wd.title || existing?.subtitle,
      coverImage: existing?.coverImage,
      description: existing?.description,
      publisher: existing?.publisher,
      publishedDate: wd.date || existing?.publishedDate,
      authors: existing?.authors ?? [],
    });
  }

  // Layer 3 — BnF (publisher + authors, subtitle fallback)
  for (const bnf of bnfTomes) {
    const existing = map.get(bnf.num);
    map.set(bnf.num, {
      num: bnf.num,
      workId: existing?.workId,
      title: existing?.title ?? `${seriesTitle} tome ${bnf.num}`,
      subtitle: existing?.subtitle || bnf.episode,
      coverImage: existing?.coverImage,
      description: existing?.description,
      publisher: bnf.publisher || existing?.publisher,
      publishedDate: existing?.publishedDate || bnf.publishedDate,
      authors: bnf.authors.length > 0 ? bnf.authors : (existing?.authors ?? []),
    });
  }

  // Layer 4 — Google Books (FR descriptions + cover fallback)
  for (const [num, vol] of map) {
    const match = findGBMatch(gbItems, num, vol.subtitle);
    if (!match) continue;
    const info = match.volumeInfo;
    map.set(num, {
      ...vol,
      description: vol.description || (info.description ?? undefined),
      coverImage: vol.coverImage || info.imageLinks?.thumbnail,
      publisher: vol.publisher || info.publisher,
      publishedDate: vol.publishedDate || info.publishedDate,
    });
  }

  // Ensure every BnF tome appears even if OL/GB had no match
  for (const bnf of bnfTomes) {
    if (!map.has(bnf.num)) {
      const match = findGBMatch(gbItems, bnf.num, bnf.episode);
      map.set(bnf.num, {
        num: bnf.num,
        title: `${seriesTitle} tome ${bnf.num}`,
        subtitle: bnf.episode,
        coverImage: match?.volumeInfo.imageLinks?.thumbnail,
        description: match?.volumeInfo.description,
        publisher: bnf.publisher || match?.volumeInfo.publisher,
        publishedDate: bnf.publishedDate || match?.volumeInfo.publishedDate,
        authors: bnf.authors.length > 0 ? bnf.authors
          : (match?.volumeInfo.authors ?? []),
      });
    }
  }

  const volumes = Array.from(map.values()).sort((a, b) => a.num - b.num);

  // No source knows this series — don't fabricate an empty entry
  if (volumes.length === 0) return null;

  const totalVolumes = volumes[volumes.length - 1].num;

  // Best cover: tome 1 first, then any tome with a cover
  const bestCover = (volumes.find(v => v.num === 1) ?? volumes.find(v => v.coverImage))?.coverImage;

  // Best authors: Wikidata labels are cleanest, then BnF, then OL
  const bnfAuthors = bnfTomes[0]?.authors.filter(Boolean).slice(0, 3);
  const bestAuthors =
    (wd.authors.length ? wd.authors.slice(0, 3) : undefined) ??
    (bnfAuthors?.length ? bnfAuthors : undefined) ??
    olData.volumes[0]?.authors ??
    (authorHint ? [authorHint] : []);

  return {
    id: seriesId,
    title: seriesTitle,
    authors: bestAuthors,
    coverImage: bestCover,
    description: seriesDescription,
    totalVolumes,
    volumes,
    type: 'BD',
  };
}
