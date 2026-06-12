/**
 * Wikipédia FR — series-level synopsis, plus per-album intros when Wikidata
 * provides the exact article title (frwikiTitle on classic series is common:
 * every Astérix/Thorgal/Lanfeust album has its own FR article).
 */

const WP_SEARCH = 'https://fr.wikipedia.org/w/api.php';
const WP_SUMMARY = 'https://fr.wikipedia.org/api/rest_v1/page/summary';
const UA = 'MangaTrackerApp/1.0 (contact: app@example.com)';

/** Intro extract for an exact FR article title (no search step). */
export async function getWikipediaSummaryByTitle(articleTitle: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(`${WP_SUMMARY}/${encodeURIComponent(articleTitle)}`, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const summary = await res.json() as { extract?: string; type?: string };
    if (summary.type === 'disambiguation') return undefined;
    return summary.extract || undefined;
  } catch {
    clearTimeout(timer);
    return undefined;
  }
}

/** Resolve the FR article title for a series (search step shared by helpers). */
async function findSeriesArticle(frenchTitle: string): Promise<string | undefined> {
  const searchParams = new URLSearchParams({
    action: 'query', list: 'search',
    srsearch: `${frenchTitle} bande dessinée`,
    format: 'json', srlimit: '1',
  });
  const res = await fetch(`${WP_SEARCH}?${searchParams}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) return undefined;
  const data = await res.json() as { query?: { search?: Array<{ title: string }> } };
  return data?.query?.search?.[0]?.title;
}

export interface WikipediaAlbum {
  num: number;
  title: string;
  date?: string; // "YYYY" or "YYYY-MM"
}

const MONTHS_FR: Record<string, string> = {
  janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
};

/**
 * Parse the numbered album list from the series' FR article. Wikipedia is the
 * freshest free source for new albums — catalogues (BnF, Wikidata) often file
 * late releases under standalone titles that escape series queries entirely
 * (e.g. "La forêt noiseuse" without any "Lanfeust de Troy. 9," prefix).
 */
export async function getWikipediaAlbumList(frenchTitle: string): Promise<WikipediaAlbum[]> {
  try {
    const article = await findSeriesArticle(frenchTitle);
    if (!article) return [];

    // Locate the albums section so intégrales/novelisations listed elsewhere
    // don't pollute the ordinals.
    const secParams = new URLSearchParams({
      action: 'parse', page: article, prop: 'sections', format: 'json', origin: '*',
    });
    const secRes = await fetch(`${WP_SEARCH}?${secParams}`, { headers: { 'User-Agent': UA } });
    if (!secRes.ok) return [];
    const secData = await secRes.json() as { parse?: { sections?: Array<{ line: string; index: string }> } };
    const section = (secData.parse?.sections ?? []).find(s =>
      /\balbums?\b|liste des albums|publications?\b/i.test(s.line),
    );
    if (!section) return [];

    const wtParams = new URLSearchParams({
      action: 'parse', page: article, prop: 'wikitext',
      section: section.index, format: 'json', origin: '*',
    });
    const wtRes = await fetch(`${WP_SEARCH}?${wtParams}`, { headers: { 'User-Agent': UA } });
    if (!wtRes.ok) return [];
    const wtData = await wtRes.json() as { parse?: { wikitext?: { '*': string } } };
    const wikitext = wtData.parse?.wikitext?.['*'] ?? '';

    const albums: WikipediaAlbum[] = [];
    for (const m of wikitext.matchAll(/^#\s*(.+)$/gm)) {
      const line = m[1];
      if (/int[ée]grale|coffret|hors[- ]?s[ée]rie|artbook|recueil/i.test(line)) continue;
      // Lazy match: titles routinely contain single apostrophes ("L'Ivoire…")
      const title = /''(.+?)''/.exec(line)?.[1]?.replace(/^'|'$/g, '').trim();
      if (!title) continue;
      // {{Date|j|mois|aaaa…}} → YYYY-MM, plain (1994) → YYYY
      let date: string | undefined;
      const dateTpl = /\{\{Date\|[^|}]*\|([^|}]+)\|(\d{4})/i.exec(line);
      if (dateTpl) {
        const mm = MONTHS_FR[dateTpl[1].toLowerCase().trim()];
        date = mm ? `${dateTpl[2]}-${mm}` : dateTpl[2];
      } else {
        date = /\((\d{4})\)/.exec(line)?.[1];
      }
      albums.push({ num: albums.length + 1, title, date });
    }
    return albums;
  } catch {
    return [];
  }
}

export async function getWikipediaSeriesSummary(frenchTitle: string): Promise<string | undefined> {
  try {
    const searchParams = new URLSearchParams({
      action: 'query', list: 'search',
      srsearch: `${frenchTitle} bande dessinée`,
      format: 'json', srlimit: '1',
    });
    const searchRes = await fetch(`${WP_SEARCH}?${searchParams}`, {
      headers: { 'User-Agent': UA },
    });
    if (!searchRes.ok) return undefined;
    const searchData = await searchRes.json() as { query?: { search?: Array<{ title: string }> } };
    const pageTitle = searchData?.query?.search?.[0]?.title;
    if (!pageTitle) return undefined;

    const summaryRes = await fetch(`${WP_SUMMARY}/${encodeURIComponent(pageTitle)}`, {
      headers: { 'User-Agent': UA },
    });
    if (!summaryRes.ok) return undefined;
    const summary = await summaryRes.json() as { extract?: string; type?: string };
    if (summary.type === 'disambiguation') return undefined;
    return summary.extract || undefined;
  } catch {
    return undefined;
  }
}
