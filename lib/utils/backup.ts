import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useLibraryStore } from '@/lib/store/library';
import { useComicsStore } from '@/lib/store/comics';
import type { LibraryEntry, BDSeriesEntry } from '@/lib/types';

interface BackupData {
  version: number;
  exportedAt: string;
  entries: LibraryEntry[];
  bdEntries: BDSeriesEntry[];
}

export async function exportLibrary(): Promise<void> {
  const { entries } = useLibraryStore.getState();
  const { entries: bdEntries } = useComicsStore.getState();

  const payload: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
    bdEntries,
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `manga-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File(Paths.cache, filename);
  file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Exporter la bibliothèque' });
}

export interface ImportResult {
  mangaAdded: number;
  bdAdded: number;
  skipped: number;
}

export async function importLibrary(): Promise<ImportResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new Error('CANCELLED');
  }

  const pickedFile = new File(result.assets[0].uri);
  const raw = await pickedFile.text();

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Fichier invalide — ce n'est pas un fichier JSON.");
  }

  if (!isBackupData(data)) {
    throw new Error('Format de sauvegarde non reconnu. Vérifiez que le fichier vient bien de cette application.');
  }

  const libraryStore = useLibraryStore.getState();
  const comicsStore = useComicsStore.getState();

  let mangaAdded = 0;
  let bdAdded = 0;
  let skipped = 0;

  for (const entry of data.entries) {
    const existing = libraryStore.getEntry(entry.mangaId, entry.source);
    if (existing) {
      skipped++;
    } else {
      libraryStore.addEntry(entry.manga, entry.status);
      if (entry.readChapterIds?.length) {
        for (const chId of entry.readChapterIds) {
          libraryStore.markChapterRead(entry.mangaId, entry.source, chId);
        }
      }
      if (entry.progress > 0) {
        libraryStore.updateProgress(entry.mangaId, entry.source, entry.progress);
      }
      if (entry.score != null) {
        libraryStore.updateScore(entry.mangaId, entry.source, entry.score);
      }
      mangaAdded++;
    }
  }

  for (const bdEntry of data.bdEntries) {
    const existing = comicsStore.getEntry(bdEntry.seriesId);
    if (existing) {
      skipped++;
    } else {
      comicsStore.addOrUpdateSeries(bdEntry.series);
      for (const vol of bdEntry.readVolumes) {
        comicsStore.toggleVolumeRead(bdEntry.seriesId, vol);
      }
      bdAdded++;
    }
  }

  return { mangaAdded, bdAdded, skipped };
}

function isBackupData(v: unknown): v is BackupData {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return (
    d.version === 1 &&
    typeof d.exportedAt === 'string' &&
    Array.isArray(d.entries) &&
    Array.isArray(d.bdEntries)
  );
}
