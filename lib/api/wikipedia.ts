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
