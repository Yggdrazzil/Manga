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

// Homonym guards. Sample audits caught real traps: « Bone : La Forêt sans
// retour » (Telltale video game), « Blue Period » (the 1953 Miles Davis
// album!). French BD album articles virtually always open with "est la Ne
// histoire/tome/album de la série…" or "est une bande dessinée…".
const WRONG_MEDIUM =
  /jeu video|\bfilm\b|long metrage|serie televisee|telefilm|\broman\b|album studio|chanson|\bsingle\b|episode de|jeu de societe|trompettiste|saxophoniste|pianiste|jazz|groupe de musique|discographie/;
const IS_BD =
  /bandes? dessinee|\bbd\b|\bbede\b|comic|manga|manhwa|histoire de la serie|tome de la serie|album de la serie|aventure de la serie|histoire des aventures|recit complet/;

function stripAccents(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function probeOf(sum) {
  return stripAccents(`${sum.shortDesc} ${(sum.desc ?? '').slice(0, 160)}`);
}

// Negative guard (Pass A — Wikidata sitelinks are usually right, only reject
// when the subject announces another medium without any BD signal).
function looksLikeWrongSubject(sum) {
  const probe = probeOf(sum);
  return WRONG_MEDIUM.test(probe) && !IS_BD.test(probe);
}

// Positive guard (Pass B — search results must identify as BD; absence of a
// wrong-medium marker is not enough, cf. the Miles Davis "Blue Period").
function positivelyBD(sum) {
  return IS_BD.test(probeOf(sum));
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
  return hit ? trim(hit.volumeInfo.description, 500) : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const catalogue = JSON.parse(readFileSync(FILE, 'utf-8'));
const series = FILTER
  ? catalogue.series.filter(s => FILTER.test(s.title))
  : catalogue.series;

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
  // same-name adaptation (Bone T2 → the Telltale game).
  if (v.w) {
    const sum = await wikiSummary(v.w);
    const isSeriesRedirect =
      sum &&
      (sum.canonical === s.frwikiTitle ||
        tokens(sum.canonical).join(' ') === tokens(s.title).join(' '));
    if (sum?.desc && !isSeriesRedirect && !looksLikeWrongSubject(sum)) {
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
      // Search hits must positively identify as BD — mere absence of a
      // wrong-medium marker let the Miles Davis "Blue Period" through.
      if (!positivelyBD(sum)) continue;
      v.ds = sum.desc;
      if (sum.cover && !v.cv) v.cv = sum.cover;
      if (!v.w) v.w = sum.canonical;
      stats.searched++;
      return;
    }
  }

  // C. Google Books backcover text
  if (v.s) {
    const desc = await googleBooksDesc(s.title, v.s);
    if (desc) {
      v.ds = desc;
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
const size = (JSON.stringify(catalogue).length / 1024 / 1024).toFixed(1);
console.log(`Done: direct=${stats.direct} search=${stats.searched} gbooks=${stats.gbooks} missed=${stats.missed}`);
console.log(`Written ${FILE} (${size} MB)`);
