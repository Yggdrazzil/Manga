/**
 * Wikidata SPARQL — primary source for French BD album structure.
 *
 * Free, no API key, perfect coverage:
 *   40 Astérix albums, 41 Thorgal, 11 Le Chat du Rabbin, etc.
 * Returns ordinal numbers, French titles, publication dates,
 * and direct Wikipedia FR article links for per-volume synopses.
 */

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'MangaTrackerApp/1.0';

export interface WikidataAlbum {
  num: number;
  title: string;        // French label
  date?: string;        // ISO date string, e.g. "1961-10-01"
  wikidataId: string;   // e.g. "Q12345"
  frwikiTitle?: string; // Wikipedia FR article name for per-volume synopsis
}

async function runSparql(sparql: string): Promise<Array<Record<string, { value: string }>>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const params = new URLSearchParams({ query: sparql, format: 'json' });
    const res = await fetch(`${WIKIDATA_SPARQL}?${params}`, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': UA,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json() as {
      results: { bindings: Array<Record<string, { value: string }>> };
    };
    return data?.results?.bindings ?? [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// Case-insensitive entity lookup — rdfs:label SPARQL matching is exact, which
// misses "Le Chat du Rabbin" vs "Le Chat du rabbin". wbsearchentities is not.
async function findSeriesCandidates(seriesTitle: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const params = new URLSearchParams({
      action: 'wbsearchentities',
      search: seriesTitle,
      language: 'fr',
      type: 'item',
      limit: '5',
      format: 'json',
      origin: '*',
    });
    const res = await fetch(`https://www.wikidata.org/w/api.php?${params}`, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json() as { search?: Array<{ id: string }> };
    return (data.search ?? []).map(s => s.id);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

function albumsByQidQuery(qid: string): string {
  return `
SELECT ?album ?albumLabel ?ordinal ?date ?frwikiTitle WHERE {
  ?album wdt:P179 wd:${qid} ;
         p:P179/pq:P1545 ?ordinal .
  OPTIONAL { ?album wdt:P577 ?date . FILTER(YEAR(?date) > 1900) }
  OPTIONAL {
    ?article schema:about ?album ;
             schema:isPartOf <https://fr.wikipedia.org/> ;
             schema:name ?frwikiTitle .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
ORDER BY xsd:integer(?ordinal)
LIMIT 80
`.trim();
}

function parseAlbums(bindings: Array<Record<string, { value: string }>>): WikidataAlbum[] {
  const albums: WikidataAlbum[] = [];
  for (const b of bindings) {
    if (!b['ordinal']?.value) continue; // skip hors-série / specials without ordinal
    const num = parseInt(b['ordinal'].value, 10);
    if (!num || isNaN(num)) continue;
    albums.push({
      num,
      title: b['albumLabel']?.value ?? '',
      date: b['date']?.value?.slice(0, 10) || undefined,
      wikidataId: b['album']?.value?.split('/').pop() ?? '',
      frwikiTitle: b['frwikiTitle']?.value || undefined,
    });
  }
  return albums;
}

export interface WikidataSeries {
  albums: WikidataAlbum[];
  authors: string[];
}

export async function searchWikidataSeries(seriesTitle: string): Promise<WikidataSeries> {
  // Fast path: exact French label match
  const safe = seriesTitle.replace(/"/g, '\\"');
  const exact = await runSparql(`
SELECT ?album ?albumLabel ?ordinal ?date ?frwikiTitle ?series WHERE {
  ?series rdfs:label "${safe}"@fr ;
          wdt:P31/wdt:P279* wd:Q1004 .
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
ORDER BY xsd:integer(?ordinal)
LIMIT 80
`.trim());

  let albums = parseAlbums(exact);
  let seriesQid = exact[0]?.['series']?.value?.split('/').pop();

  // Fallback: case-insensitive entity search, keep first candidate with albums
  if (albums.length === 0) {
    const candidates = await findSeriesCandidates(seriesTitle);
    for (const qid of candidates) {
      const bindings = await runSparql(albumsByQidQuery(qid));
      const parsed = parseAlbums(bindings);
      if (parsed.length > 0) {
        albums = parsed;
        seriesQid = qid;
        break;
      }
    }
  }

  // Series-level creators: author (P50), scenarist (P58), illustrator (P110)
  let authors: string[] = [];
  if (seriesQid) {
    const authorBindings = await runSparql(`
SELECT DISTINCT ?authorLabel WHERE {
  wd:${seriesQid} wdt:P50|wdt:P58|wdt:P110 ?author .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 6
`.trim());
    authors = authorBindings
      .map(b => b['authorLabel']?.value ?? '')
      .filter(a => a && !/^Q\d+$/.test(a));
  }

  return { albums, authors };
}

export async function searchWikidataAlbums(seriesTitle: string): Promise<WikidataAlbum[]> {
  const { albums } = await searchWikidataSeries(seriesTitle);
  return albums;
}

export async function getWikidataSeriesWikiTitle(seriesTitle: string): Promise<string | undefined> {
  const safe = seriesTitle.replace(/"/g, '\\"');
  const sparql = `
SELECT ?frwikiTitle WHERE {
  ?series rdfs:label "${safe}"@fr ;
          wdt:P31/wdt:P279* wd:Q1004 .
  ?article schema:about ?series ;
           schema:isPartOf <https://fr.wikipedia.org/> ;
           schema:name ?frwikiTitle .
}
LIMIT 1
`.trim();

  const bindings = await runSparql(sparql);
  return bindings[0]?.['frwikiTitle']?.value || undefined;
}
