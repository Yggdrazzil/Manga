import type {
  CatalogPrefecture,
  CatalogResponse,
  CompsResult,
  RefreshResult,
  StationResult,
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

import { createMockApi } from "./mock";
import { createStaticApi } from "./staticData";

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

const realApi = {
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
  geocodeListing: (id: string) =>
    request<ListingDetail>(`/listings/${id}/geocode`, { method: "POST" }),
  checkHazard: (id: string) =>
    request<ListingDetail>(`/listings/${id}/hazard`, { method: "POST" }),
  refreshListing: (id: string) =>
    request<RefreshResult>(`/listings/${id}/refresh`, { method: "POST" }),
  comps: (id: string) => request<CompsResult>(`/listings/${id}/comps`),
  nearestStation: (id: string) =>
    request<StationResult>(`/listings/${id}/nearest-station`),
  exportCsv: async (): Promise<Blob> => {
    const resp = await fetch(`${BASE}/listings/export.csv`);
    if (!resp.ok) throw new ApiError(resp.status, resp.statusText);
    return resp.blob();
  },
  translateText: (text: string) =>
    request<{ translated: string; provider: string }>("/translate", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
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
  updateSource: (id: string, body: Record<string, unknown>) =>
    request<Source>(`/sources/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSource: (id: string) => request<void>(`/sources/${id}`, { method: "DELETE" }),

  catalog: (params: {
    query?: string;
    prefecture?: string;
    adapter?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    return request<CatalogResponse>(`/sources/catalog?${qs.toString()}`);
  },
  catalogPrefectures: () => request<CatalogPrefecture[]>("/sources/catalog/prefectures"),
  catalogAdd: (keys: string[], crawlEnabled: boolean) =>
    request<{ added: Source[]; skipped: string[] }>("/sources/catalog/add", {
      method: "POST",
      body: JSON.stringify({ keys, crawl_enabled: crawlEnabled }),
    }),

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

/**
 * Which backend the app talks to.
 *
 * - `VITE_MOCK=1` — self-contained preview on fabricated data.
 * - `VITE_DATA_MODE=static` — no server at all: a JSON dataset rebuilt by CI,
 *   with the user's own state kept in the browser.
 * - default — the FastAPI backend.
 */
function selectApi(): typeof realApi {
  if (import.meta.env.VITE_MOCK === "1") {
    return createMockApi() as unknown as typeof realApi;
  }
  if (import.meta.env.VITE_DATA_MODE === "static") {
    return createStaticApi() as unknown as typeof realApi;
  }
  return realApi;
}

export const IS_STATIC_MODE = import.meta.env.VITE_DATA_MODE === "static";

export const api: typeof realApi = selectApi();

export { ApiError };
