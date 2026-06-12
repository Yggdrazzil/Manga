#!/usr/bin/env node
/**
 * Builds assets/webtoon-catalogue.json — every Webtoon ORIGINALS series.
 *
 * Discovery: the official sitemaps (complete — the genres landing page only
 * lists a promoted subset and misses classics like Tower of God).
 * Enrichment: each series' list page provides the exact title (og:title),
 * cover (og:image) and authors. Canvas (user-generated) is excluded — same
 * policy as the reading fallback.
 *
 * Usage:  node scripts/build-webtoon-catalogue.mjs
 * Time:   ~5–8 minutes (≈2000 pages, concurrency 4)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'assets', 'webtoon-catalogue.json');
const BASE = 'https://www.webtoons.com';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.webtoons.com/',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function slugToTitle(slug) {
  return slug
    .split('-')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// ── Step 1: Discovery via sitemaps ────────────────────────────────────────────

console.log('Step 1/2 — Discovering series from sitemaps...');
const indexXml = await (await fetch(`${BASE}/sitemap.xml`, { headers: HEADERS })).text();
const sitemapUrls = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
console.log(`  ${sitemapUrls.length} sitemap files`);

/** @type {Map<string, {titleNo:string, genre:string, slug:string}>} */
const discovered = new Map();

for (const url of sitemapUrls) {
  try {
    const xml = await (
      await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60_000) })
    ).text();
    for (const m of xml.matchAll(
      /\/en\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)\/list\?title_no=(\d+)/g,
    )) {
      const [, genre, slug, titleNo] = m;
      if (genre === 'canvas' || genre === 'challenge') continue; // user-generated
      if (!discovered.has(titleNo)) discovered.set(titleNo, { titleNo, genre, slug });
    }
    console.log(`  ${url.split('/').pop()}: cumulative ${discovered.size} series`);
  } catch (e) {
    console.warn(`  ${url} failed: ${e.message}`);
  }
  await sleep(500);
}

if (discovered.size < 500) {
  throw new Error(`Only ${discovered.size} series discovered — refusing to continue`);
}

// ── Step 2: Enrich each series from its list page ─────────────────────────────

console.log(`Step 2/2 — Enriching ${discovered.size} series pages...`);

// Previous catalogue as fallback for pages that fail this run
let previousById = new Map();
try {
  const prev = JSON.parse(readFileSync(OUT, 'utf-8'));
  previousById = new Map((prev.entries ?? []).map(e => [e.id.split(':')[0], e]));
} catch {
  // first build
}

async function enrich({ titleNo, genre, slug }, attempt = 0) {
  const id = `${titleNo}:${genre}/${slug}`;
  try {
    const res = await fetch(`${BASE}/en/${genre}/${slug}/list?title_no=${titleNo}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429 || res.status === 503) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) {
      // Gone/region-locked — keep previous data if we had it
      const prev = previousById.get(titleNo);
      return prev ? { ...prev, id } : null;
    }
    const html = await res.text();
    const title = /property="og:title" content="([^"]+)"/.exec(html)?.[1];
    const cover = /property="og:image" content="([^"]+)"/.exec(html)?.[1];
    // Official meta tag — clean "Writer / Artist" string. The visible
    // author_area block nests markup and the plain "author" class also
    // appears in the recommendation rail (wrong series credits).
    const author = /property="com-linewebtoon:webtoon:author" content="([^"]+)"/.exec(html)?.[1];
    const desc = /property="og:description" content="([^"]+)"/.exec(html)?.[1];
    const entry = {
      id,
      t: title ? decode(title) : slugToTitle(slug),
      a: author ? decode(author).split('/').map(s => s.trim()).filter(Boolean) : [],
      c: cover ?? '',
      g: genre,
    };
    if (desc) {
      const d = decode(desc);
      entry.d = d.length > 400 ? `${d.slice(0, 400)}…` : d;
    }
    return entry;
  } catch (e) {
    if (attempt < 2) {
      await sleep((attempt + 1) * 3_000);
      return enrich({ titleNo, genre, slug }, attempt + 1);
    }
    const prev = previousById.get(titleNo);
    if (prev) return { ...prev, id };
    // Never drop a discovered series: degrade to slug-derived title
    return { id, t: slugToTitle(slug), a: [], c: '', g: genre };
  }
}

const all = Array.from(discovered.values());
const entries = [];
const CONCURRENCY = 4;
let failedPages = 0;

for (let i = 0; i < all.length; i += CONCURRENCY) {
  const batch = await Promise.all(all.slice(i, i + CONCURRENCY).map(enrich));
  for (const e of batch) {
    if (!e) continue;
    if (!e.c) failedPages++;
    entries.push(e);
  }
  if (i > 0 && i % 200 < CONCURRENCY) {
    console.log(`  ${i}/${all.length} pages...`);
  }
  await sleep(150);
}

console.log(`  ${entries.length} series kept (${failedPages} without cover).`);

if (entries.length < 500) {
  throw new Error(`Only ${entries.length} series parsed — refusing to overwrite catalogue`);
}

const catalogue = {
  version: new Date().toISOString().slice(0, 10),
  entries,
};

const json = JSON.stringify(catalogue);
writeFileSync(OUT, json);
console.log(`${entries.length} Originals written to ${OUT} (${(json.length / 1024).toFixed(0)} KB)`);
