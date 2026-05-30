/**
 * BnF SRU — Bibliothèque nationale de France catalogue
 * Best free authoritative source for French BD structure:
 * tome numbers, French episode titles, publisher, dates.
 * Returns no synopses (catalogue only), but covers every French BD
 * via legal deposit (dépôt légal).
 */

const BNF_SRU = 'https://catalogue.bnf.fr/api/SRU';

// ── XML helpers (no external parser — DC XML is simple enough) ────────────────

function decodeXMLEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function extractTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:dc:)?${tag}[^>]*>([^<]+)</(?:dc:)?${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const v = decodeXMLEntities(m[1].trim());
    if (v) out.push(v);
  }
  return out;
}

function extractRecordBlocks(xml: string): string[] {
  const out: string[] = [];
  const re = /<srw:recordData[^>]*>([\s\S]*?)<\/srw:recordData>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

// ── Title parsing ─────────────────────────────────────────────────────────────

// Handles: "Lanfeust de Troy. 1, L'ivoire du Magohamoth (Nouv. éd.) / scénario..."
// Also:    "Lanfeust de Troy. 1, L'ivoire du Magohamoth"
const TOME_TITLE_RE = /\.\s*(\d{1,3})\s*,\s*([^/([\n]+)/;

export function parseBnFTitle(full: string): { num?: number; episode: string } {
  const m = TOME_TITLE_RE.exec(full);
  if (m) {
    return { num: parseInt(m[1], 10), episode: m[2].trim().replace(/\s*$/, '') };
  }
  // fallback: strip everything after " / " or " ("
  const episode = full.split(/\s*\/\s*/)[0].split(/\s*\(/)[0].trim();
  return { episode };
}

function cleanAuthor(raw: string): string {
  // BnF format: "Christophe Arleston. Auteur" or "Arleston. Scénariste"
  return raw.replace(/\.\s*(Auteur|Scénariste|Dessinateur|Coloriste|Illustrateur|Développeur|Traducteur)[^,]*/gi, '').trim();
}

function cleanPublisher(raw: string): string {
  // BnF format: "Soleil (Toulon)" or "Hachette collections (Paris)"
  return raw.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

// ── Main search ───────────────────────────────────────────────────────────────

export interface BnFTome {
  num: number;
  episode: string;        // French episode title, e.g. "L'Ivoire du Magohamoth"
  fullTitle: string;      // as stored in BnF
  authors: string[];
  publisher: string;
  publishedDate?: string;
}

export async function searchBnFSeries(seriesTitle: string): Promise<BnFTome[]> {
  const params = new URLSearchParams({
    version: '1.2',
    operation: 'searchRetrieve',
    query: `bib.title all "${seriesTitle}"`,
    maximumRecords: '100',
    recordSchema: 'dublincore',
  });

  const res = await fetch(`${BNF_SRU}?${params}`, {
    headers: { 'User-Agent': 'MangaTrackerApp/1.0' },
  });
  if (!res.ok) throw new Error(`BnF SRU ${res.status}`);
  const xml = await res.text();

  const records = extractRecordBlocks(xml);
  const byNum = new Map<number, BnFTome>();

  for (const rec of records) {
    const titles = extractTags(rec, 'title');
    if (!titles.length) continue;

    const mainTitle = titles[0];
    // Only process numbered-tome records
    const { num, episode } = parseBnFTitle(mainTitle);
    if (!num) continue;
    if (byNum.has(num)) continue;   // first occurrence wins (usually original Soleil edition)

    const creators = extractTags(rec, 'creator').map(cleanAuthor).filter(Boolean);
    const contribs = extractTags(rec, 'contributor').map(cleanAuthor).filter(Boolean);
    const pubs = extractTags(rec, 'publisher');
    const dates = extractTags(rec, 'date');

    byNum.set(num, {
      num,
      episode,
      fullTitle: mainTitle,
      authors: [...new Set([...creators, ...contribs])].slice(0, 4),
      publisher: pubs.length ? cleanPublisher(pubs[0]) : '',
      publishedDate: dates[0],
    });
  }

  return Array.from(byNum.values()).sort((a, b) => a.num - b.num);
}
