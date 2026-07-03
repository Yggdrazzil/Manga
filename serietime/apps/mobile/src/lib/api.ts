import { useAppStore } from './store.js';
import { flushOfflineQueue, queueOfflineMutation } from './offlineQueue.js';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public body?: unknown,
  ) {
    super(code);
  }
}

export function serverUrl(): string {
  return useAppStore.getState().serverUrl ?? '';
}

export function tmdbImage(path: string | null | undefined, size = 'w342'): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { serverUrl, token } = useAppStore.getState();
  if (!serverUrl) throw new ApiError(0, 'no_server');
  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    useAppStore.getState().logout();
    throw new ApiError(401, 'unauthorized');
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'request_failed', data);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// Mutation tolérante hors ligne (spec §33.2) : mise en queue si le réseau échoue.
export async function offlineTolerantPost(path: string, body?: unknown): Promise<void> {
  try {
    await api.post(path, body);
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0) throw err;
    queueOfflineMutation({ type: 'POST', path, body });
  }
}

export async function checkHealth(url: string): Promise<{ ok: boolean; app: string; version: string }> {
  const res = await fetch(`${url.replace(/\/+$/, '')}/health`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new ApiError(res.status, 'invalid_response');
  const data = (await res.json()) as { ok?: boolean; app?: string; version?: string };
  if (data.ok !== true || data.app !== 'SerieTime') throw new ApiError(200, 'invalid_server');
  return data as { ok: boolean; app: string; version: string };
}

export async function uploadImportZip(
  file: File,
  force: boolean,
  onProgress: (pct: number) => void,
): Promise<{ importId?: string; error?: string; status?: string; message?: string }> {
  const { serverUrl, token } = useAppStore.getState();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${serverUrl}/api/import/tvtime/upload${force ? '?force=true' : ''}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new ApiError(xhr.status, 'invalid_response'));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'network_error'));
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

// Rejoue la queue offline au retour du réseau.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushOfflineQueue(api.post));
  setTimeout(() => void flushOfflineQueue(api.post), 3000);
}
