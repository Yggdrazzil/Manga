import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "@/api/client";
import { EmptyState, ErrorState, ListingGridSkeleton } from "@/components/feedback";
import { ListingCard } from "@/components/ListingCard";
import { propertyTypeLabel } from "@/lib/format";
import type { ListingFilters, ListingSort, ListingSummary } from "@/lib/types";

const PAGE_SIZE = 12;
const DEBOUNCE_MS = 350;

// Map the legacy ?sort= values kept in URLs to the server-side vocabulary.
const SORT_ALIASES: Record<string, ListingSort> = {
  recent: "newest",
  score: "score_desc",
  price: "price_asc",
};

export function Listings() {
  const [params, setParams] = useSearchParams();
  const rawSort = params.get("sort") ?? "newest";
  const sort: ListingSort = (SORT_ALIASES[rawSort] ?? rawSort) as ListingSort;
  const [filters, setFilters] = useState<ListingFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);
  const activeFilterCount = Object.keys(filters).length;
  const queryClient = useQueryClient();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const queryFilters: ListingFilters = {
    ...filters,
    sort,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["listings", queryFilters],
    queryFn: () => api.listings(queryFilters),
    placeholderData: (prev) => prev,
  });

  const favorite = useMutation({
    mutationFn: (l: ListingSummary) => api.setFavorite(l.id, !l.favorite),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listings"] }),
  });

  const exporting = useMutation({
    mutationFn: async () => {
      const blob = await api.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "akiya-radar-export.csv";
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const items = data?.items ?? [];

  const applyPatch = (patch: Partial<ListingFilters>) => {
    setPage(0);
    setFilters((f) => {
      const next = { ...f, ...patch };
      Object.keys(next).forEach((k) => {
        const key = k as keyof ListingFilters;
        if (next[key] === "" || next[key] === undefined) delete next[key];
      });
      return next;
    });
  };

  // Text inputs are debounced so we don't fire one API request per keystroke.
  const update = (patch: Partial<ListingFilters>, debounce = false) => {
    if (!debounce) {
      applyPatch(patch);
      return;
    }
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => applyPatch(patch), DEBOUNCE_MS);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="panel h-fit p-4 lg:sticky lg:top-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold">
            Filtres
            {activeFilterCount > 0 && (
              <span className="ml-2 rounded-full bg-vermilion px-2 py-0.5 align-middle text-xs font-bold text-paper">
                {activeFilterCount}
              </span>
            )}
          </h2>
          {/* On a phone the full filter form fills the first screen, pushing
              every listing below the fold. It collapses there and stays open
              on desktop, where the sidebar costs nothing. */}
          <button
            type="button"
            className="btn text-sm lg:hidden"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="listing-filters"
          >
            {filtersOpen ? "Masquer" : "Filtrer"}
          </button>
        </div>
        <form
          id="listing-filters"
          className={`mt-3 space-y-3 lg:block ${filtersOpen ? "" : "hidden"}`}
          onSubmit={(e) => e.preventDefault()}
        >
          <div>
            <label className="label" htmlFor="q">Recherche</label>
            <input
              id="q"
              className="field"
              placeholder="ville, mot-clé…"
              defaultValue={filters.query ?? ""}
              onChange={(e) => update({ query: e.target.value }, true)}
            />
          </div>
          <div>
            <label className="label" htmlFor="pref">Préfecture</label>
            <input
              id="pref"
              className="field"
              placeholder="例: 福井県"
              onChange={(e) => update({ prefecture: e.target.value }, true)}
            />
          </div>
          <div>
            <label className="label" htmlFor="price">Prix max (¥)</label>
            <input
              id="price"
              type="number"
              className="field"
              placeholder="5000000"
              onChange={(e) =>
                update({ max_price_yen: e.target.value ? Number(e.target.value) : undefined }, true)
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="land">Terrain min (m²)</label>
            <input
              id="land"
              type="number"
              className="field"
              onChange={(e) =>
                update(
                  { min_land_area_m2: e.target.value ? Number(e.target.value) : undefined },
                  true,
                )
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="ptype">Type de bien</label>
            <select
              id="ptype"
              className="field"
              value={filters.property_type ?? ""}
              onChange={(e) => update({ property_type: e.target.value || undefined })}
            >
              <option value="">Tous</option>
              {Object.entries(propertyTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ttype">Transaction</label>
            <select
              id="ttype"
              className="field"
              value={filters.transaction_type ?? ""}
              onChange={(e) => update({ transaction_type: e.target.value || undefined })}
            >
              <option value="">Vente et location</option>
              <option value="sale">Vente</option>
              <option value="rent">Location</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="score">Score min</label>
            <input
              id="score"
              type="number"
              className="field"
              min={0}
              max={100}
              onChange={(e) =>
                update({ min_score: e.target.value ? Number(e.target.value) : undefined }, true)
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4 accent-vermilion"
              onChange={(e) => update({ favorite: e.target.checked || undefined })}
            />
            Favoris uniquement
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4 accent-vermilion"
              onChange={(e) => update({ exclude_critical_flags: e.target.checked || undefined })}
            />
            Exclure red flags critiques
          </label>
        </form>
      </aside>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold">
            Annonces{" "}
            <span className="text-lg font-normal text-ink-mute">
              {data ? `(${data.total})` : ""}
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-bold">
              Trier
              <select
                className="field w-auto py-1"
                value={sort}
                onChange={(e) => setParams({ sort: e.target.value })}
              >
                <option value="newest">Récent</option>
                <option value="score_desc">Score ↓</option>
                <option value="price_asc">Prix ↑</option>
                <option value="price_desc">Prix ↓</option>
              </select>
            </label>
            <button
              className="btn text-sm"
              onClick={() => exporting.mutate()}
              disabled={exporting.isPending}
              title="Exporter toutes les annonces en CSV"
            >
              {exporting.isPending ? "Export…" : "⬇ CSV"}
            </button>
          </div>
        </div>

        {isLoading ? (
          <ListingGridSkeleton count={PAGE_SIZE} />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState title="aucun bien" hint="Ajustez vos filtres ou importez une annonce." />
        ) : (
          <>
            <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((l) => (
                <ListingCard key={l.id} listing={l} onToggleFavorite={favorite.mutate} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  className="btn"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  ← Précédent
                </button>
                <span className="font-bold">
                  {page + 1} / {totalPages}
                </span>
                <button
                  className="btn"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
