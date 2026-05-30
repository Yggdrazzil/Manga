const BASE = 'https://www.googleapis.com/books/v1';

export interface GoogleBook {
  id: string;
  title: string;
  authors: string[];
  coverImage?: string;
  description?: string;
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  categories: string[];
  averageRating?: number;
  ratingsCount?: number;
  language?: string;
}

interface GBVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    language?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
  };
}

function normalize(v: GBVolume): GoogleBook {
  const info = v.volumeInfo;
  const img = info.imageLinks;
  const cover = img?.extraLarge ?? img?.large ?? img?.medium ?? img?.thumbnail ?? img?.smallThumbnail;
  // Force HTTPS and higher resolution
  const coverImage = cover
    ? cover.replace('http://', 'https://').replace('zoom=1', 'zoom=3')
    : undefined;

  return {
    id: v.id,
    title: info.title ?? 'Sans titre',
    authors: info.authors ?? [],
    coverImage,
    description: info.description,
    publisher: info.publisher,
    publishedDate: info.publishedDate,
    pageCount: info.pageCount,
    categories: info.categories ?? [],
    averageRating: info.averageRating,
    ratingsCount: info.ratingsCount,
    language: info.language,
  };
}

export async function searchComics(query: string, startIndex = 0): Promise<{ items: GoogleBook[]; hasMore: boolean; total: number }> {
  if (!query.trim()) return { items: [], hasMore: false, total: 0 };

  const params = new URLSearchParams({
    q: query,
    maxResults: '20',
    startIndex: String(startIndex),
    printType: 'books',
    orderBy: 'relevance',
  });

  const res = await fetch(`${BASE}/volumes?${params}`);
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`);
  const data = await res.json() as { totalItems?: number; items?: GBVolume[] };

  const total = data.totalItems ?? 0;
  const items = (data.items ?? []).map(normalize).filter(b => b.coverImage);

  return { items, hasMore: startIndex + items.length < total, total };
}

export async function getComicById(id: string): Promise<GoogleBook> {
  const res = await fetch(`${BASE}/volumes/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`);
  const data = await res.json() as GBVolume;
  return normalize(data);
}
