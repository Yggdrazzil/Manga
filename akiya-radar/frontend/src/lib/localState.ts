/**
 * Personal state for the serverless build.
 *
 * In static mode the listing dataset is a read-only JSON file rebuilt by CI, so
 * anything the *user* owns — favourites, statuses, ratings, notes, tasks — has
 * to live somewhere else. It lives here, in localStorage, keyed by the stable
 * listing id (a hash of the source URL) so it survives every rebuild.
 *
 * The trade-off is deliberate and worth stating plainly: this state is tied to
 * one browser on one device. Backing up means exporting it.
 */

export interface LocalNote {
  id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface LocalTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListingLocalState {
  favorite?: boolean;
  personal_status?: string;
  rating?: number | null;
  notes?: LocalNote[];
  tasks?: LocalTask[];
}

type Store = Record<string, ListingLocalState>;

const KEY = "akiya.local-state.v1";

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota or private mode — the session keeps working, nothing persists */
  }
}

export function getState(listingId: string): ListingLocalState {
  return read()[listingId] ?? {};
}

export function patchState(listingId: string, patch: ListingLocalState): ListingLocalState {
  const store = read();
  const next = { ...(store[listingId] ?? {}), ...patch };
  store[listingId] = next;
  write(store);
  return next;
}

export function addNote(listingId: string, note: string): LocalNote {
  const now = new Date().toISOString();
  const entry: LocalNote = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    note,
    created_at: now,
    updated_at: now,
  };
  const current = getState(listingId);
  patchState(listingId, { notes: [entry, ...(current.notes ?? [])] });
  return entry;
}

export function removeNote(listingId: string, noteId: string): void {
  const current = getState(listingId);
  patchState(listingId, { notes: (current.notes ?? []).filter((n) => n.id !== noteId) });
}

export function addTask(listingId: string, title: string): LocalTask {
  const now = new Date().toISOString();
  const entry: LocalTask = {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    status: "todo",
    due_date: null,
    created_at: now,
    updated_at: now,
  };
  const current = getState(listingId);
  patchState(listingId, { tasks: [entry, ...(current.tasks ?? [])] });
  return entry;
}

export function updateTask(
  listingId: string,
  taskId: string,
  patch: Partial<LocalTask>,
): LocalTask | null {
  const current = getState(listingId);
  let updated: LocalTask | null = null;
  const tasks = (current.tasks ?? []).map((t) => {
    if (t.id !== taskId) return t;
    updated = { ...t, ...patch, updated_at: new Date().toISOString() };
    return updated;
  });
  patchState(listingId, { tasks });
  return updated;
}

export function removeTask(listingId: string, taskId: string): void {
  const current = getState(listingId);
  patchState(listingId, { tasks: (current.tasks ?? []).filter((t) => t.id !== taskId) });
}

/** Find which listing a note or task belongs to (the API is keyed by its id). */
export function findOwner(kind: "notes" | "tasks", itemId: string): string | null {
  const store = read();
  for (const [listingId, state] of Object.entries(store)) {
    if ((state[kind] ?? []).some((x: { id: string }) => x.id === itemId)) return listingId;
  }
  return null;
}

/** Everything the user has entered, for backup. */
export function exportAll(): string {
  return JSON.stringify(read(), null, 2);
}

export function importAll(json: string): void {
  const parsed = JSON.parse(json) as Store;
  if (typeof parsed !== "object" || parsed === null) throw new Error("format invalide");
  write(parsed);
}
