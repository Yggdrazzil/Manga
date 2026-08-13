import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { api } from "@/api/client";
import { EmptyState, ErrorState, Spinner } from "@/components/feedback";

const SOURCE_TYPES = [
  "manual",
  "municipal_akiya_bank",
  "lifull_akiya_bank",
  "athome_akiya_bank",
  "local_agency",
  "public_dataset",
  "other",
];

export function Sources() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sources"],
    queryFn: api.sources,
  });
  const [form, setForm] = useState({ name: "", source_type: "municipal_akiya_bank", base_url: "" });

  const create = useMutation({
    mutationFn: () => api.createSource(form),
    onSuccess: () => {
      setForm({ name: "", source_type: "municipal_akiya_bank", base_url: "" });
      qc.invalidateQueries({ queryKey: ["sources"] });
    },
  });

  const toggleCrawl = useMutation({
    mutationFn: (s: { id: string; crawl_enabled: boolean }) =>
      api.updateSource(s.id, { crawl_enabled: !s.crawl_enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-hero font-extrabold">Sources</h1>
          <p className="text-ink-soft">
            Les sites que l'application surveille. La collecte quotidienne ne visite
            que ceux dont le crawl est activé.
          </p>
        </div>
        <Link to="/catalogue" className="btn btn-primary">
          Parcourir le catalogue →
        </Link>
      </div>

      <form
        className="panel grid gap-3 p-5 sm:grid-cols-[2fr_1.5fr_2fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.name) create.mutate();
        }}
      >
        <div>
          <label className="label" htmlFor="name">Nom</label>
          <input
            id="name"
            className="field"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="type">Type</label>
          <select
            id="type"
            className="field"
            value={form.source_type}
            onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value }))}
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="base_url">URL de base</label>
          <input
            id="base_url"
            className="field"
            value={form.base_url}
            onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={create.isPending}>
          Ajouter
        </button>
      </form>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="aucune source"
          hint="Ajoutez-en depuis le catalogue des 2 159 banques d'akiya officielles."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-strong bg-paper-2">
              <tr>
                {["Nom", "Type", "Crawl", "Dernier crawl", "Dernière erreur"].map((h) => (
                  <th key={h} className="px-4 py-2 font-bold uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-b border-line">
                  <td className="px-4 py-2 font-bold">{s.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.source_type}</td>
                  <td className="px-4 py-2">
                    <button
                      className={`chip transition-colors ${
                        s.crawl_enabled
                          ? "border-moss/40 bg-moss/15 text-moss"
                          : "border-line text-ink-mute"
                      }`}
                      onClick={() =>
                        toggleCrawl.mutate({ id: s.id, crawl_enabled: s.crawl_enabled })
                      }
                      disabled={toggleCrawl.isPending}
                      aria-pressed={s.crawl_enabled}
                      title="Activer ou désactiver la collecte quotidienne pour cette source"
                    >
                      {s.crawl_enabled ? "activé" : "désactivé"}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-ink-soft">
                    {s.last_crawled_at
                      ? new Date(s.last_crawled_at).toLocaleString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-vermilion">{s.last_error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
