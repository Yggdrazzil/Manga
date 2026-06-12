#!/usr/bin/env node
/**
 * Builds assets/bd-catalogue.json from Wikidata SPARQL.
 *
 * Usage:  node scripts/build-bd-catalogue.mjs
 * Needs:  Node 20+ (native fetch, AbortSignal.timeout)
 * Time:   ~3–5 minutes (rate-limited to 1 req/1.5 s)
 *
 * The generated JSON is committed to the repo and bundled by Metro.
 * Run this manually or let the GitHub Action handle it weekly.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'assets', 'bd-catalogue.json');
const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'MangaTrackerCatalogueBuilder/1.0 (https://github.com/yggdrazzil/manga)';
const DELAY_MS = 1500; // polite rate limit between chunked queries

// ── Helpers ───────────────────────────────────────────────────────────────────

async function runSparql(sparql, attempt = 0) {
  const params = new URLSearchParams({ query: sparql.trim(), format: 'json' });
  try {
    const res = await fetch(`${SPARQL}?${params}`, {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 429 || res.status === 503) {
      if (attempt < 3) {
        const wait = (attempt + 1) * 5_000;
        console.warn(`  Rate-limited (${res.status}), retrying in ${wait / 1000}s...`);
        await sleep(wait);
        return runSparql(sparql, attempt + 1);
      }
      throw new Error(`SPARQL gave ${res.status} after 3 retries`);
    }
    if (!res.ok) throw new Error(`SPARQL failed: ${res.status}`);
    const data = await res.json();
    return data?.results?.bindings ?? [];
  } catch (err) {
    if (attempt < 2 && err.name !== 'AbortError') {
      console.warn(`  Error: ${err.message}, retrying...`);
      await sleep(3_000);
      return runSparql(sparql, attempt + 1);
    }
    throw err;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Step 1: All French BD series ──────────────────────────────────────────────

console.log('Step 1/3 — Fetching series list from Wikidata...');
// Driven from the albums side: only series that actually have ordinal-numbered
// albums (p:P179/pq:P1545) qualify. A naive "instance of comics" scan returns
// mostly individual works and arbitrary truncation, not usable series.
//
// WDQS can silently return PARTIAL results with HTTP 200 when its internal
// optimizer times out — one run yielded 423 series, the next 573. Run the
// query several times and union the results until two consecutive passes stop
// discovering new series.
const SERIES_QUERY = `
SELECT DISTINCT ?series ?seriesLabel ?frwikiTitle WHERE {
  ?album p:P179 ?st .
  ?st ps:P179 ?series ; pq:P1545 ?ord .
  ?series wdt:P31/wdt:P279* wd:Q1004 .
  OPTIONAL {
    ?article schema:about ?series ;
             schema:isPartOf <https://fr.wikipedia.org/> ;
             schema:name ?frwikiTitle .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 5000
`;

/** @type {Map<string, {qid:string,title:string,frwikiTitle?:string,authors:string[],volumes:object[]}>} */
const seriesMap = new Map();

for (let pass = 1; pass <= 4; pass++) {
  const before = seriesMap.size;
  const seriesBindings = await runSparql(SERIES_QUERY);
  for (const b of seriesBindings) {
    const qid = b.series?.value?.split('/').pop();
    const title = b.seriesLabel?.value;
    if (!qid || !title || /^Q\d+$/.test(title)) continue;
    if (!seriesMap.has(qid)) {
      seriesMap.set(qid, {
        qid,
        title,
        frwikiTitle: b.frwikiTitle?.value || undefined,
        authors: [],
        volumes: [],
      });
    }
  }
  console.log(`  Pass ${pass}: ${seriesMap.size} series (+${seriesMap.size - before})`);
  if (pass > 1 && seriesMap.size === before) break; // converged
  await sleep(DELAY_MS);
}

console.log(`  Found ${seriesMap.size} series.`);
const allQids = Array.from(seriesMap.keys());

// ── Step 2: Albums for each series (chunked to avoid timeouts) ────────────────

console.log('Step 2/3 — Fetching album lists...');
const albumChunks = chunk(allQids, 150);

for (let i = 0; i < albumChunks.length; i++) {
  const qids = albumChunks[i];
  const values = qids.map(q => `wd:${q}`).join(' ');
  process.stdout.write(`  Chunk ${i + 1}/${albumChunks.length} (${qids.length} series)... `);

  try {
    const bindings = await runSparql(`
SELECT ?album ?albumLabel ?ordinal ?date ?frwikiTitle ?series WHERE {
  VALUES ?series { ${values} }
  ?album wdt:P179 ?series ;
         p:P179/pq:P1545 ?ordinal .
  OPTIONAL { ?album wdt:P577 ?date . FILTER(YEAR(?date) > 1900) }
  OPTIONAL {
    ?article schema:about ?album ;
             schema:isPartOf <https://fr.wikipedia.org/> ;
             schema:name ?frwikiTitle .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 8000
`);

    let added = 0;
    for (const b of bindings) {
      const seriesQid = b.series?.value?.split('/').pop();
      const entry = seriesMap.get(seriesQid);
      if (!entry) continue;
      const num = parseInt(b.ordinal?.value, 10);
      if (!num || isNaN(num) || num > 999) continue;
      if (entry.volumes.some(v => v.n === num)) continue;
      entry.volumes.push({
        n: num,
        s: b.albumLabel?.value || undefined,
        d: b.date?.value?.slice(0, 10) || undefined,
        w: b.frwikiTitle?.value || undefined,
      });
      added++;
    }
    console.log(`${added} albums`);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }

  if (i < albumChunks.length - 1) await sleep(DELAY_MS);
}

// ── Step 3: Authors ───────────────────────────────────────────────────────────

console.log('Step 3/3 — Fetching authors...');
const authorChunks = chunk(allQids, 250);

for (let i = 0; i < authorChunks.length; i++) {
  const qids = authorChunks[i];
  const values = qids.map(q => `wd:${q}`).join(' ');
  process.stdout.write(`  Chunk ${i + 1}/${authorChunks.length}... `);

  try {
    const bindings = await runSparql(`
SELECT ?series ?authorLabel WHERE {
  VALUES ?series { ${values} }
  ?series wdt:P50|wdt:P58|wdt:P110 ?author .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
`);

    let added = 0;
    for (const b of bindings) {
      const seriesQid = b.series?.value?.split('/').pop();
      const entry = seriesMap.get(seriesQid);
      if (!entry) continue;
      const author = b.authorLabel?.value;
      if (author && !/^Q\d+$/.test(author) && !entry.authors.includes(author)) {
        entry.authors.push(author);
        added++;
      }
    }
    console.log(`${added} author credits`);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }

  if (i < authorChunks.length - 1) await sleep(DELAY_MS);
}

// ── Step 4: Wikipedia FR summaries (series synopsis + cover thumbnail) ───────

for (const entry of seriesMap.values()) {
  entry.volumes.sort((a, b) => a.n - b.n);
}

const series = Array.from(seriesMap.values()).filter(s => s.volumes.length > 0);
console.log(`\nSeries with at least 1 album: ${series.length}`);

console.log('Step 4/4 — Fetching Wikipedia FR summaries...');
const withWiki = series.filter(s => s.frwikiTitle);
let enriched = 0;

async function fetchSummary(entry, attempt = 0) {
  try {
    const res = await fetch(
      `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(entry.frwikiTitle)}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const extract = (data.extract ?? '').trim();
    if (extract.length > 40) {
      entry.desc = extract.length > 600 ? `${extract.slice(0, 600)}…` : extract;
    }
    if (data.thumbnail?.source) entry.cover = data.thumbnail.source;
    enriched++;
  } catch {
    // Wikipedia REST throttles bursts — retry twice with backoff
    if (attempt < 2) {
      await sleep((attempt + 1) * 2_000);
      return fetchSummary(entry, attempt + 1);
    }
  }
}

const CONCURRENCY = 4;
for (let i = 0; i < withWiki.length; i += CONCURRENCY) {
  await Promise.all(withWiki.slice(i, i + CONCURRENCY).map(fetchSummary));
  if ((i / CONCURRENCY) % 10 === 0 && i > 0) {
    console.log(`  ${i}/${withWiki.length} processed...`);
  }
}
console.log(`  ${enriched}/${withWiki.length} series enriched with synopsis/cover.`);

// Safety merge: never lose series the previous catalogue had just because a
// flaky WDQS pass missed them this week. Old entries absent from this build
// are carried over as-is, and per-volume enrichment (ds/cv/w harvested by
// enrich-bd-volumes.mjs, which accumulates Google Books results across weekly
// runs) is preserved on rebuilt series.
let finalSeries = series;
try {
  const previous = JSON.parse(readFileSync(OUT, 'utf-8'));
  const prevByQid = new Map((previous.series ?? []).map(s => [s.qid, s]));

  let preserved = 0;
  for (const s of series) {
    const prev = prevByQid.get(s.qid);
    if (!prev) continue;
    const prevVols = new Map(prev.volumes.map(v => [v.n, v]));
    for (const v of s.volumes) {
      const pv = prevVols.get(v.n);
      if (!pv) continue;
      if (pv.ds && !v.ds) { v.ds = pv.ds; preserved++; }
      if (pv.cv && !v.cv) v.cv = pv.cv;
      if (pv.w && !v.w) v.w = pv.w;
    }
    if (prev.desc && !s.desc) s.desc = prev.desc;
    if (prev.cover && !s.cover) s.cover = prev.cover;
  }
  if (preserved > 0) console.log(`Preserved ${preserved} previously harvested volume synopses.`);

  const currentQids = new Set(series.map(s => s.qid));
  const carried = (previous.series ?? []).filter(s => s.qid && !currentQids.has(s.qid));
  if (carried.length > 0) {
    console.log(`Carrying over ${carried.length} series from the previous catalogue.`);
    finalSeries = [...series, ...carried];
  }
} catch {
  // no previous catalogue — first build
}

const catalogue = {
  version: new Date().toISOString().slice(0, 10),
  series: finalSeries,
};

const json = JSON.stringify(catalogue);
writeFileSync(OUT, json);
console.log(`${finalSeries.length} series written to ${OUT} (${(json.length / 1024).toFixed(0)} KB)`);
