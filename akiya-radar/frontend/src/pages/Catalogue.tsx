import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

import { api } from "@/api/client";
import { EmptyState, ErrorState, Skeleton } from "@/components/feedback";
import type { CatalogEntry } from "@/lib/types";

const PAGE_SIZE = 30;
const DEBOUNCE_MS = 300;

/** Sources whose pages share one template and yield complete listings. */
const STRUCTURED = "athome_municipal";

export function Catalogue() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [structuredOnly, setStructuredOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const params = {
    query: query || undefined,
    prefecture: prefecture || undefined,
    adapter: structuredOnly ? STRUCTURED : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const catalog = useQuery({
    queryKey: ["catalog", params],
    queryFn: () => api.catalog(params),
    placeholderData: (prev) => prev,
  });

  const prefectures = useQuery({
    queryKey: ["catalog-prefectures"],
    queryFn: api.catalogPrefectures,
    staleTime: Infinity, // Bundled data — it cannot change while the app runs.
  });

  const add = useMutation({
    mutationFn: (vars: { keys: string[]; crawl: boolean }) =>
      api.catalogAdd(vars.keys, vars.crawl),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["sources"] });
    },
  });

  const onSearch = (value: string) => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setQuery(value);
      setPage(0);
    }, DEBOUNCE_MS);
  };

  const items = catalog.data?.items ?? [];
  const total = catalog.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const totals = useMemo(() => {
    const rows = prefectures.data ?? [];
    return {
      sources: rows.reduce((n, r) => n + r.total, 0),
      structured: rows.reduce((n, r) => n + r.structured, 0),
    };
  }, [prefectures.data]);

  const addable = items.filter((e) => !e.registered);
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div className="space-y-6">
      <header className="stagger space-y-2">
        <h1 className="font-display text-hero font-extrabold">Catalogue des sources</h1>
        <p className="max-w-2xl text-ink-soft">
          {totals.sources > 0 ? (
            <>
              <strong>{totals.sources.toLocaleString("fr-FR")}</strong> banques d'akiya
              officielles réparties sur les 47 préfectures, recensées depuis l'annuaire
              du ministère japonais (MLIT) et le réseau At Home, plus les portails
              nationaux. Les{" "}
              <strong>{totals.structured.toLocaleString("fr-FR")}</strong> sources
              « structurées » partagent un même gabarit : ce sont celles qui
              remplissent une fiche complète automatiquement.
            </>
          ) : (
            "Banques d'akiya officielles recensées depuis les annuaires publics."
          )}
        </p>
        <div className="rule" />
      </header>

      <section className="panel p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cat-q">
                Rechercher une commune ou un site
              </label>
              <input
                id="cat-q"
                className="field"
                placeholder="敦賀市, Fukui, akiya-athome…"
                defaultValue={query}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="cat-pref">
                Préfecture
              </label>
              <select
                id="cat-pref"
                className="field"
                value={prefecture}
                onChange={(e) => {
                  setPrefecture(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Toutes les préfectures</option>
                {(prefectures.data ?? []).map((p) => (
                  <option key={p.prefecture} value={p.prefecture}>
                    {p.prefecture} ({p.total})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4 accent-vermilion"
              checked={structuredOnly}
              onChange={(e) => {
                setStructuredOnly(e.target.checked);
                setPage(0);
              }}
            />
            Sources structurées uniquement
          </label>
        </div>

        {selected.size > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-vermilion/30 bg-vermilion-soft p-3 animate-scale-in">
            <span className="font-bold">
              {selected.size} source{selected.size > 1 ? "s" : ""} sélectionnée
              {selected.size > 1 ? "s" : ""}
            </span>
            <button
              className="btn btn-primary text-sm"
              disabled={add.isPending}
              onClick={() => add.mutate({ keys: [...selected], crawl: false })}
            >
              {add.isPending ? "Ajout…" : "Ajouter (sans crawl)"}
            </button>
            <button
              className="btn text-sm"
              disabled={add.isPending}
              onClick={() => add.mutate({ keys: [...selected], crawl: true })}
              title="La collecte quotidienne récupérera les annonces de ces sources"
            >
              Ajouter + activer la collecte
            </button>
            <button className="btn text-sm" onClick={() => setSelected(new Set())}>
              Annuler
            </button>
          </div>
        )}

        {addable.length > 0 && selected.size === 0 && (
          <button
            className="btn mt-4 text-sm"
            onClick={() => setSelected(new Set(addable.map((e) => e.key)))}
          >
            Tout sélectionner sur cette page ({addable.length})
          </button>
        )}

        {add.isError && (
          <p className="mt-3 text-sm font-semibold text-vermilion" role="alert">
            Échec de l'ajout : {(add.error as Error).message}
          </p>
        )}
        {add.isSuccess && add.data.added.length > 0 && (
          <p className="mt-3 text-sm font-semibold text-moss" role="status">
            {add.data.added.length} source(s) ajoutée(s).
          </p>
        )}
      </section>

      {catalog.isLoading ? (
        <div className="space-y-2" role="status" aria-label="Chargement du catalogue">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : catalog.error ? (
        <ErrorState
          message={(catalog.error as Error).message}
          onRetry={() => catalog.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="aucune source"
          hint="Essayez un autre terme ou une autre préfecture."
        />
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            {total.toLocaleString("fr-FR")} résultat{total > 1 ? "s" : ""}
          </p>
          <ul className="space-y-2">
            {items.map((entry) => (
              <CatalogRow
                key={entry.key}
                entry={entry}
                selected={selected.has(entry.key)}
                onToggle={() => toggle(entry.key)}
              />
            ))}
          </ul>

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
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
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function CatalogRow({
  entry,
  selected,
  onToggle,
}: {
  entry: CatalogEntry;
  selected: boolean;
  onToggle: () => void;
}) {
  const structured = entry.adapter === STRUCTURED;
  const prefectural = entry.scope === "prefectural";

  return (
    <li
      className={`panel flex flex-wrap items-center gap-3 p-3 transition-colors ${
        selected ? "border-vermilion bg-vermilion-soft" : ""
      }`}
    >
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 accent-vermilion disabled:opacity-40"
        checked={selected}
        disabled={entry.registered}
        onChange={onToggle}
        aria-label={`Sélectionner ${entry.name}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold">{entry.name}</p>
          {entry.scope === "national" ? (
            <span className="chip border-indigo/40 bg-indigo/5 text-indigo">portail national</span>
          ) : prefectural ? (
            <span className="chip border-gold/40 bg-gold/10 text-gold">portail préfectoral</span>
          ) : structured ? (
            <span className="chip border-moss/40 bg-moss/10 text-moss">structurée</span>
          ) : (
            <span className="chip border-line text-ink-mute">site municipal</span>
          )}
          {entry.requires_js && (
            <span
              className="chip border-vermilion/30 bg-vermilion-soft text-vermilion"
              title="Site en JavaScript : la collecte passe par un navigateur, donc plus lente"
            >
              navigateur requis
            </span>
          )}
          {entry.registered && (
            <span className="chip border-indigo/40 bg-indigo/10 text-indigo">déjà ajoutée</span>
          )}
        </div>
        <p className="truncate text-sm text-ink-soft">
          {[entry.prefecture, entry.municipality].filter(Boolean).join(" · ") || "National"}
        </p>
        {entry.notes_fr && <p className="mt-1 text-xs text-ink-mute">{entry.notes_fr}</p>}
      </div>
      <a
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn shrink-0 text-sm"
      >
        Ouvrir ↗
      </a>
    </li>
  );
}
