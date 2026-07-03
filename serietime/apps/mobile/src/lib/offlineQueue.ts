// Queue de mutations offline (spec §33.2) persistée en localStorage.
export type OfflineMutation = {
  id: string;
  type: string;
  path: string;
  body?: unknown;
  createdAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
};

const KEY = 'serietime-offline-queue';

function load(): OfflineMutation[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OfflineMutation[];
  } catch {
    return [];
  }
}

function save(queue: OfflineMutation[]): void {
  localStorage.setItem(KEY, JSON.stringify(queue));
}

export function queueOfflineMutation(m: { type: string; path: string; body?: unknown }): void {
  const queue = load();
  queue.push({
    id: crypto.randomUUID(),
    ...m,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    retryCount: 0,
  });
  save(queue);
}

export function pendingOfflineCount(): number {
  return load().filter((m) => m.syncStatus === 'pending').length;
}

let flushing = false;

export async function flushOfflineQueue(
  post: (path: string, body?: unknown) => Promise<unknown>,
): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let synced = 0;
  try {
    const queue = load();
    // Priorité à la dernière action utilisateur : rejouées dans l'ordre chronologique.
    for (const m of queue) {
      if (m.syncStatus !== 'pending') continue;
      try {
        await post(m.path, m.body);
        m.syncStatus = 'synced';
        synced++;
      } catch (err) {
        m.retryCount++;
        m.lastError = err instanceof Error ? err.message : String(err);
        if (m.retryCount >= 5) m.syncStatus = 'failed';
        break; // réseau probablement toujours indisponible
      }
    }
    save(queue.filter((m) => m.syncStatus !== 'synced'));
  } finally {
    flushing = false;
  }
  return synced;
}
