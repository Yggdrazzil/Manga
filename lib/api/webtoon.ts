import { Directory, File, Paths } from 'expo-file-system';
import type { Manga, MangaChapter, PaginatedResult } from '../types';
import { logger } from '../utils/logger';
import { pruneChapterCache } from '../utils/pageCache';

// Webtoon (LINE Webtoon / NAVER) — official free reader.
// Tower of God, True Beauty, The God of High School, etc.
// No JSON API: reader page HTML has img[data-url] for episode images.
const BASE = 'https://www.webtoons.com';
// v2: v1 entries could hold wrong images (episode-list thumbnails) under
// index-only filenames — never reuse them.
const CACHE_DIR = 'webtoon-pages-v2';

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  Referer: `${BASE}/`,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchWT(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Webtoon ${res.status}: ${url}`);
  return res.text();
}

// ── ID helpers ────────────────────────────────────────────────────────────────
// Compound manga ID: "{title_no}:{genre}/{slug}"
// e.g. "95:fantasy/tower-of-god"
// Chapter ID: absolute viewer path with query string
// e.g. "/en/fantasy/tower-of-god/ep-1/viewer?title_no=95&episode_no=1"

function makeId(titleNo: string | number, genre: string, slug: string): string {
  return `${titleNo}:${genre}/${slug}`;
}

function parseId(id: string): { titleNo: string; path: string } {
  const colon = id.indexOf(':');
  if (colon === -1) return { titleNo: id, path: '' };
  return { titleNo: id.slice(0, colon), path: id.slice(colon + 1) };
}

// ── HTML micro-parser ─────────────────────────────────────────────────────────

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function pick(html: string, re: RegExp, n = 1): string {
  const m = re.exec(html);
  return m ? decode(m[n]) : '';
}

// ── Build Manga from HTML ─────────────────────────────────────────────────────

function buildManga(titleNo: string, genre: string, slug: string, html: string): Manga {
  const title =
    pick(html, /<h1[^>]*>\s*([^<]+)/i) ||
    pick(html, /property="og:title"[^>]+content="([^"]+)"/i) ||
    decode(slug.replace(/-/g, ' '));

  const author =
    pick(html, /class="[^"]*author(?:_area)?[^"]*"[^>]*>\s*<[^>]+>\s*([^<]+)/) ||
    pick(html, /class="[^"]*author[^"]*"[^>]*>([^<]+)/);

  const description =
    pick(html, /property="og:description"[^>]+content="([^"]+)"/i) ||
    pick(html, /class="[^"]*summary[^"]*"[^>]*>([^<]+)/);

  const thumbnail =
    pick(html, /property="og:image"[^>]+content="([^"]+)"/i) ||
    pick(html, /src="(https:\/\/webtoon-phinf\.pstatic\.net[^"]+)"/);

  const isCompleted = /completed/i.test(
    pick(html, /class="[^"]*day_schedule[^"]*"[^>]*>([^<]+)/),
  );

  return {
    id: makeId(titleNo, genre, slug),
    source: 'webtoon',
    title: { userPreferred: title, english: title },
    coverImage: thumbnail,
    description: description || undefined,
    type: 'WEBTOON',
    genres: [genre.replace(/-/g, ' ')],
    tags: [],
    status: isCompleted ? 'COMPLETED' : 'ONGOING',
    authors: author ? [author] : [],
    countryOfOrigin: 'KR',
    availableReadingLanguages: ['en'],
    externalLinks: [
      { site: 'WEBTOON', url: `${BASE}/en/${genre}/${slug}/list?title_no=${titleNo}` },
    ],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchManga(
  query: string,
  page = 1,
  _perPage = 20,
): Promise<PaginatedResult<Manga>> {
  try {
    const url = `${BASE}/en/search?keyword=${encodeURIComponent(query)}&webtoonType=WEBTOON&page=${page}`;
    const html = await fetchWT(url);

    const items: Manga[] = [];
    const seen = new Set<string>();

    // Each result card has an anchor pointing to the series list page —
    // relative or absolute depending on the page revision:
    // href="[https://www.webtoons.com]/en/{genre}/{slug}/list?title_no={N}"
    const linkRe =
      /href="(?:https:\/\/www\.webtoons\.com)?\/en\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)\/list\?title_no=(\d+)"/g;
    for (const m of html.matchAll(linkRe)) {
      const [, genre, slug, titleNo] = m;
      const id = makeId(titleNo, genre, slug);
      if (seen.has(id)) continue;
      seen.add(id);

      // Narrow the search to this card: title/author/thumbnail all come after
      // the anchor — looking backwards would catch the previous card's title.
      const idx = m.index ?? 0;
      const card = html.slice(idx, idx + 900);

      const title =
        pick(card, /<strong[^>]*>([^<]+)<\/strong>/) ||
        decode(slug.replace(/-/g, ' '));
      const author = pick(card, /class="[^"]*author[^"]*"[^>]*>([^<]+)/);
      const thumbnail = pick(
        card,
        /src="(https:\/\/webtoon-phinf\.pstatic\.net[^"]+)"/,
      );

      items.push({
        id,
        source: 'webtoon',
        title: { userPreferred: title, english: title },
        coverImage: thumbnail,
        type: 'WEBTOON',
        genres: [],
        tags: [],
        status: 'ONGOING',
        authors: author ? [author] : [],
        countryOfOrigin: 'KR',
        availableReadingLanguages: ['en'],
      });
    }

    return { items, hasNextPage: items.length >= 10, currentPage: page };
  } catch (e) {
    logger.warn('Webtoon search error', { error: String(e) });
    return { items: [], hasNextPage: false, currentPage: page };
  }
}

export async function getMangaById(id: string): Promise<Manga> {
  const { titleNo, path } = parseId(id);
  if (!path) throw new Error(`Webtoon: id invalide "${id}"`);
  const parts = path.split('/');
  const [genre, slug] = [parts[0], parts[1]];
  const html = await fetchWT(`${BASE}/en/${path}/list?title_no=${titleNo}`);
  return buildManga(titleNo, genre, slug, html);
}

export async function getTrackingChapters(id: string): Promise<MangaChapter[]> {
  const { titleNo, path } = parseId(id);
  if (!path) return [];

  // 1. Fetch first page to discover the total page count.
  let page1Html: string;
  try {
    page1Html = await fetchWT(`${BASE}/en/${path}/list?title_no=${titleNo}&page=1`);
  } catch (e) {
    logger.warn('Webtoon chapters: page 1 failed', { error: String(e) });
    return [];
  }

  const pageNums = [...page1Html.matchAll(/title_no=\d+&(?:amp;)?page=(\d+)/g)].map(m =>
    parseInt(m[1]),
  );
  const maxPage = Math.min(pageNums.length > 0 ? Math.max(...pageNums) : 1, 50);

  // 2. Fetch remaining pages in parallel.
  const remainingHtmls = await Promise.all(
    Array.from({ length: Math.max(0, maxPage - 1) }, (_, i) =>
      fetchWT(`${BASE}/en/${path}/list?title_no=${titleNo}&page=${i + 2}`).catch(
        () => '',
      ),
    ),
  );

  // 3. Extract all episode entries.
  const chapters: MangaChapter[] = [];
  const seen = new Set<number>();

  for (const html of [page1Html, ...remainingHtmls]) {
    // href="[https://www.webtoons.com]/en/{genre}/{slug}/{ep-slug}/viewer?title_no=N&[amp;]episode_no=E"
    const epRe =
      /href="(?:https:\/\/www\.webtoons\.com)?(\/en\/[a-zA-Z0-9/_-]+\/viewer\?title_no=\d+&(?:amp;)?episode_no=(\d+))"/g;
    for (const m of html.matchAll(epRe)) {
      const epPath = decode(m[1]); // &amp; → &
      const episodeNo = parseInt(m[2]);
      if (seen.has(episodeNo)) continue;
      seen.add(episodeNo);

      // Pick the episode title from the nearby card HTML
      const idx = m.index ?? 0;
      const card = html.slice(idx, idx + 500);
      const epTitle =
        pick(card, /<span[^>]+class="[^"]*subj[^"]*"[^>]*>(?:<span>)?([^<]+)/) ||
        pick(card, /alt="([^"]+)"/);

      chapters.push({
        id: epPath,
        mangaId: id,
        chapter: String(episodeNo),
        title: epTitle || undefined,
        pages: 0,
        publishAt: '',
        translatedLanguage: 'en',
        isReadable: true,
      });
    }
  }

  return chapters.sort((a, b) => parseInt(a.chapter) - parseInt(b.chapter));
}

// ── Chapter pages: fetch viewer HTML → extract data-url → cache locally ───────

function pageDir(chapterId: string): Directory {
  const safe = chapterId.replace(/[^a-zA-Z0-9]/g, '_').slice(-72);
  return new Directory(Paths.cache, CACHE_DIR, safe);
}

function urlHash(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export async function getChapterPages(chapterId: string): Promise<string[]> {
  // L'identifiant est un CHEMIN concatene a l'hote. Il peut arriver d'un deep
  // link (manga-track://reader/...), donc d'un lien ou d'un QR code tiers :
  // « .evil.com/x » produirait « https://www.webtoons.com.evil.com/x » et
  // enverrait nos en-tetes a un hote arbitraire. On exige un chemin absolu, et
  // on verifie l'hote final.
  if (!chapterId.startsWith('/')) {
    throw new Error('Webtoon: identifiant de chapitre invalide.');
  }
  const target = `${BASE}${chapterId}`;
  if (new URL(target).host !== new URL(BASE).host) {
    throw new Error('Webtoon: identifiant de chapitre invalide.');
  }

  let html: string;
  try {
    html = await fetchWT(target);
  } catch (e) {
    throw new Error(`Webtoon: impossible de charger ce chapitre. ${String(e)}`);
  }

  // Episode panels: <img class="_images" data-url="https://...">, present in
  // the static HTML for Originals AND Canvas. The page also carries data-url
  // on episode-list thumbnails (160px) — matching those shows the same
  // pixelated cover N times. Restrict to the _images class.
  const imageUrls: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]+>/g)) {
    const tag = m[0];
    if (!tag.includes('_images')) continue;
    const urlMatch = /\bdata-url="(https?:\/\/[^"]+)"/.exec(tag);
    if (urlMatch && !urlMatch[1].includes('bg_transparency')) {
      imageUrls.push(urlMatch[1]);
    }
  }

  if (imageUrls.length === 0) {
    // Happens for mature-gated episodes (login wall) — not for regular Canvas.
    throw new Error(
      'Webtoon : cet épisode nécessite une connexion sur webtoons.com (contenu restreint).',
    );
  }

  // Images require Referer: webtoons.com — fetch and cache locally.
  const dir = pageDir(chapterId);
  dir.create({ intermediates: true, idempotent: true });

  const out: string[] = new Array(imageUrls.length);
  let next = 0;

  const worker = async () => {
    while (next < imageUrls.length) {
      const i = next++;
      // Filename keyed on the source URL: a cache entry written by an earlier
      // (buggy or outdated) extraction can never be served for a new URL.
      const file = new File(dir, `${String(i).padStart(3, '0')}_${urlHash(imageUrls[i])}.jpg`);
      if (!file.exists) {
        const res = await fetch(imageUrls[i], { headers: HEADERS });
        if (!res.ok) throw new Error(`Webtoon image ${i}: ${res.status}`);
        file.write(new Uint8Array(await res.arrayBuffer()));
      }
      out[i] = file.uri;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, imageUrls.length) }, worker));

  // Les planches sont retéléchargeables : on borne le cache aux chapitres les
  // plus récents plutôt que de le laisser croître indéfiniment.
  pruneChapterCache(CACHE_DIR);

  return out;
}
