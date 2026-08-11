import { Directory, File, Paths } from 'expo-file-system';
import type { Manga, MangaChapter, OngoingStatus, PaginatedResult } from '../types';
import { logger } from '../utils/logger';

// MANGA Plus by Shueisha — official free reader (One Piece, Jujutsu Kaisen,
// Chainsaw Man, Spy x Family, …). The web API returns JSON when `format=json`
// is set; chapter images are XOR-encrypted with a per-page key.
const API = 'https://jumpg-webapi.tokyo-cdn.com/api';
const WEB = 'https://mangaplus.shueisha.co.jp';
const CACHE_DIR = 'mangaplus-pages';

const HEADERS: Record<string, string> = {
  Origin: WEB,
  Referer: `${WEB}/`,
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
};

// ── Raw MangaPlus JSON types ──────────────────────────────────────────────────

// Language is the default (English) when absent; otherwise an enum name.
type MPLanguage = 'ENGLISH' | 'SPANISH' | 'FRENCH' | 'PORTUGUESE_BR' | 'INDONESIAN'
  | 'RUSSIAN' | 'THAI' | 'GERMAN' | 'VIETNAMESE' | string;

interface MPTitle {
  titleId: number;
  name: string;
  author?: string;
  portraitImageUrl?: string;
  landscapeImageUrl?: string;
  viewCount?: number;
  language?: MPLanguage;
}

interface MPChapter {
  titleId: number;
  chapterId: number;
  name?: string;       // "#1", "#1052", "ex"
  subTitle?: string;
  startTimeStamp?: number;
  endTimeStamp?: number;
  isVerticalOnly?: boolean;
}

interface MPChapterListGroup {
  firstChapterList?: MPChapter[];
  midChapterList?: MPChapter[];
  lastChapterList?: MPChapter[];
}

interface MPTitleDetailView {
  title: MPTitle;
  titleImageUrl?: string;
  overview?: string;
  viewingPeriodDescription?: string;
  nonAppearanceInfo?: string;
  chapterListGroup?: MPChapterListGroup[];
  // Older response shape kept some lists at the top level.
  firstChapterList?: MPChapter[];
  lastChapterList?: MPChapter[];
  isSimulReleased?: boolean;
}

interface MPMangaPage {
  imageUrl: string;
  width?: number;
  height?: number;
  encryptionKey?: string;
}

interface MPPage {
  mangaPage?: MPMangaPage;
}

// ── Web home / daily updates (powers MangaPlus' "Nouveautés" screen) ──────────
// One title that updated, as surfaced by the web home feed. The home view nests
// these under dated/themed groups. Field names drift across API revisions and
// some are only present on actual updates (not on featured/ranked tiles), which
// we use to keep the feed to genuine releases.
interface MPUpdatedTitle {
  title?: MPTitle;
  // Update marker: "NEW" (brand-new series) or "UPDATED" (new chapter).
  titleUpdateStatus?: string;
  updateStatus?: string;
  // Latest chapter info when the home view carries it.
  chapter?: MPChapter;
  latestChapter?: MPChapter;
  updatedTimeStamp?: number;
}

interface MPWebHomeGroup {
  // Heading shown in the app (a date or a theme like "Today's update").
  title?: string;
  groupName?: string;
  theTitle?: string;
  // Updated titles live either directly or one nesting level down.
  titles?: MPUpdatedTitle[];
  titleGroups?: Array<{ titleGroupName?: string; titles?: MPUpdatedTitle[] }>;
}

interface MPWebHomeView {
  groups?: MPWebHomeGroup[];
  updatedTitleGroups?: MPWebHomeGroup[];
}

interface MPResponse {
  success?: {
    // The JSON casing of this key has flipped between API revisions.
    allTitlesViewV2?: {
      allTitlesGroup?: Array<{ titles?: MPTitle[] }>;
      AllTitlesGroup?: Array<{ titles?: MPTitle[] }>;
    };
    titleDetailView?: MPTitleDetailView;
    mangaViewer?: { pages?: MPPage[] };
    // Web home feed — key has carried a version suffix across revisions.
    webHomeViewV4?: MPWebHomeView;
    webHomeViewV3?: MPWebHomeView;
    webHomeView?: MPWebHomeView;
  };
  // L'API répond 200 avec ce corps quand elle refuse la requête. Selon les
  // révisions, le message arrive dans `popups` ou dans `englishPopup`.
  error?: {
    popups?: Array<{ subject?: string; body?: string }>;
    englishPopup?: { subject?: string; body?: string };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function langToCode(lang?: MPLanguage): 'en' | 'fr' | null {
  if (lang == null || lang === 'ENGLISH') return 'en';
  if (lang === 'FRENCH') return 'fr';
  return null; // language we don't surface (es, pt-br, …)
}

async function fetchMP<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(`${API}${path}`);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { ...HEADERS, 'SESSION-TOKEN': uuid() },
  });
  if (!res.ok) throw new Error(`MangaPlus error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

function chapterLabel(name?: string): string {
  if (!name) return '0';
  const cleaned = name.replace(/[^0-9.]/g, '');
  return cleaned.length > 0 ? cleaned : name;
}

function normalizeTitle(t: MPTitle): Manga {
  const code = langToCode(t.language);
  return {
    id: String(t.titleId),
    source: 'mangaplus',
    title: { userPreferred: t.name, english: t.name },
    coverImage: t.portraitImageUrl ?? t.landscapeImageUrl ?? '',
    type: 'MANGA',
    genres: [],
    tags: [],
    status: 'ONGOING',
    authors: t.author ? t.author.split(/\s*\/\s*/).filter(Boolean) : [],
    countryOfOrigin: 'JP',
    availableReadingLanguages: code ? [code] : undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

let allTitlesCache: { at: number; titles: MPTitle[] } | null = null;
const ALL_TITLES_TTL = 1000 * 60 * 30;

async function getAllTitles(): Promise<MPTitle[]> {
  if (allTitlesCache && Date.now() - allTitlesCache.at < ALL_TITLES_TTL) {
    return allTitlesCache.titles;
  }
  const data = await fetchMP<MPResponse>('/title_list/allV2');
  const view = data.success?.allTitlesViewV2;
  const groups = view?.allTitlesGroup ?? view?.AllTitlesGroup ?? [];
  const titles = groups.flatMap(g => g.titles ?? []);
  allTitlesCache = { at: Date.now(), titles };
  return titles;
}

export async function searchManga(
  query: string,
  page = 1,
  perPage = 20,
): Promise<PaginatedResult<Manga>> {
  const q = query.trim().toLowerCase();
  if (!q) return { items: [], hasNextPage: false, currentPage: page };

  let titles: MPTitle[];
  try {
    titles = await getAllTitles();
  } catch (e) {
    logger.warn('MangaPlus search failed', { error: String(e) });
    return { items: [], hasNextPage: false, currentPage: page };
  }

  // MangaPlus has no server-side search: filter the full catalogue locally on
  // name/author, keeping only languages we can surface (en/fr).
  const matched = titles.filter(t => {
    if (langToCode(t.language) == null) return false;
    return t.name.toLowerCase().includes(q) || (t.author ?? '').toLowerCase().includes(q);
  });

  // A series exists once per language. Prefer French, fall back to English.
  const byName = new Map<string, MPTitle>();
  for (const t of matched) {
    const key = t.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing || (langToCode(t.language) === 'fr' && langToCode(existing.language) !== 'fr')) {
      byName.set(key, t);
    }
  }

  const items = [...byName.values()]
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    .slice((page - 1) * perPage, page * perPage)
    .map(normalizeTitle);

  return { items, hasNextPage: byName.size > page * perPage, currentPage: page };
}

export async function getMangaById(titleId: string): Promise<Manga> {
  const data = await fetchMP<MPResponse>('/title_detailV3', { title_id: titleId });
  const view = data.success?.titleDetailView;
  if (!view) throw new Error('MangaPlus: title not found');

  const t = view.title;
  const code = langToCode(t.language);
  const ongoing: OngoingStatus = view.nonAppearanceInfo?.includes('completed')
    ? 'COMPLETED'
    : 'ONGOING';

  return {
    id: String(t.titleId),
    source: 'mangaplus',
    title: { userPreferred: t.name, english: t.name },
    coverImage: view.titleImageUrl ?? t.portraitImageUrl ?? '',
    description: view.overview ?? undefined,
    type: 'MANGA',
    genres: [],
    tags: [],
    status: ongoing,
    authors: t.author ? t.author.split(/\s*\/\s*/).filter(Boolean) : [],
    countryOfOrigin: 'JP',
    externalLinks: [{ site: 'MANGA Plus', url: `${WEB}/titles/${t.titleId}` }],
    availableReadingLanguages: code ? [code] : undefined,
  };
}

export async function getTrackingChapters(titleId: string): Promise<MangaChapter[]> {
  const data = await fetchMP<MPResponse>('/title_detailV3', { title_id: titleId });
  const view = data.success?.titleDetailView;
  if (!view) return [];

  const code = langToCode(view.title.language) ?? 'en';

  // Free chapters are the early run + the most recent run. Mid chapters need a
  // subscription, so they come back read-only (checkable, not openable).
  const groups = view.chapterListGroup ?? [];
  const free: MPChapter[] = [
    ...(view.firstChapterList ?? []),
    ...(view.lastChapterList ?? []),
    ...groups.flatMap(g => [...(g.firstChapterList ?? []), ...(g.lastChapterList ?? [])]),
  ];
  const locked: MPChapter[] = groups.flatMap(g => g.midChapterList ?? []);

  const seen = new Set<number>();
  const out: MangaChapter[] = [];

  const push = (ch: MPChapter, readable: boolean) => {
    if (seen.has(ch.chapterId)) return;
    seen.add(ch.chapterId);
    out.push({
      id: String(ch.chapterId),
      mangaId: titleId,
      chapter: chapterLabel(ch.name),
      title: ch.subTitle ?? undefined,
      pages: 0,
      publishAt: ch.startTimeStamp ? new Date(ch.startTimeStamp * 1000).toISOString() : '',
      translatedLanguage: readable ? code : '',
      isReadable: readable,
    });
  };

  for (const ch of free) push(ch, true);
  for (const ch of locked) push(ch, false);

  return out.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
}

// ── Daily releases (global MangaPlus "Nouveautés" feed) ────────────────────────

export interface MangaPlusRelease {
  manga: Manga;
  // Chapter number label without the leading '#', e.g. "1052". Absent when the
  // home view didn't carry chapter detail.
  chapterLabel?: string;
  chapterSubtitle?: string;
  // ISO timestamp of the release, or '' when unknown (grouped under "today").
  publishAt: string;
  // True for brand-new series or freshly-released chapters.
  isNew: boolean;
  viewCount?: number;
}

function isUpdateStatus(status?: string): boolean {
  const s = (status ?? '').toUpperCase();
  return s === 'NEW' || s === 'UPDATED' || s === 'UPDATE' || s === 'RE_EDITION';
}

/**
 * Flatten the web home view into a de-duplicated release list.
 *
 * Pure (no I/O) so it can be unit-tested against a recorded fixture: the live
 * endpoint can't be reached from CI, only from a residential IP. We keep only
 * entries that carry an explicit update marker — the home view also returns
 * featured/ranked tiles, and without a marker they'd masquerade as releases.
 */
export function parseDailyReleases(data: MPResponse): MangaPlusRelease[] {
  const view =
    data.success?.webHomeViewV4 ??
    data.success?.webHomeViewV3 ??
    data.success?.webHomeView;
  if (!view) return [];

  const groups = view.groups ?? view.updatedTitleGroups ?? [];
  const out: MangaPlusRelease[] = [];
  const seen = new Set<number>();

  for (const g of groups) {
    const updated: MPUpdatedTitle[] = [
      ...(g.titles ?? []),
      ...(g.titleGroups ?? []).flatMap(tg => tg.titles ?? []),
    ];

    for (const u of updated) {
      const t = u.title;
      if (!t || t.titleId == null || !t.name) continue;
      if (!isUpdateStatus(u.titleUpdateStatus ?? u.updateStatus)) continue;
      if (langToCode(t.language) == null) continue; // en/fr only
      if (seen.has(t.titleId)) continue;
      seen.add(t.titleId);

      const ch = u.chapter ?? u.latestChapter;
      const ts = ch?.startTimeStamp ?? u.updatedTimeStamp;

      out.push({
        manga: normalizeTitle(t),
        chapterLabel: ch?.name ? chapterLabel(ch.name) : undefined,
        chapterSubtitle: ch?.subTitle ?? undefined,
        publishAt: ts ? new Date(ts * 1000).toISOString() : '',
        isNew: (u.titleUpdateStatus ?? u.updateStatus ?? '').toUpperCase() === 'NEW',
        viewCount: t.viewCount,
      });
    }
  }

  return out;
}

/**
 * Today's MangaPlus chapter releases (published daily ~17:00 Paris time).
 * Global feed — every updated series, not just the user's library.
 */
export async function getDailyReleases(lang: 'fr' | 'en' = 'fr'): Promise<MangaPlusRelease[]> {
  // On laisse remonter l'erreur : l'écran doit pouvoir distinguer « MANGA Plus
  // est injoignable » de « aucune sortie aujourd'hui ». Un catch qui renvoyait
  // [] rendait l'état d'erreur inatteignable et affichait « revenez plus tard »
  // sur une panne réseau.
  // La langue était codée en dur sur l'anglais alors que l'app est en français
  // et que MANGA Plus publie un catalogue français.
  const data = await fetchMP<MPResponse>('/web/web_homeV4', {
    lang: lang === 'fr' ? 'fra' : 'eng',
  });

  // L'API répond 200 avec un corps d'erreur (ex. « Account Banned » quand
  // l'adresse IP est bloquée) — sans ça, on afficherait une liste vide.
  const popup = data.error?.popups?.[0] ?? data.error?.englishPopup;
  if (popup) {
    throw new Error(popup.subject ?? 'MANGA Plus a refusé la requête');
  }

  const releases = parseDailyReleases(data);
  if (releases.length === 0) {
    logger.warn('MangaPlus daily releases: réponse sans sortie exploitable');
  }
  return releases;
}

// ── Chapter pages: download + XOR-decrypt to a local cache ─────────────────────

function pageDir(chapterId: string): Directory {
  return new Directory(Paths.cache, CACHE_DIR, chapterId);
}

/**
 * MangaPlus images are obfuscated with a repeating-key XOR cipher. The key is a
 * per-page hex string; an empty/absent key means the bytes are already plain.
 * Decryption is in-place and returns the same buffer for convenience.
 */
export function xorDecrypt(bytes: Uint8Array, keyHex?: string): Uint8Array {
  if (!keyHex || keyHex.length === 0) return bytes;
  const keyBytes = (keyHex.match(/.{1,2}/g) ?? []).map(h => parseInt(h, 16));
  if (keyBytes.length === 0) return bytes;
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= keyBytes[i % keyBytes.length];
  return bytes;
}

async function fetchAndDecrypt(page: MPMangaPage, file: File): Promise<void> {
  const res = await fetch(page.imageUrl, { headers: HEADERS });
  if (!res.ok) throw new Error(`MangaPlus image error: ${res.status}`);
  const bytes = xorDecrypt(new Uint8Array(await res.arrayBuffer()), page.encryptionKey);
  file.write(bytes);
}

export async function getChapterPages(chapterId: string): Promise<string[]> {
  const data = await fetchMP<MPResponse>('/manga_viewer', {
    chapter_id: chapterId,
    split: 'yes',
    img_quality: 'super_high',
  });

  const pages = (data.success?.mangaViewer?.pages ?? [])
    .map(p => p.mangaPage)
    .filter((p): p is MPMangaPage => !!p && !!p.imageUrl);

  if (pages.length === 0) {
    const popup = data.error?.popups?.[0];
    throw new Error(popup?.body ?? 'MangaPlus: chapitre indisponible (abonnement requis)');
  }

  const dir = pageDir(chapterId);
  dir.create({ intermediates: true, idempotent: true });

  const out: string[] = new Array(pages.length);
  let next = 0;
  const worker = async () => {
    while (next < pages.length) {
      const i = next++;
      const file = new File(dir, `${String(i).padStart(3, '0')}.jpg`);
      if (!file.exists) await fetchAndDecrypt(pages[i], file);
      out[i] = file.uri;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, pages.length) }, worker));

  return out;
}

export async function findMangaPlusId(title: string): Promise<string | null> {
  try {
    const { items } = await searchManga(title, 1, 5);
    if (items.length === 0) return null;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const q = norm(title);
    return items.find(m => norm(m.title.userPreferred) === q)?.id ?? items[0].id;
  } catch {
    return null;
  }
}
