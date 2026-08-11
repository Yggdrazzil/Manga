/**
 * Validation d'un fichier de sauvegarde avant import.
 *
 * Le fichier vient du système de fichiers de l'utilisateur : il peut être
 * tronqué, issu d'une autre version, bricolé à la main ou reçu de quelqu'un
 * d'autre. L'ancienne vérification se contentait de constater que `entries`
 * et `bdEntries` étaient des tableaux — une entrée `null` faisait donc planter
 * l'import à mi-parcours, en laissant une bibliothèque à moitié remplie.
 *
 * Politique retenue : on ignore les entrées invalides et on importe le reste,
 * plutôt que de tout rejeter pour une ligne abîmée. L'écran rend compte du
 * nombre d'entrées écartées.
 */

import type { BDSeriesEntry, LibraryEntry, MediaSource, ReadingStatus } from '../types';

const SOURCES: MediaSource[] = ['anilist', 'mangadex', 'jikan', 'comick', 'mangaplus', 'webtoon'];
const STATUSES: ReadingStatus[] = ['READING', 'COMPLETED', 'PLAN_TO_READ', 'DROPPED', 'PAUSED'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 2000;
}

/**
 * Une URL d'image issue d'un fichier tiers ne doit pas pouvoir désigner autre
 * chose qu'une ressource web chiffrée : `javascript:`, `file://` ou un
 * `data:` volumineux n'ont rien à faire dans une couverture.
 */
export function sanitizeImageUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length === 0) return undefined;
  if (v.length > 2000) return undefined;
  return /^https:\/\/[^\s]+$/i.test(v) ? v : undefined;
}

function finiteNumber(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
}

function stringArray(v: unknown, max = 5000): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter(nonEmptyString).slice(0, max);
}

/** Nettoie une entrée manga, ou renvoie null si elle est inexploitable. */
export function sanitizeLibraryEntry(v: unknown): LibraryEntry | null {
  if (!isRecord(v)) return null;
  if (!nonEmptyString(v.mangaId)) return null;
  if (typeof v.source !== 'string' || !SOURCES.includes(v.source as MediaSource)) return null;
  if (typeof v.status !== 'string' || !STATUSES.includes(v.status as ReadingStatus)) return null;

  const manga = v.manga;
  if (!isRecord(manga)) return null;
  const title = isRecord(manga.title) ? manga.title : null;
  if (!title || !nonEmptyString(title.userPreferred)) return null;

  return {
    ...(v as unknown as LibraryEntry),
    mangaId: v.mangaId,
    source: v.source as MediaSource,
    status: v.status as ReadingStatus,
    progress: finiteNumber(v.progress, 0, 100_000) ?? 0,
    score: finiteNumber(v.score, 0, 100),
    readChapterIds: stringArray(v.readChapterIds),
    manga: {
      ...(manga as unknown as LibraryEntry['manga']),
      coverImage: sanitizeImageUrl(manga.coverImage) ?? '',
      bannerImage: sanitizeImageUrl(manga.bannerImage),
    },
  };
}

/** Nettoie une entrée BD, ou renvoie null si elle est inexploitable. */
export function sanitizeComicEntry(v: unknown): BDSeriesEntry | null {
  if (!isRecord(v)) return null;
  if (!nonEmptyString(v.seriesId)) return null;

  const series = v.series;
  if (!isRecord(series)) return null;
  if (!nonEmptyString(series.title)) return null;
  if (!Array.isArray(series.volumes)) return null;

  const volumes = series.volumes
    .filter(isRecord)
    .map(vol => ({
      ...(vol as unknown as BDSeriesEntry['series']['volumes'][number]),
      num: finiteNumber(vol.num, 0, 100_000) ?? -1,
      coverImage: sanitizeImageUrl(vol.coverImage),
    }))
    .filter(vol => vol.num >= 0);

  const readVolumes = Array.isArray(v.readVolumes)
    ? v.readVolumes
        .map(n => finiteNumber(n, 0, 100_000))
        .filter((n): n is number => n !== undefined)
    : [];

  return {
    ...(v as unknown as BDSeriesEntry),
    seriesId: v.seriesId,
    readVolumes,
    series: {
      ...(series as unknown as BDSeriesEntry['series']),
      id: nonEmptyString(series.id) ? series.id : v.seriesId,
      title: series.title,
      coverImage: sanitizeImageUrl(series.coverImage),
      volumes,
      totalVolumes: volumes.length,
    },
  };
}

export interface ParsedBackup {
  entries: LibraryEntry[];
  bdEntries: BDSeriesEntry[];
  /** Entrées écartées parce qu'inexploitables. */
  rejected: number;
}

/** Valide l'enveloppe puis chaque entrée. Renvoie null si l'enveloppe est fausse. */
export function parseBackup(data: unknown): ParsedBackup | null {
  if (!isRecord(data)) return null;
  if (data.version !== 1) return null;
  if (typeof data.exportedAt !== 'string') return null;
  if (!Array.isArray(data.entries) || !Array.isArray(data.bdEntries)) return null;

  // Une sauvegarde démesurée est plus probablement un fichier hostile ou
  // corrompu qu'une bibliothèque réelle.
  const MAX_ENTRIES = 20_000;
  if (data.entries.length > MAX_ENTRIES || data.bdEntries.length > MAX_ENTRIES) return null;

  let rejected = 0;
  const entries: LibraryEntry[] = [];
  for (const raw of data.entries) {
    const clean = sanitizeLibraryEntry(raw);
    if (clean) entries.push(clean);
    else rejected++;
  }

  const bdEntries: BDSeriesEntry[] = [];
  for (const raw of data.bdEntries) {
    const clean = sanitizeComicEntry(raw);
    if (clean) bdEntries.push(clean);
    else rejected++;
  }

  return { entries, bdEntries, rejected };
}
