import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "@/api/client";
import { EmptyState, ErrorState, Spinner } from "@/components/feedback";
import { ListingCard } from "@/components/ListingCard";
import { latestScore, type ListingFilters, type ListingSummary } from "@/lib/types";

const PAGE_SIZE = 12;

export function Listings() {
  const [params, setParams] = useSearchParams();
  const sort = params.get("sort") ?? "recent";
  const [filters, setFilters] = useState<ListingFilters>({});
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();

  const queryFilters: ListingFilters = {
    ...filters,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["listings", queryFilters],
    queryFn: () => api.listings(queryFilters),
  });

  const favorite = useMutation({
    mutationFn: (l: ListingSummary) => api.setFavorite(l.id, !l.favorite),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listings"] }),
  });

  const items = useMemo(() => {
    const list = data?.items ?? [];
    if (sort === "score") {
      return [...list].sort(
        (a, b) => (latestScore(b)?.total_score ?? -1) - (latestScore(a)?.total_score ?? -1),
      );
    }
    if (sort === "price") {
      return [...list].sort((a, b) => (a.price_yen ?? Infinity) - (b.price_yen ?? Infinity));
    }
    return list;
  }, [data, sort]);

  const update = (patch: Partial<ListingFilters>) => {
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

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="panel h-fit p-4 lg:sticky lg:top-4">
        <h2 className="font-display text-xl font-bold">Filtres</h2>
        <form className="mt-3 space-y-3" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="label" htmlFor="q">Recherche</label>
            <input
              id="q"
              className="field"
              placeholder="ville, mot-clé…"
              defaultValue={filters.query ?? ""}
              onChange={(e) => update({ query: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="pref">Préfecture</label>
            <input
              id="pref"
              className="field"
              placeholder="例: 福井県"
              onChange={(e) => update({ prefecture: e.target.value })}
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
                update({ max_price_yen: e.target.value ? Number(e.target.value) : undefined })
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
                update({
                  min_land_area_m2: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
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
                update({ min_score: e.target.value ? Number(e.target.value) : undefined })
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
          <label className="flex items-center gap-2 text-sm font-bold">
            Trier
            <select
              className="field w-auto py-1"
              value={sort}
              onChange={(e) => setParams({ sort: e.target.value })}
            >
              <option value="recent">Récent</option>
              <option value="score">Score ↓</option>
              <option value="price">Prix ↑</option>
            </select>
          </label>
        </div>

        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState title="aucun bien" hint="Ajustez vos filtres ou importez une annonce." />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
