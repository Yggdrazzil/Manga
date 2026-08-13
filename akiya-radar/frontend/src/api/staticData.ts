/**
 * API adapter for the serverless build.
 *
 * Reads the JSON dataset produced by `scripts/build_static_dataset.py` and
 * merges the user's own state from localStorage on top of it. Filtering,
 * sorting and pagination happen in the browser — the dataset is a few
 * thousand records at most, which is nothing for a client-side filter.
 *
 * Operations that genuinely require a server (importing an arbitrary URL,
 * re-crawling a page, translating through a provider) reject with an explicit
 * message rather than pretending to work: cross-origin rules make it
 * impossible for a page to fetch a municipal akiya bank directly.
 */
import * as local from "@/lib/localState";
import type {
  CatalogPrefecture,
  CatalogResponse,
  DashboardResponse,
  Duplicate,
  ListingDetail,
  ListingFilters,
  ListingListResponse,
  Note,
  SavedSearch,
  Source,
  Task,
} from "@/lib/types";

const DATA_URL = `${import.meta.env.BASE_URL ?? "/"}data/listings.json`.replace("//data", "/data");
const META_URL = `${import.meta.env.BASE_URL ?? "/"}data/meta.json`.replace("//meta", "/meta");

export class StaticModeError extends Error {
  constructor(action: string) {
    super(
      `${action} nécessite le mode serveur. En mode statique, les données sont ` +
        `régénérées par la collecte automatique (voir MISE_EN_SERVICE.md).`,
    );
  }
}

/** Re-apply localStorage on top of a record from the immutable dataset. */
function withLocalState(listing: ListingDetail): ListingDetail {
  const state = local.getState(listing.id);
  return {
    ...listing,
    favorite: state.favorite ?? listing.favorite ?? false,
    personal_status: state.personal_status ?? listing.personal_status ?? "new",
    rating: state.rating ?? listing.rating ?? null,
    notes: (state.notes ?? []) as Note[],
    tasks: (state.tasks ?? []) as Task[],
  };
}

function applyFilters(items: ListingDetail[], f: ListingFilters): ListingDetail[] {
  let out = items;
  if (f.prefecture) out = out.filter((l) => l.prefecture === f.prefecture);
  if (f.city) out = out.filter((l) => l.city === f.city);
  if (f.property_type) out = out.filter((l) => l.property_type === f.property_type);
  if (f.transaction_type) out = out.filter((l) => l.transaction_type === f.transaction_type);
  if (f.personal_status) out = out.filter((l) => l.personal_status === f.personal_status);
  if (f.favorite) out = out.filter((l) => l.favorite);
  if (f.max_price_yen != null)
    out = out.filter((l) => (l.price_yen ?? Infinity) <= f.max_price_yen!);
  if (f.min_land_area_m2 != null)
    out = out.filter((l) => (l.land_area_m2 ?? 0) >= f.min_land_area_m2!);
  if (f.min_building_area_m2 != null)
    out = out.filter((l) => (l.building_area_m2 ?? 0) >= f.min_building_area_m2!);
  if (f.min_score != null)
    out = out.filter((l) => (l.scores.at(-1)?.total_score ?? 0) >= f.min_score!);
  if (f.exclude_critical_flags)
    out = out.filter((l) => !l.flags.some((x) => x.severity === "critical"));
  if (f.query) {
    const q = f.query.toLowerCase();
    out = out.filter((l) =>
      [l.title_original, l.title_fr, l.city, l.prefecture, l.address_text, l.summary_fr]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q)),
    );
  }
  return out;
}

function applySort(items: ListingDetail[], sort: string | undefined): ListingDetail[] {
  const out = [...items];
  const scoreOf = (l: ListingDetail) => l.scores.at(-1)?.total_score ?? -1;
  if (sort === "price_asc") out.sort((a, b) => (a.price_yen ?? Infinity) - (b.price_yen ?? Infinity));
  else if (sort === "price_desc") out.sort((a, b) => (b.price_yen ?? -1) - (a.price_yen ?? -1));
  else if (sort === "score_desc") out.sort((a, b) => scoreOf(b) - scoreOf(a));
  else out.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return out;
}

/** CSV of the whole dataset — separated from the Blob so it can be tested. */
export function toCsv(listings: ListingDetail[]): string {
  const header =
    "titre,prefecture,ville,prix_yen,terrain_m2,bati_m2,annee,score,completude,url\n";
  const rows = listings
    .map((l) =>
      [
        `"${(l.title_original ?? "").replace(/"/g, '""')}"`,
        l.prefecture ?? "",
        l.city ?? "",
        l.price_yen ?? "",
        l.land_area_m2 ?? "",
        l.building_area_m2 ?? "",
        l.build_year ?? "",
        l.scores.at(-1)?.total_score ?? "",
        l.data_completeness ?? "",
        l.source_url,
      ].join(","),
    )
    .join("\n");
  return header + rows;
}

export function createStaticApi() {
  // Per-instance so two adapters never share a dataset; the app builds one.
  let cache: ListingDetail[] | null = null;

  async function loadAll(): Promise<ListingDetail[]> {
    if (cache) return cache;
    const resp = await fetch(DATA_URL);
    if (!resp.ok) {
      throw new Error(
        `Jeu de données introuvable (${DATA_URL}). Lancez la collecte pour le générer.`,
      );
    }
    const raw = (await resp.json()) as ListingDetail[];
    cache = raw.map(withLocalState);
    return cache;
  }

  function refresh(id: string): ListingDetail {
    const index = (cache ?? []).findIndex((l) => l.id === id);
    if (index === -1) throw new Error("Annonce introuvable");
    const updated = withLocalState(cache![index]);
    cache![index] = updated;
    return updated;
  }

  return {
    dashboard: async (): Promise<DashboardResponse> => {
      const all = (await loadAll()).map((l) => withLocalState(l));
      const scoreOf = (l: ListingDetail) => l.scores.at(-1)?.total_score ?? -1;
      return {
        stats: {
          total: all.length,
          new: all.filter((l) => l.personal_status === "new").length,
          favorites: all.filter((l) => l.favorite).length,
          very_interesting: all.filter((l) => l.personal_status === "very_interesting").length,
          critical_flags: all.filter((l) => l.flags.some((f) => f.severity === "critical")).length,
          open_tasks: all.reduce(
            (n, l) => n + l.tasks.filter((t) => t.status !== "done").length,
            0,
          ),
        },
        top_opportunities: [...all]
          .filter((l) => l.listing_status !== "gone" && l.listing_status !== "sold")
          .sort((a, b) => scoreOf(b) - scoreOf(a))
          .slice(0, 5),
        recent_listings: applySort(all, "newest").slice(0, 8),
      };
    },

    listings: async (f: ListingFilters = {}): Promise<ListingListResponse> => {
      const all = (await loadAll()).map((l) => withLocalState(l));
      const filtered = applySort(applyFilters(all, f), f.sort);
      const offset = f.offset ?? 0;
      const limit = f.limit ?? 12;
      return {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      };
    },

    listing: async (id: string): Promise<ListingDetail> => {
      await loadAll();
      return refresh(id);
    },

    setFavorite: async (id: string, favorite: boolean): Promise<ListingDetail> => {
      await loadAll();
      local.patchState(id, { favorite });
      return refresh(id);
    },

    updateListing: async (id: string, body: Record<string, unknown>): Promise<ListingDetail> => {
      await loadAll();
      const allowed: local.ListingLocalState = {};
      if ("personal_status" in body) allowed.personal_status = body.personal_status as string;
      if ("rating" in body) allowed.rating = body.rating as number | null;
      if (Object.keys(allowed).length === 0) throw new StaticModeError("Modifier ce champ");
      local.patchState(id, allowed);
      return refresh(id);
    },

    notes: async (id: string): Promise<Note[]> => (local.getState(id).notes ?? []) as Note[],
    addNote: async (id: string, note: string): Promise<Note> => local.addNote(id, note) as Note,
    deleteNote: async (noteId: string): Promise<void> => {
      const owner = local.findOwner("notes", noteId);
      if (owner) local.removeNote(owner, noteId);
    },

    tasks: async (id: string): Promise<Task[]> => (local.getState(id).tasks ?? []) as Task[],
    addTask: async (id: string, title: string): Promise<Task> => local.addTask(id, title) as Task,
    updateTask: async (taskId: string, body: Record<string, unknown>): Promise<Task> => {
      const owner = local.findOwner("tasks", taskId);
      if (!owner) throw new Error("Tâche introuvable");
      const updated = local.updateTask(owner, taskId, body as Partial<local.LocalTask>);
      if (!updated) throw new Error("Tâche introuvable");
      return updated as Task;
    },
    deleteTask: async (taskId: string): Promise<void> => {
      const owner = local.findOwner("tasks", taskId);
      if (owner) local.removeTask(owner, taskId);
    },

    duplicates: async (_id?: string): Promise<Duplicate[]> => [],

    exportCsv: async (): Promise<Blob> => {
      const all = (await loadAll()).map((l) => withLocalState(l));
      return new Blob([toCsv(all)], { type: "text/csv;charset=utf-8" });
    },

    // Sources and catalogue are informational here: registering one has no
    // effect until the next CI build, which is driven by its own configuration.
    sources: async (): Promise<Source[]> => {
      const resp = await fetch(META_URL);
      if (!resp.ok) return [];
      const meta = (await resp.json()) as {
        generated_at: string;
        sources: { key: string; name: string; listings: number }[];
      };
      return meta.sources.map((s) => ({
        id: s.key,
        name: s.name,
        source_type: "static",
        base_url: null,
        municipality: null,
        prefecture: null,
        crawl_enabled: true,
        crawl_frequency_days: 1,
        last_crawled_at: meta.generated_at,
        last_error: s.listings === 0 ? "Aucune annonce lors de la dernière collecte" : null,
        created_at: meta.generated_at,
        updated_at: meta.generated_at,
      }));
    },
    createSource: async (_body?: Record<string, unknown>): Promise<Source> => {
      throw new StaticModeError("Ajouter une source");
    },
    updateSource: async (_id?: string, _body?: Record<string, unknown>): Promise<Source> => {
      throw new StaticModeError("Modifier une source");
    },
    deleteSource: async (_id?: string): Promise<void> => {
      throw new StaticModeError("Supprimer une source");
    },
    catalog: async (_params?: Record<string, unknown>): Promise<CatalogResponse> => ({ items: [], total: 0, limit: 0, offset: 0 }),
    catalogPrefectures: async (): Promise<CatalogPrefecture[]> => [],
    catalogAdd: async (_keys?: string[], _crawl?: boolean): Promise<{ added: Source[]; skipped: string[] }> => {
      throw new StaticModeError("Ajouter des sources");
    },

    savedSearches: async (): Promise<SavedSearch[]> => [],
    createSavedSearch: async (_body?: Record<string, unknown>): Promise<SavedSearch> => {
      throw new StaticModeError("Enregistrer une recherche");
    },
    runSavedSearch: async (_id?: string): Promise<ListingDetail[]> => [],
    deleteSavedSearch: async (_id?: string): Promise<void> => undefined,

    importUrl: async (_url: string) => {
      throw new StaticModeError("L'import d'une URL");
    },
    refreshListing: async (_id: string) => {
      throw new StaticModeError("Re-vérifier une annonce");
    },
    enrich: async (_id: string) => {
      throw new StaticModeError("Ré-enrichir");
    },
    rescore: async (_id: string) => {
      throw new StaticModeError("Recalculer le score");
    },
    detectFlags: async (_id: string) => {
      throw new StaticModeError("Relancer la détection");
    },
    geocodeListing: async (_id: string) => {
      throw new StaticModeError("Le géocodage manuel");
    },
    checkHazard: async (_id: string) => {
      throw new StaticModeError("La vérification manuelle des risques");
    },
    comps: async (_id?: string) => ({
      available: false,
      reason:
        "Les comparables MLIT nécessitent une clé API côté serveur — indisponibles en mode statique.",
      comps: [],
      median_unit_price: null,
      sample_size: 0,
    }),
    nearestStation: async (_id?: string) => ({
      found: false,
      name: null,
      distance_km: null,
      lat: null,
      lon: null,
      operator: null,
    }),
    translateText: async (text: string) => ({
      translated: text,
      provider: "none",
    }),
    deleteListing: async (_id?: string): Promise<void> => {
      throw new StaticModeError("Supprimer une annonce");
    },
    createListing: async (_body?: Record<string, unknown>) => {
      throw new StaticModeError("Créer une annonce");
    },
  };
}
