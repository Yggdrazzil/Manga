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
import { findCatalogueEntry, findParentSeriesInCatalogue, toCatalogueWikidataSeries } from '../catalogue';
import { searchBnFSeries } from './bnf';
import { searchGoogleBooksSeries } from './googlebooks';
import { searchSeriesVolumes, extractVolumeNumber, seriesKeyFromTitle } from './openlib';
import { getWikipediaAlbumList, getWikipediaSeriesSummary } from './wikipedia';
import { findParentSeriesTitle, searchWikidataSeries } from './wikidata';

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
  _resolved = false,
): Promise<BDSeries | null> {
  const seriesId = seriesKeyFromTitle(seriesTitle);

  // Local catalogue fast path: skip Wikidata SPARQL when we already have the data.
  const catalogueEntry = findCatalogueEntry(seriesTitle);

  // The caller may have passed an individual album title (e.g. the long
  // original « Les Aventures de Tintin, reporter du "Petit Vingtième", au pays
  // des Soviets »). The catalogue resolves it to its parent series instantly —
  // before wasting a full pipeline run that would come back empty.
  if (!catalogueEntry && !_resolved) {
    const parent = findParentSeriesInCatalogue(seriesTitle);
    if (parent && parent !== seriesTitle) {
      return consolidateBDSeries(parent, authorHint, true);
    }
  }

  const wdPromise = catalogueEntry
    ? Promise.resolve(toCatalogueWikidataSeries(catalogueEntry))
    : searchWikidataSeries(seriesTitle);

  // Fire all sources in parallel — failures are silenced via allSettled
  const [wdResult, bnfResult, gbResult, olResult, wikiResult, wpListResult] = await Promise.allSettled([
    wdPromise,
    searchBnFSeries(seriesTitle),
    searchGoogleBooksSeries(seriesTitle),
    searchSeriesVolumes(seriesTitle),
    getWikipediaSeriesSummary(seriesTitle),
    getWikipediaAlbumList(seriesTitle),
  ]);

  const wd = wdResult.status === 'fulfilled' ? wdResult.value : { albums: [], authors: [] };
  const wdAlbums = wd.albums;
  const bnfTomes = bnfResult.status === 'fulfilled' ? bnfResult.value : [];
  const gbItems  = gbResult.status  === 'fulfilled' ? gbResult.value  : [];
  const olData   = olResult.status  === 'fulfilled' ? olResult.value  : { volumes: [], totalVolumes: 0 };
  const seriesDescription = wikiResult.status === 'fulfilled' ? wikiResult.value : undefined;
  const wpAlbums = wpListResult.status === 'fulfilled' ? wpListResult.value : [];

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
  for (const wdAlbum of wdAlbums) {
    const existing = map.get(wdAlbum.num);
    map.set(wdAlbum.num, {
      num: wdAlbum.num,
      workId: existing?.workId,
      title: existing?.title ?? `${seriesTitle} tome ${wdAlbum.num}`,
      subtitle: wdAlbum.title || existing?.subtitle,
      coverImage: existing?.coverImage,
      description: existing?.description,
      publisher: existing?.publisher,
      publishedDate: wdAlbum.date || existing?.publishedDate,
      authors: existing?.authors ?? [],
      frwikiTitle: wdAlbum.frwikiTitle,
    });
  }

  // Layer 2b — Wikipedia FR album list (freshest source for new albums:
  // catalogues often file late releases under standalone titles that escape
  // series queries — e.g. Lanfeust de Troy 9, "La forêt noiseuse")
  for (const wpAlbum of wpAlbums) {
    const existing = map.get(wpAlbum.num);
    map.set(wpAlbum.num, {
      num: wpAlbum.num,
      workId: existing?.workId,
      title: existing?.title ?? `${seriesTitle} tome ${wpAlbum.num}`,
      subtitle: existing?.subtitle || wpAlbum.title,
      coverImage: existing?.coverImage,
      description: existing?.description,
      publisher: existing?.publisher,
      publishedDate: existing?.publishedDate || wpAlbum.date,
      authors: existing?.authors ?? [],
      frwikiTitle: existing?.frwikiTitle,
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
      frwikiTitle: existing?.frwikiTitle,
    });
  }

  // Layer 3b — bundled per-volume synopsis/cover (pre-harvested from
  // Wikipedia FR & Google Books by scripts/enrich-bd-volumes.mjs)
  if (catalogueEntry) {
    for (const cv of catalogueEntry.volumes) {
      const existing = map.get(cv.n);
      if (!existing) continue;
      if ((cv.ds && !existing.description) || (cv.cv && !existing.coverImage)) {
        map.set(cv.n, {
          ...existing,
          description: existing.description || cv.ds,
          coverImage: existing.coverImage || cv.cv,
        });
      }
    }
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

  // No volumes found — the caller may have passed an individual album title
  // (e.g. "Tintin en Amérique") instead of a series title. Ask Wikidata whether
  // there is a P179 (part of the series) parent and retry once with that title.
  // The _resolved guard prevents infinite recursion.
  if (volumes.length === 0) {
    if (!_resolved) {
      const parent = await findParentSeriesTitle(seriesTitle);
      if (parent && parent !== seriesTitle) {
        return consolidateBDSeries(parent, authorHint, true);
      }
    }
    return null;
  }

  // Nombre de tomes connus, et non le plus grand ordinal : une série dont les
  // sources ne remontent que les tomes 1, 2 et 47 compte 3 tomes, pas 47.
  const totalVolumes = volumes.length;

  // Best cover: tome 1 first, then any tome with a cover, then the bundled
  // Wikipedia thumbnail from the catalogue
  const bestCover =
    (volumes.find(v => v.num === 1) ?? volumes.find(v => v.coverImage))?.coverImage ??
    catalogueEntry?.cover;

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
    description: seriesDescription ?? catalogueEntry?.desc,
    totalVolumes,
    volumes,
    type: 'BD',
  };
}
