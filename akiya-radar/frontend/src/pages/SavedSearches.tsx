import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/api/client";
import { EmptyState, ErrorState, Spinner } from "@/components/feedback";
import { ListingCard } from "@/components/ListingCard";
import type { ListingSummary } from "@/lib/types";

export function SavedSearches() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["saved-searches"],
    queryFn: api.savedSearches,
  });
  const [name, setName] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [results, setResults] = useState<ListingSummary[] | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const criteria: Record<string, unknown> = {};
      if (prefecture) criteria.prefecture = prefecture;
      if (maxPrice) criteria.max_price_yen = Number(maxPrice);
      return api.createSavedSearch({ name, criteria_json: criteria });
    },
    onSuccess: () => {
      setName("");
      setPrefecture("");
      setMaxPrice("");
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });

  const run = useMutation({
    mutationFn: (id: string) => api.runSavedSearch(id),
    onSuccess: (data) => setResults(data),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteSavedSearch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Recherches sauvegardées</h1>

      <form
        className="panel grid gap-3 p-5 sm:grid-cols-[2fr_1.5fr_1.5fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (name) create.mutate();
        }}
      >
        <div>
          <label className="label" htmlFor="sname">Nom</label>
          <input id="sname" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="spref">Préfecture</label>
          <input id="spref" className="field" value={prefecture} onChange={(e) => setPrefecture(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="sprice">Prix max (¥)</label>
          <input id="sprice" type="number" className="field" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={create.isPending}>
          Enregistrer
        </button>
      </form>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="aucune recherche" hint="Créez votre première recherche sauvegardée." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((s) => (
            <li key={s.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">{s.name}</p>
                <p className="break-all font-mono text-xs text-ink-mute">{JSON.stringify(s.criteria_json)}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn" onClick={() => run.mutate(s.id)}>
                  Lancer
                </button>
                <button
                  className="btn border-vermilion text-vermilion"
                  aria-label="Supprimer"
                  onClick={() => del.mutate(s.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {results && (
        <section>
          <h2 className="mb-3 font-display text-2xl font-bold">
            Résultats ({results.length})
          </h2>
          {results.length === 0 ? (
            <p className="text-ink-soft">Aucun bien ne correspond.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
