/**
 * Google Books API — French synopses + cover images
 *
 * Best free source for French-language BD descriptions (4e de couverture).
 * Requires a free API key: console.cloud.google.com → enable Books API → create key
 * Set as EXPO_PUBLIC_GOOGLE_BOOKS_KEY in your .env.local and as an EAS secret.
 *
 * Without a key: requests fail silently (descriptions left empty).
 * Daily quota: 1 000 req/day on the free tier.
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

export async function searchGoogleBooksSeries(seriesTitle: string): Promise<GBItem[]> {
  if (!API_KEY) return [];

  const params = new URLSearchParams({
    q: `intitle:${seriesTitle}`,
    country: 'FR',
    maxResults: '40',
    key: API_KEY,
  });

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
