import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import { DuplicateBanner } from "@/components/DuplicateBanner";
import { FlagBadge } from "@/components/FlagBadge";
import { fmtArea, fmtYen } from "@/lib/format";
import type { ImportResult } from "@/lib/types";

export function ImportUrl() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const qc = useQueryClient();

  const importMut = useMutation({
    mutationFn: () => api.importUrl(url.trim()),
    onSuccess: (res) => {
      setResult(res);
      const data = res.listing;
      setForm({
        title_original: data.title_original ?? "",
        description_original: data.description_original ?? "",
        price_yen: data.price_yen != null ? String(data.price_yen) : "",
        prefecture: data.prefecture ?? "",
        city: data.city ?? "",
        land_area_m2: data.land_area_m2 != null ? String(data.land_area_m2) : "",
        building_area_m2: data.building_area_m2 != null ? String(data.building_area_m2) : "",
        build_year: data.build_year != null ? String(data.build_year) : "",
      });
    },
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v === "") return;
        body[k] = ["price_yen", "land_area_m2", "building_area_m2", "build_year"].includes(k)
          ? Number(v)
          : v;
      });
      return api.updateListing(result!.listing.id, body);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/listings/${data.id}`);
    },
  });

  const field = (key: string, label: string, type = "text") => (
    <div>
      <label className="label" htmlFor={key}>
        {label}
      </label>
      <input
        id={key}
        type={type}
        className="field"
        value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Importer une annonce</h1>
        <p className="text-ink-soft">
          Collez l'URL d'une annonce japonaise. Une fiche éditable est toujours créée, même si
          l'extraction automatique échoue.
        </p>
      </div>

      <form
        className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) importMut.mutate();
        }}
      >
        <div className="flex-1">
          <label className="label" htmlFor="url">
            URL source
          </label>
          <input
            id="url"
            className="field"
            placeholder="https://akiya.example.jp/bukken/0001"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={importMut.isPending}>
          {importMut.isPending ? "Import…" : "Importer"}
        </button>
      </form>

      {importMut.isError && (
        <p className="panel border-vermilion p-4 text-vermilion" role="alert">
          {(importMut.error as Error).message}
        </p>
      )}

      {result && result.possible_duplicates.length > 0 && (
        <section className="panel animate-reveal-up border-vermilion p-5">
          <DuplicateBanner duplicates={result.possible_duplicates} />
        </section>
      )}

      {result && (
        <section className="panel animate-reveal-up p-5">
          <h2 className="font-display text-xl font-bold">Correction manuelle</h2>
          <p className="text-sm text-ink-soft">
            Complétez ou corrigez les champs, puis enregistrez. Les red flags et le score seront
            recalculés.
          </p>
          <p className="mt-2 text-sm">
            {result.fetched ? (
              <span className="chip bg-moss/20 text-moss">
                ✓ Page récupérée — {result.fields_filled.length} champ(s) extrait(s)
              </span>
            ) : (
              <span className="chip bg-paper-2 text-ink-soft">
                ◌ Page non récupérée (robots.txt, hors ligne ou bloquée) — saisie manuelle
              </span>
            )}
          </p>
          {result.listing.flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.listing.flags.map((f) => (
                <FlagBadge key={f.id} flag={f} />
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {field("title_original", "Titre original (日本語)")}
            <div className="grid grid-cols-2 gap-3">
              {field("prefecture", "Préfecture")}
              {field("city", "Ville")}
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="description_original">
                Description originale (日本語)
              </label>
              <textarea
                id="description_original"
                className="field min-h-24"
                value={form.description_original ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description_original: e.target.value }))
                }
              />
            </div>
            {field("price_yen", "Prix (¥)", "number")}
            {field("build_year", "Année", "number")}
            {field("land_area_m2", "Terrain (m²)", "number")}
            {field("building_area_m2", "Bâti (m²)", "number")}
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-line pt-4 text-sm text-ink-soft">
            <span className="font-bold">Aperçu :</span>
            <span className="font-mono">{fmtYen(form.price_yen ? Number(form.price_yen) : null)}</span>
            <span>· {fmtArea(form.land_area_m2 ? Number(form.land_area_m2) : null)} terrain</span>
          </div>

          <div className="mt-4 flex gap-3">
            <button className="btn btn-primary" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Enregistrement…" : "Enregistrer & ouvrir la fiche"}
            </button>
            <button className="btn" onClick={() => navigate(`/listings/${result.listing.id}`)}>
              Ouvrir sans modifier
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
