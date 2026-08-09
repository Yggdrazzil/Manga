#!/usr/bin/env node
/**
 * Enriches assets/bd-catalogue.json with per-volume synopses and covers.
 *
 * Idempotent: reads the existing catalogue, only processes volumes that still
 * lack a synopsis (`ds`), writes back in place. Run after build-bd-catalogue.
 *
 * Sources, by reliability:
 *   A. Volume's known Wikipedia FR article (`w`) → REST summary
 *   B. Wikipedia FR search on the subtitle, validated by token matching
 *      (with French numeral mapping: "3" ↔ "trois") so a wrong article can
 *      never be attached to a volume
 *   C. Google Books (série + intitle:sous-titre), capped per run
 *
 * No generative AI: every synopsis stored is harvested from a real source.
 *
 * Usage:  node scripts/enrich-bd-volumes.mjs
 *         ENRICH_FILTER='Blake' node scripts/enrich-bd-volumes.mjs  (targeted)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { classifySearchResult, classifyVolumeSynopsis } from './synopsis-guard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'assets', 'bd-catalogue.json');
const UA = 'MangaTrackerCatalogueBuilder/1.0 (https://github.com/yggdrazzil/manga)';
const WIKI_API = 'https://fr.wikipedia.org/w/api.php';
const WIKI_REST = 'https://fr.wikipedia.org/api/rest_v1/page/summary';
const GB = 'https://www.googleapis.com/books/v1/volumes';
const GB_CAP = 400; // keyless quota guard per run

const FILTER = process.env.ENRICH_FILTER
  ? new RegExp(process.env.ENRICH_FILTER, 'i')
  : null;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Token validation (numeral-aware) ──────────────────────────────────────────

const FR_NUMBERS = {
  un: '1', une: '1', premier: '1', premiere: '1',
  deux: '2', deuxieme: '2', second: '2', seconde: '2',
  trois: '3', troisieme: '3', quatre: '4', cinq: '5', six: '6', sept: '7',
  huit: '8', neuf: '9', dix: '10', onze: '11', douze: '12', treize: '13',
  quatorze: '14', quinze: '15', seize: '16', vingt: '20',
};

function tokens(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(t => FR_NUMBERS[t] ?? t);
}

// Article title (parenthetical disambiguator stripped) must be a token subset
// of subtitle+series tokens, with enough character weight to be trustworthy.
function articleMatches(articleTitle, subtitle, seriesTitle) {
  const clean = articleTitle.replace(/\s*\([^)]*\)\s*$/, '');
  const artToks = tokens(clean);
  if (artToks.length === 0) return false;
  const hay = new Set([...tokens(subtitle), ...tokens(seriesTitle)]);
  if (!artToks.every(t => hay.has(t))) return false;
  return artToks.reduce((acc, t) => acc + t.length, 0) >= 10;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchJson(url, attempt = 0) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429 || res.status === 503) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    if (attempt < 2) {
      await sleep((attempt + 1) * 2_000);
      return fetchJson(url, attempt + 1);
    }
    return null;
  }
}

function trim(s, max) {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

async function wikiSummary(title) {
  const data = await fetchJson(`${WIKI_REST}/${encodeURIComponent(title)}`);
  if (!data) return null;
  const extract = (data.extract ?? '').trim();
  return {
    desc: extract.length > 40 ? trim(extract, 500) : undefined,
    cover: data.thumbnail?.source,
    // Canonical title after redirect resolution — an album title can redirect
    // to the series article, whose extract is NOT a volume synopsis.
    canonical: data.titles?.canonical?.replace(/_/g, ' ') ?? data.title ?? title,
    shortDesc: (data.description ?? '').toLowerCase(),
  };
}

async function wikiSearch(query) {
  const params = new URLSearchParams({
    action: 'query', list: 'search', srsearch: query, srlimit: '3', format: 'json',
  });
  const data = await fetchJson(`${WIKI_API}?${params}`);
  return (data?.query?.search ?? []).map(r => r.title);
}

let gbUsed = 0;
let gbConsecutiveFails = 0;

async function googleBooksDesc(seriesTitle, subtitle) {
  if (gbUsed >= GB_CAP || gbConsecutiveFails >= 5) return null;
  gbUsed++;
  const params = new URLSearchParams({
    q: `"${seriesTitle}" intitle:"${subtitle}"`,
    country: 'FR',
    maxResults: '5',
  });
  const data = await fetchJson(`${GB}?${params}`);
  if (!data || data.error) {
    gbConsecutiveFails++;
    return null;
  }
  gbConsecutiveFails = 0;
  const hit = (data.items ?? []).find(
    it => (it.volumeInfo?.description ?? '').length > 40,
  );
  if (!hit) return null;
  return {
    desc: trim(hit.volumeInfo.description, 500),
    cover: hit.volumeInfo.imageLinks?.thumbnail,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const catalogue = JSON.parse(readFileSync(FILE, 'utf-8'));
const series = FILTER
  ? catalogue.series.filter(s => FILTER.test(s.title))
  : catalogue.series;

// Purge : un résumé FAUX est pire qu'un résumé absent. On repasse le
// classifieur (durci) sur ce qui a déjà été collecté et on efface ce qui ne
// tient plus — le tome repart alors dans la file d'enrichissement.
let purged = 0;
for (const s of series) {
  for (const v of s.volumes) {
    if (!v.ds) continue;
    const verdict = classifyVolumeSynopsis(v.ds, '', s.title, v.s ?? '');
    if (verdict.ok) continue;
    delete v.ds;
    // L'article pointé est la source du mauvais résumé : on l'oublie aussi,
    // sinon la passe A le resservirait immédiatement.
    delete v.w;
    delete v.cv;
    purged++;
  }
}
if (purged > 0) console.log(`Purge : ${purged} résumés erronés supprimés.`);

const todo = [];
for (const s of series) {
  for (const v of s.volumes) {
    if (!v.ds && (v.w || v.s)) todo.push({ s, v });
  }
}
console.log(`${todo.length} volumes to enrich (of ${series.length} series).`);

const stats = { direct: 0, searched: 0, gbooks: 0, missed: 0 };

async function enrichVolume({ s, v }) {
  // A. Known article (Wikidata sitelink). Even these can redirect to the
  // series article (Pierre Tombal: "Tombe, la neige" → série) or point at a
  // same-name adaptation (Bone T2 → the Telltale game, The Walking Dead →
  // la série télé). Le classifieur ne juge que la phrase de définition.
  if (v.w) {
    const sum = await wikiSummary(v.w);
    const isSeriesRedirect =
      sum &&
      (sum.canonical === s.frwikiTitle ||
        tokens(sum.canonical).join(' ') === tokens(s.title).join(' '));
    const verdict = sum?.desc
      ? classifyVolumeSynopsis(sum.desc, sum.shortDesc, s.title, v.s ?? '')
      : { ok: false, reason: 'pas-d-extrait' };
    if (sum?.desc && !isSeriesRedirect && verdict.ok) {
      v.ds = sum.desc;
      if (sum.cover && !v.cv) v.cv = sum.cover;
      stats.direct++;
      return;
    }
  }

  // B. Validated Wikipedia search on the subtitle
  if (v.s) {
    const candidates = await wikiSearch(`${v.s} ${s.title}`);
    for (const title of candidates) {
      if (!articleMatches(title, v.s, s.title)) continue;
      // Never attach the series' own article to a volume
      if (title === s.frwikiTitle || tokens(title).join(' ') === tokens(s.title).join(' ')) continue;
      const sum = await wikiSummary(title);
      if (!sum?.desc) continue;
      // Redirect resolved to the series article → not a volume synopsis
      if (
        sum.canonical === s.frwikiTitle ||
        tokens(sum.canonical).join(' ') === tokens(s.title).join(' ')
      ) continue;
      // Les résultats de recherche doivent s'annoncer positivement comme de
      // la BD : l'absence de marqueur « mauvais média » ne suffit pas (cf.
      // l'album de Miles Davis « Blue Period »).
      if (!classifySearchResult(sum.desc, sum.shortDesc, s.title, v.s).ok) continue;
      v.ds = sum.desc;
      if (sum.cover && !v.cv) v.cv = sum.cover;
      if (!v.w) v.w = sum.canonical;
      stats.searched++;
      return;
    }
  }

  // C. Google Books backcover text (+ thumbnail when offered)
  if (v.s) {
    const gb = await googleBooksDesc(s.title, v.s);
    if (gb) {
      v.ds = gb.desc;
      if (gb.cover && !v.cv) v.cv = gb.cover;
      stats.gbooks++;
      return;
    }
  }

  stats.missed++;
}

const CONCURRENCY = parseInt(process.env.ENRICH_CONCURRENCY ?? '12', 10);
for (let i = 0; i < todo.length; i += CONCURRENCY) {
  await Promise.all(todo.slice(i, i + CONCURRENCY).map(enrichVolume));
  if (i > 0 && i % 500 < CONCURRENCY) {
    console.log(`  ${i}/${todo.length}… (direct=${stats.direct} search=${stats.searched} gb=${stats.gbooks} miss=${stats.missed})`);
    writeFileSync(FILE, JSON.stringify(catalogue)); // checkpoint
  }
  await sleep(50);
}

writeFileSync(FILE, JSON.stringify(catalogue));
console.log(`Synopses: direct=${stats.direct} search=${stats.searched} gbooks=${stats.gbooks} missed=${stats.missed}`);

// ── Pass D: per-volume covers from Open Library ───────────────────────────────
// fr.wikipedia almost never hosts album covers (copyright policy), but Open
// Library does — under album titles ("Tintin en Amérique"), not "Tome N",
// so we match docs to volumes by subtitle tokens, not volume numbers.

const VOL_PATTERNS = [
  /\btome\s+(\d+)/i,
  /\bt\.\s*(\d+)/i,
  /\bT0*(\d+)\b/,
  /\bvol(?:ume)?\.?\s*(\d+)/i,
  /#(\d+)/,
];

function extractVolNum(title) {
  for (const p of VOL_PATTERNS) {
    const m = title.match(p);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n < 1000) return n;
    }
  }
  return undefined;
}

// All subtitle tokens must appear in the doc title, with enough character
// weight to be trustworthy (same rule as the app's subtitleMatchWeight).
function subtitleWeight(subtitle, docTitle) {
  const hay = new Set(tokens(docTitle));
  const subToks = tokens(subtitle);
  if (subToks.length === 0 || !subToks.every(t => hay.has(t))) return 0;
  const weight = subToks.reduce((acc, t) => acc + t.length, 0);
  return weight >= 10 ? weight : 0;
}

stats.covers = 0;

async function coverPass(s) {
  const missing = s.volumes.filter(v => !v.cv);
  if (missing.length === 0) return;
  const params = new URLSearchParams({
    q: `${s.title} ${s.authors[0] ?? ''}`.trim(),
    fields: 'key,title,cover_i',
    limit: '100',
  });
  const data = await fetchJson(`https://openlibrary.org/search.json?${params}`);
  const docs = (data?.docs ?? []).filter(d => d.cover_i && d.title);
  if (docs.length === 0) return;

  for (const v of missing) {
    let best = null;
    for (const doc of docs) {
      if (extractVolNum(doc.title) === v.n) {
        best = { doc, weight: 1000 };
        break;
      }
      if (!v.s) continue;
      const w = subtitleWeight(v.s, doc.title);
      if (w > 0 && (!best || w > best.weight)) best = { doc, weight: w };
    }
    if (best) {
      v.cv = `https://covers.openlibrary.org/b/id/${best.doc.cover_i}-L.jpg`;
      stats.covers++;
    }
  }
  // Series hero cover: tome 1 first, else any harvested cover
  if (!s.cover) {
    s.cover = (s.volumes.find(v => v.n === 1 && v.cv) ?? s.volumes.find(v => v.cv))?.cv;
  }
}

const coverTodo = series.filter(s => s.volumes.some(v => !v.cv));
console.log(`Cover pass: ${coverTodo.length} series…`);
const COVER_CONCURRENCY = 6;
for (let i = 0; i < coverTodo.length; i += COVER_CONCURRENCY) {
  await Promise.all(coverTodo.slice(i, i + COVER_CONCURRENCY).map(coverPass));
  if (i > 0 && i % 120 < COVER_CONCURRENCY) {
    console.log(`  ${i}/${coverTodo.length}… (covers=${stats.covers})`);
    writeFileSync(FILE, JSON.stringify(catalogue));
  }
  await sleep(150);
}

writeFileSync(FILE, JSON.stringify(catalogue));
const size = (JSON.stringify(catalogue).length / 1024 / 1024).toFixed(1);
console.log(`Done: covers=${stats.covers}`);
console.log(`Written ${FILE} (${size} MB)`);
