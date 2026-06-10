import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getChaptersForLibrary } from '@/lib/api/mangadex';
import { useLibraryStore } from '@/lib/store/library';
import { useSettingsStore } from '@/lib/store/settings';
import type { LibraryEntry } from '@/lib/types';

const NOTIFIED_IDS_KEY = 'notified-chapter-keys';
const LAST_CHECK_KEY = 'last-chapter-check';
const BACKGROUND_TASK = 'check-new-chapters';
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 600;
const MAX_INDIVIDUAL_NOTIFS = 4;

const isSupported = Platform.OS !== 'web';

if (isSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!isSupported) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('new-chapters', {
      name: 'Nouveaux chapitres',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: undefined,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Stores rehydrate asynchronously — mandatory before reading them from a
// background task, where the JS context boots cold.
async function waitForHydration(): Promise<void> {
  const stores = [useLibraryStore, useSettingsStore] as const;
  await Promise.all(
    stores.map(store =>
      store.persist.hasHydrated()
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            const unsub = store.persist.onFinishHydration(() => {
              unsub();
              resolve();
            });
          }),
    ),
  );
}

function chapterKey(mangaDexId: string, chapter: string, lang: string): string {
  return `${mangaDexId}:${chapter}:${lang}`;
}

/**
 * Fetches the 14-day MangaDex feed for every library entry with a MangaDex id,
 * and fires a local notification for each chapter not seen before.
 *
 * First run seeds the seen-set silently so enabling the setting doesn't flood
 * the user with two weeks of history.
 */
export async function checkNewChaptersAndNotify(options?: { force?: boolean }): Promise<number> {
  if (!isSupported) return 0;

  await waitForHydration();

  const { notifications, scanLang } = useSettingsStore.getState();
  if (!notifications) return 0;

  const perms = await Notifications.getPermissionsAsync();
  if (!perms.granted) return 0;

  const now = Date.now();
  if (!options?.force) {
    const lastCheck = Number(await AsyncStorage.getItem(LAST_CHECK_KEY)) || 0;
    if (now - lastCheck < CHECK_INTERVAL_MS) return 0;
  }
  await AsyncStorage.setItem(LAST_CHECK_KEY, String(now));

  const { entries } = useLibraryStore.getState();
  const idMap = new Map<string, LibraryEntry>();
  for (const e of entries) {
    if (e.status === 'DROPPED' || e.status === 'COMPLETED') continue;
    if (e.source === 'mangadex') idMap.set(e.mangaId, e);
    else if (e.manga.mangadexId) idMap.set(e.manga.mangadexId, e);
  }
  if (idMap.size === 0) return 0;

  const langs = scanLang === 'fr' ? ['fr', 'en'] : ['en', 'fr'];
  const chapters = await getChaptersForLibrary(Array.from(idMap.keys()), langs);

  const readIds = new Set(entries.flatMap(e => e.readChapterIds ?? []));
  const seenRaw = await AsyncStorage.getItem(NOTIFIED_IDS_KEY);
  const isFirstRun = seenRaw == null;
  const seen = new Set<string>(seenRaw ? (JSON.parse(seenRaw) as string[]) : []);

  // One notification per manga+chapter number; a chapter available in both
  // languages counts once (preferred language wins, feed is publishAt-desc).
  const fresh: Array<{ entry: LibraryEntry; chapter: string; chapterId: string }> = [];
  const batchKeys = new Set<string>();
  for (const ch of chapters) {
    const entry = idMap.get(ch.mangaId);
    if (!entry) continue;
    const numKey = chapterKey(ch.mangaId, ch.chapter, '');
    const key = chapterKey(ch.mangaId, ch.chapter, ch.translatedLanguage);
    const known = seen.has(key) || seen.has(numKey) || batchKeys.has(numKey);
    seen.add(key);
    seen.add(numKey);
    if (known || batchKeys.has(numKey)) continue;
    batchKeys.add(numKey);
    if (readIds.has(ch.id)) continue;
    if (!isFirstRun) fresh.push({ entry, chapter: ch.chapter, chapterId: ch.id });
  }

  const trimmed = Array.from(seen).slice(-MAX_TRACKED_KEYS);
  await AsyncStorage.setItem(NOTIFIED_IDS_KEY, JSON.stringify(trimmed));

  if (fresh.length === 0) return 0;

  if (fresh.length <= MAX_INDIVIDUAL_NOTIFS) {
    for (const { entry, chapter } of fresh) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: entry.manga.title.userPreferred,
          body: `Le chapitre ${chapter} est disponible !`,
          data: { mangaId: entry.mangaId, source: entry.source },
        },
        trigger: null,
      });
    }
  } else {
    const titles = Array.from(new Set(fresh.map(f => f.entry.manga.title.userPreferred)));
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${fresh.length} nouveaux chapitres`,
        body: titles.slice(0, 3).join(', ') + (titles.length > 3 ? '…' : ''),
        data: {},
      },
      trigger: null,
    });
  }

  return fresh.length;
}

// Must run at module scope so the task exists when the OS wakes the app.
if (isSupported) {
  TaskManager.defineTask(BACKGROUND_TASK, async () => {
    try {
      await checkNewChaptersAndNotify({ force: true });
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundCheck(): Promise<void> {
  if (!isSupported) return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, {
      minimumInterval: 60, // minutes — OS decides actual cadence
    });
  } catch {
    // Background tasks unavailable (Expo Go, simulators) — foreground checks still run
  }
}

export async function unregisterBackgroundCheck(): Promise<void> {
  if (!isSupported) return;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
    if (registered) await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK);
  } catch {
    // best effort
  }
}
