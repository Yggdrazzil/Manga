/**
 * Google Books API — French synopses + cover images
 *
 * Best free source for French-language BD descriptions (4e de couverture).
 * Works without a key (shared anonymous quota); set a free API key as
 * EXPO_PUBLIC_GOOGLE_BOOKS_KEY for a dedicated 1 000 req/day quota.
 */

const BASE = 'https://www.googleapis.com/books/v1/volumes';

// Inlined at bundle time by Expo's Metro config.
// Must be prefixed EXPO_PUBLIC_ to be available in the JS bundle.
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY ?? '';

export interface GBItem {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    language?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
  };
}

async function queryGB(q: string, maxResults: number): Promise<GBItem[]> {
  const params = new URLSearchParams({
    q,
    country: 'FR',
    langRestrict: 'fr',
    maxResults: String(maxResults),
  });
  if (API_KEY) params.set('key', API_KEY);

  try {
    const res = await fetch(`${BASE}?${params}`);
    if (!res.ok) return [];
    const data = await res.json() as { items?: GBItem[]; error?: unknown };
    if (data.error) return [];
    return (data.items ?? []).filter(it => it.volumeInfo.language === 'fr' || !it.volumeInfo.language);
  } catch {
    return [];
  }
}

export async function searchGoogleBooksSeries(seriesTitle: string): Promise<GBItem[]> {
  return queryGB(`intitle:${seriesTitle}`, 40);
}

/**
 * Targeted lookup for one album's synopsis (lazy, on card expand).
 * The episode title is the strongest discriminator; the series title keeps
 * homonyms away.
 */
export async function getVolumeDescription(
  seriesTitle: string,
  episodeTitle: string,
): Promise<string | undefined> {
  if (!episodeTitle) return undefined;
  const items = await queryGB(`"${seriesTitle}" intitle:"${episodeTitle}"`, 5);
  const withDesc = items.find(it => (it.volumeInfo.description ?? '').length > 40);
  return withDesc?.volumeInfo.description ?? undefined;
}
