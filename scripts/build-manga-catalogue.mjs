#!/usr/bin/env node
/**
 * Builds assets/manga-catalogue.json from AniList GraphQL.
 *
 * Top 5000 manga/manhwa/manhua by popularity (AniList caps listing at 5000),
 * with titles, synonyms, cover/banner URLs, trimmed descriptions, genres,
 * authors and MangaDex IDs. Bundled by Metro for instant local search and
 * instant detail-screen first paint.
 *
 * Usage:  node scripts/build-manga-catalogue.mjs
 * Needs:  Node 20+
 * Time:   ~4 minutes (rate-limited to stay under AniList's 30 req/min)
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'assets', 'manga-catalogue.json');
const API = 'https://graphql.anilist.co';
const PER_PAGE = 50;
const MAX_PAGES = 100; // AniList caps POPULARITY_DESC at 5000 entries
const DELAY_MS = 2200; // ≤ ~27 req/min, under the degraded 30/min limit

const QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(sort: POPULARITY_DESC, type: MANGA, isAdult: false) {
      id
      title { romaji english native userPreferred }
      synonyms
      coverImage { large extraLarge color }
      bannerImage
      description(asHtml: false)
      status
      chapters
      volumes
      averageScore
      popularity
      startDate { year }
      genres
      countryOfOrigin
      externalLinks { url site }
      staff(sort: RELEVANCE, page: 1, perPage: 4) {
        edges { node { name { full } } role }
      }
    }
  }
}
`;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPage(page, attempt = 0) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { page, perPage: PER_PAGE } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10);
      console.warn(`  Rate-limited, waiting ${retryAfter}s...`);
      await sleep(retryAfter * 1000 + 1000);
      return fetchPage(page, attempt);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.errors) throw new Error(data.errors[0]?.message ?? 'GraphQL error');
    return data.data.Page;
  } catch (err) {
    if (attempt < 3) {
      console.warn(`  Page ${page} failed (${err.message}), retrying...`);
      await sleep((attempt + 1) * 5_000);
      return fetchPage(page, attempt + 1);
    }
    throw err;
  }
}

function trimDescription(desc) {
  if (!desc) return undefined;
  const clean = desc
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return undefined;
  if (clean.length <= 400) return clean;
  // Cut at the last sentence end before 400 chars, else hard-trim
  const slice = clean.slice(0, 400);
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return lastStop > 150 ? slice.slice(0, lastStop + 1) : `${slice}…`;
}

// Prefix match: roles carry volume annotations ("Story & Art (vols 1-41)")
const isAuthorRole = role => /^(story\b|original story)/i.test(role);

function compact(m) {
  const authors = [...new Set(
    m.staff.edges.filter(e => isAuthorRole(e.role)).map(e => e.node.name.full),
  )];

  const mdLink = (m.externalLinks ?? []).find(
    l => l.site === 'MangaDex' || (l.url && l.url.includes('mangadex.org/title/')),
  );
  const mangadexId = mdLink?.url?.match(/mangadex\.org\/title\/([0-9a-f-]+)/)?.[1];

  // Synonyms: keep only short latin-script aliases useful for search
  const synonyms = (m.synonyms ?? [])
    .filter(s => s && s.length <= 60 && /[a-zA-Z]/.test(s))
    .slice(0, 4);

  const entry = {
    i: m.id,
    t: {
      r: m.title.romaji ?? undefined,
      e: m.title.english ?? undefined,
      n: m.title.native ?? undefined,
      u: m.title.userPreferred,
    },
    c: m.coverImage.extraLarge ?? m.coverImage.large ?? '',
    st: m.status,
    g: m.genres ?? [],
    a: authors,
  };
  if (synonyms.length) entry.sy = synonyms;
  if (m.bannerImage) entry.b = m.bannerImage;
  if (m.coverImage.color) entry.col = m.coverImage.color;
  const d = trimDescription(m.description);
  if (d) entry.d = d;
  if (m.chapters) entry.ch = m.chapters;
  if (m.volumes) entry.vo = m.volumes;
  if (m.averageScore) entry.sc = m.averageScore;
  if (m.popularity) entry.pop = m.popularity;
  if (m.startDate?.year) entry.y = m.startDate.year;
  if (m.countryOfOrigin) entry.co = m.countryOfOrigin;
  if (mangadexId) entry.md = mangadexId;
  return entry;
}

const entries = [];
const seen = new Set();

console.log(`Fetching top ${MAX_PAGES * PER_PAGE} manga from AniList...`);
for (let page = 1; page <= MAX_PAGES; page++) {
  const result = await fetchPage(page);
  for (const m of result.media) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    entries.push(compact(m));
  }
  if (page % 10 === 0) console.log(`  Page ${page}/${MAX_PAGES} — ${entries.length} entries`);
  if (!result.pageInfo.hasNextPage) break;
  if (page < MAX_PAGES) await sleep(DELAY_MS);
}

const catalogue = {
  version: new Date().toISOString().slice(0, 10),
  entries,
};

const json = JSON.stringify(catalogue);
writeFileSync(OUT, json);
console.log(`\n${entries.length} entries written to ${OUT} (${(json.length / 1024 / 1024).toFixed(1)} MB)`);
