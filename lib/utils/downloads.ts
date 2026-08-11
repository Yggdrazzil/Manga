import { Directory, File, Paths } from 'expo-file-system';
import { getChapterPages as getMDChapterPages } from '@/lib/api/mangadex';
import { getChapterPages as getCKChapterPages } from '@/lib/api/comick';
import { useDownloadsStore, type DownloadedChapter } from '@/lib/store/downloads';
import { useSettingsStore } from '@/lib/store/settings';

const ROOT_DIR = 'chapter-downloads';
const CONCURRENCY = 3;

/**
 * Les identifiants de chapitre viennent de sources distantes et servent de nom
 * de repertoire. Un « ../ » sortirait de chapter-downloads/ — et ce repertoire
 * est supprime lors du nettoyage, ce qui pourrait effacer le stockage
 * applicatif. On n'accepte donc qu'un jeu de caracteres sur : tout le reste est
 * translitere, et un identifiant qui se viderait est refuse.
 */
export function safeDirName(chapterId: string): string {
  const safe = chapterId.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '_');
  return safe.slice(0, 120);
}

function chapterDir(chapterId: string): Directory {
  const name = safeDirName(chapterId);
  if (!name) throw new Error('Identifiant de chapitre invalide.');
  return new Directory(Paths.document, ROOT_DIR, name);
}

/** Local page URIs for a downloaded chapter, or null if absent/corrupted. */
export function getLocalPages(chapterId: string): string[] | null {
  const entry = useDownloadsStore.getState().downloads[chapterId];
  if (!entry) return null;
  const dir = chapterDir(chapterId);
  if (!dir.exists) return null;
  return entry.pageFiles.map(name => new File(dir, name).uri);
}

export interface DownloadChapterParams {
  chapterId: string;
  source: 'mangadex' | 'comick';
  mangaTitle: string;
  chapter: string;
  title?: string;
}

/**
 * Downloads every page of a chapter into the document directory.
 * MangaDex page URLs expire after ~15 min, so pages are fetched and stored
 * immediately. Progress is exposed through the downloads store.
 */
export async function downloadChapter(params: DownloadChapterParams): Promise<void> {
  const { chapterId, source, mangaTitle, chapter, title } = params;
  const store = useDownloadsStore.getState();
  if (store.downloads[chapterId] || store.progress[chapterId] != null) return;

  store.setProgress(chapterId, 0);
  try {
    const dataSaver = useSettingsStore.getState().dataSaver;
    const urls = source === 'comick'
      ? await getCKChapterPages(chapterId)
      : await getMDChapterPages(chapterId, dataSaver);
    if (urls.length === 0) throw new Error('Aucune page disponible pour ce chapitre.');

    const dir = chapterDir(chapterId);
    dir.create({ intermediates: true, idempotent: true });

    const pageFiles: string[] = new Array(urls.length);
    let done = 0;
    let sizeBytes = 0;
    let next = 0;

    const worker = async () => {
      while (next < urls.length) {
        const i = next++;
        const ext = urls[i].match(/\.(jpe?g|png|webp|gif)(?:[?#]|$)/i)?.[1]?.toLowerCase() ?? 'jpg';
        const name = `${String(i).padStart(3, '0')}.${ext}`;
        const file = new File(dir, name);
        await File.downloadFileAsync(urls[i], file, { idempotent: true });
        pageFiles[i] = name;
        sizeBytes += file.size;
        done++;
        useDownloadsStore.getState().setProgress(chapterId, done / urls.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

    const entry: DownloadedChapter = {
      chapterId,
      source,
      mangaTitle,
      chapter,
      title,
      pageFiles,
      sizeBytes,
      downloadedAt: new Date().toISOString(),
    };
    useDownloadsStore.getState().addDownload(entry);
  } catch (e) {
    try {
      const dir = chapterDir(chapterId);
      if (dir.exists) dir.delete();
    } catch {
      // partial cleanup is best effort
    }
    throw e;
  } finally {
    useDownloadsStore.getState().setProgress(chapterId, null);
  }
}

export function deleteChapterDownload(chapterId: string): void {
  try {
    const dir = chapterDir(chapterId);
    if (dir.exists) dir.delete();
  } catch {
    // file already gone — still drop the store entry
  }
  useDownloadsStore.getState().removeDownload(chapterId);
}

export function clearAllDownloads(): void {
  try {
    const root = new Directory(Paths.document, ROOT_DIR);
    if (root.exists) root.delete();
  } catch {
    // best effort
  }
  useDownloadsStore.getState().clearAll();
}

export function getDownloadsTotalSize(): number {
  const { downloads } = useDownloadsStore.getState();
  return Object.values(downloads).reduce((sum, d) => sum + d.sizeBytes, 0);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 o';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}
