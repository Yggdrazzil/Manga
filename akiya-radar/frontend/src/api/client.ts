import type {
  DashboardResponse,
  Duplicate,
  ImportResult,
  ListingDetail,
  ListingFilters,
  ListingListResponse,
  Note,
  SavedSearch,
  Source,
  Task,
} from "@/lib/types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(resp.status, detail);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

function toQuery(filters: ListingFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  dashboard: () => request<DashboardResponse>("/dashboard"),

  listings: (filters: ListingFilters = {}) =>
    request<ListingListResponse>(`/listings${toQuery(filters)}`),
  listing: (id: string) => request<ListingDetail>(`/listings/${id}`),
  createListing: (body: Record<string, unknown>) =>
    request<ListingDetail>("/listings", { method: "POST", body: JSON.stringify(body) }),
  updateListing: (id: string, body: Record<string, unknown>) =>
    request<ListingDetail>(`/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteListing: (id: string) =>
    request<void>(`/listings/${id}`, { method: "DELETE" }),
  importUrl: (url: string) =>
    request<ImportResult>("/listings/import-url", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  duplicates: (id: string) => request<Duplicate[]>(`/listings/${id}/duplicates`),
  setFavorite: (id: string, favorite: boolean) =>
    request<ListingDetail>(`/listings/${id}/favorite`, {
      method: "POST",
      body: JSON.stringify({ favorite }),
    }),
  enrich: (id: string) =>
    request<ListingDetail>(`/listings/${id}/enrich`, { method: "POST" }),
  rescore: (id: string) =>
    request<ListingDetail>(`/listings/${id}/score`, { method: "POST" }),
  detectFlags: (id: string) =>
    request<ListingDetail>(`/listings/${id}/detect-flags`, { method: "POST" }),

  notes: (listingId: string) => request<Note[]>(`/listings/${listingId}/notes`),
  addNote: (listingId: string, note: string) =>
    request<Note>(`/listings/${listingId}/notes`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  deleteNote: (noteId: string) =>
    request<void>(`/notes/${noteId}`, { method: "DELETE" }),

  tasks: (listingId: string) => request<Task[]>(`/listings/${listingId}/tasks`),
  addTask: (listingId: string, title: string) =>
    request<Task>(`/listings/${listingId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  updateTask: (taskId: string, body: Record<string, unknown>) =>
    request<Task>(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTask: (taskId: string) =>
    request<void>(`/tasks/${taskId}`, { method: "DELETE" }),

  sources: () => request<Source[]>("/sources"),
  createSource: (body: Record<string, unknown>) =>
    request<Source>("/sources", { method: "POST", body: JSON.stringify(body) }),

  savedSearches: () => request<SavedSearch[]>("/saved-searches"),
  createSavedSearch: (body: Record<string, unknown>) =>
    request<SavedSearch>("/saved-searches", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runSavedSearch: (id: string) =>
    request<ListingListResponse["items"]>(`/saved-searches/${id}/run`, {
      method: "POST",
    }),
  deleteSavedSearch: (id: string) =>
    request<void>(`/saved-searches/${id}`, { method: "DELETE" }),
};

export { ApiError };
