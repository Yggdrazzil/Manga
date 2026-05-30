const BASE_SEARCH = 'https://openlibrary.org/search.json';
const BASE_WORKS = 'https://openlibrary.org/works';
const BASE_COVERS = 'https://covers.openlibrary.org/b/id';

export interface OLBook {
  id: string;            // e.g. "OL24228254W"
  title: string;
  authors: string[];
  coverImage?: string;
  description?: string;
  publisher?: string;
  publishedDate?: string;
  categories: string[];
}

interface OLSearchDoc {
  key: string;           // "/works/OL24228254W"
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  subject?: string[];
  publisher?: string[];
}

interface OLWorkDetail {
  key: string;
  title: string;
  covers?: number[];
  description?: string | { value: string };
  subjects?: string[];
  first_publish_date?: string;
}

function coverUrl(coverId: number): string {
  return `${BASE_COVERS}/${coverId}-L.jpg`;
}

function extractWorkId(key: string): string {
  return key.replace('/works/', '');
}

function cleanSubjects(subjects: string[] | undefined): string[] {
  if (!subjects) return [];
  return subjects
    .filter(s => !s.startsWith('series:') && !s.includes('(Fictitious') && s.length < 40)
    .slice(0, 5);
}

function normalizeDoc(doc: OLSearchDoc): OLBook {
  return {
    id: extractWorkId(doc.key),
    title: doc.title,
    authors: doc.author_name ?? [],
    coverImage: doc.cover_i ? coverUrl(doc.cover_i) : undefined,
    publisher: doc.publisher?.[0],
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
    categories: cleanSubjects(doc.subject),
  };
}

export async function searchComics(
  query: string,
  offset = 0,
): Promise<{ items: OLBook[]; hasMore: boolean; total: number }> {
  if (!query.trim()) return { items: [], hasMore: false, total: 0 };

  const params = new URLSearchParams({
    q: query,
    limit: '20',
    offset: String(offset),
    fields: 'key,title,author_name,cover_i,first_publish_year,subject,publisher',
  });

  const res = await fetch(`${BASE_SEARCH}?${params}`);
  if (!res.ok) throw new Error(`Open Library error: ${res.status}`);
  const data = await res.json() as { numFound: number; docs: OLSearchDoc[] };

  const items = (data.docs ?? []).map(normalizeDoc).filter(b => b.coverImage);
  return { items, hasMore: offset + items.length < data.numFound, total: data.numFound };
}

export async function getComicById(workId: string): Promise<OLBook> {
  const res = await fetch(`${BASE_WORKS}/${workId}.json`);
  if (!res.ok) throw new Error(`Open Library error: ${res.status}`);
  const data = await res.json() as OLWorkDetail;

  const description =
    typeof data.description === 'string' ? data.description : data.description?.value;

  return {
    id: workId,
    title: data.title,
    authors: [],
    coverImage: data.covers?.[0] ? coverUrl(data.covers[0]) : undefined,
    description,
    categories: cleanSubjects(data.subjects),
  };
}
