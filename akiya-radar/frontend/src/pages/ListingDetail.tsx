import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "@/api/client";
import { DuplicateBanner } from "@/components/DuplicateBanner";
import { ErrorState, Spinner } from "@/components/feedback";
import { FlagBadge } from "@/components/FlagBadge";
import { ListingMap } from "@/components/ListingMap";
import { ScoreBadge } from "@/components/ScoreBadge";
import { StatusPill } from "@/components/StatusPill";
import { TranslatableText } from "@/components/TranslatableText";
import { DUE_DILIGENCE, loadChecklist, saveChecklist } from "@/lib/checklist";
import { accuracyLabel, fmtArea, fmtEur, fmtYen, severityRank } from "@/lib/format";
import { latestScore, PERSONAL_STATUSES, PERSONAL_STATUS_LABELS } from "@/lib/types";

const SCORE_PARTS: { key: string; label: string; max: number }[] = [
  { key: "price_score", label: "Prix / valeur", max: 20 },
  { key: "location_score", label: "Localisation", max: 20 },
  { key: "natural_risk_score", label: "Risques naturels", max: 20 },
  { key: "legal_risk_score", label: "Risques juridiques", max: 15 },
  { key: "renovation_score", label: "Travaux probables", max: 15 },
  { key: "personal_fit_score", label: "Fit personnel", max: 10 },
];

export function ListingDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: listing, isLoading, error, refetch } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => api.listing(id),
  });
  const { data: duplicates } = useQuery({
    queryKey: ["listing-duplicates", id],
    queryFn: () => api.duplicates(id),
    enabled: !!id,
  });

  const [noteDraft, setNoteDraft] = useState("");
  const [taskDraft, setTaskDraft] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (id) setChecked(loadChecklist(id));
  }, [id]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["listing", id] });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateListing(id, body),
    onSuccess: invalidate,
  });
  const fav = useMutation({
    mutationFn: () => api.setFavorite(id, !listing?.favorite),
    onSuccess: invalidate,
  });
  const enrich = useMutation({ mutationFn: () => api.enrich(id), onSuccess: invalidate });
  const addNote = useMutation({
    mutationFn: (note: string) => api.addNote(id, note),
    onSuccess: () => {
      setNoteDraft("");
      invalidate();
    },
  });
  const delNote = useMutation({
    mutationFn: (noteId: string) => api.deleteNote(noteId),
    onSuccess: invalidate,
  });
  const addTask = useMutation({
    mutationFn: (title: string) => api.addTask(id, title),
    onSuccess: () => {
      setTaskDraft("");
      invalidate();
    },
  });
  const toggleTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      api.updateTask(taskId, { status }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => api.deleteListing(id),
    onSuccess: () => navigate("/listings"),
  });

  if (isLoading) return <Spinner label="Chargement de la fiche" />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />;
  if (!listing) return null;

  const score = latestScore(listing);
  const flags = [...listing.flags].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );
  const accurate = listing.geocode_accuracy === "exact";
  const checkedCount = Object.values(checked).filter(Boolean).length;

  const toggleCheck = (key: string) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    saveChecklist(id, next);
  };

  return (
    <div className="space-y-6">
      <Link to="/listings" className="text-sm font-bold text-ink-soft hover:text-vermilion">
        ← Toutes les annonces
      </Link>

      {duplicates && duplicates.length > 0 && (
        <section className="panel border-vermilion p-5">
          <DuplicateBanner duplicates={duplicates} />
        </section>
      )}

      {/* Header */}
      <header className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={listing.personal_status} />
              {listing.listing_status && (
                <span className="chip border-ink/30 text-ink-mute">{listing.listing_status}</span>
              )}
            </div>
            <div className="mt-2">
              <TranslatableText
                text={listing.title_original ?? listing.title_fr ?? "Annonce"}
                as="heading"
                className="text-2xl font-extrabold leading-tight sm:text-3xl"
              />
            </div>
            <p className="mt-2 text-ink-soft">
              {[listing.address_text, listing.city, listing.prefecture]
                .filter(Boolean)
                .join(" · ") || "Localisation inconnue"}
            </p>
            <a
              href={listing.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block break-all text-sm font-bold text-vermilion hover:underline"
            >
              🔗 Source officielle
            </a>
          </div>
          <div className="flex flex-col items-center gap-3">
            <ScoreBadge score={score?.total_score} confidence={score?.confidence_score} size="lg" />
            <button className="btn" onClick={() => fav.mutate()}>
              <span className={listing.favorite ? "text-vermilion" : ""}>
                {listing.favorite ? "★ Favori" : "☆ Favori"}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <label className="flex items-center gap-2 text-sm font-bold">
            Statut
            <select
              className="field w-auto py-1"
              value={listing.personal_status}
              onChange={(e) => patch.mutate({ personal_status: e.target.value })}
            >
              {PERSONAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PERSONAL_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            Note
            <select
              className="field w-auto py-1"
              value={listing.rating ?? 0}
              onChange={(e) => patch.mutate({ rating: Number(e.target.value) })}
            >
              {[0, 1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r === 0 ? "—" : "★".repeat(r)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={() => enrich.mutate()} disabled={enrich.isPending}>
            {enrich.isPending ? "…" : "↻ Ré-enrichir"}
          </button>
          <button
            className="btn ml-auto border-vermilion text-vermilion"
            onClick={() => {
              if (confirm("Supprimer cette annonce ?")) remove.mutate();
            }}
          >
            Supprimer
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* Price + facts */}
          <section className="panel p-5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-3xl font-bold">{fmtYen(listing.price_yen)}</span>
              <span className="text-ink-mute">{fmtEur(listing.price_eur)}</span>
            </div>
            {listing.price_text_original && (
              <p className="mt-1 text-sm text-ink-mute">
                Prix source : {listing.price_text_original}
              </p>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Terrain", fmtArea(listing.land_area_m2)],
                ["Bâti", fmtArea(listing.building_area_m2)],
                ["Plan", listing.floor_plan ?? "—"],
                ["Année", listing.build_year ?? "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wider text-ink-mute">{k}</dt>
                  <dd className="font-display text-lg font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Red flags */}
          <section className="panel p-5">
            <h2 className="font-display text-xl font-bold">Red flags détectés</h2>
            {flags.length === 0 ? (
              <p className="mt-2 text-ink-soft">Aucun red flag détecté dans le texte source.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {flags.map((f) => (
                  <li key={f.id} className="border-l-4 border-ink/20 pl-3" style={{
                    borderColor:
                      f.severity === "critical"
                        ? "hsl(8 74% 48%)"
                        : f.severity === "warning"
                          ? "hsl(38 64% 46%)"
                          : "hsl(28 18% 82%)",
                  }}>
                    <div className="flex items-center gap-2">
                      <FlagBadge flag={f} full />
                    </div>
                    {f.explanation_fr && (
                      <p className="mt-1 text-sm text-ink-soft">{f.explanation_fr}</p>
                    )}
                    {f.recommended_action_fr && f.recommended_action_fr !== "—" && (
                      <p className="mt-1 text-sm">
                        <span className="font-bold">Action : </span>
                        {f.recommended_action_fr}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Texts */}
          <section className="panel p-5">
            <h2 className="font-display text-xl font-bold">Description (日本語)</h2>
            <div className="mt-2">
              <TranslatableText text={listing.description_original} className="text-ink-soft" />
            </div>
            {listing.summary_fr && (
              <>
                <h3 className="mt-5 font-bold uppercase tracking-wider text-ink-mute">Résumé</h3>
                <p className="mt-1">{listing.summary_fr}</p>
              </>
            )}
          </section>

          {/* Price history */}
          {listing.price_history.length > 0 && (
            <section className="panel p-5">
              <h2 className="font-display text-xl font-bold">Historique des prix</h2>
              <ul className="mt-3 space-y-1 font-mono text-sm">
                {listing.price_history.map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-line py-1">
                    <span>{new Date(p.detected_at).toLocaleDateString("fr-FR")}</span>
                    <span className="font-semibold">{fmtYen(p.price_yen)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Score breakdown */}
          <section className="panel p-5">
            <h2 className="font-display text-xl font-bold">Score détaillé</h2>
            {score ? (
              <>
                <div className="mt-3 space-y-2">
                  {SCORE_PARTS.map((p) => {
                    const val = (score[p.key as keyof typeof score] as number) ?? 0;
                    return (
                      <div key={p.key}>
                        <div className="flex justify-between text-sm">
                          <span>{p.label}</span>
                          <span className="font-mono font-bold">
                            {val}/{p.max}
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-2">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-vermilion to-gold transition-[width] duration-500 ease-out-expo"
                            style={{ width: `${(val / p.max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {score.explanation_fr && (
                  <pre className="mt-4 whitespace-pre-wrap border-t border-line pt-3 font-sans text-sm text-ink-soft">
                    {score.explanation_fr}
                  </pre>
                )}
              </>
            ) : (
              <p className="mt-2 text-ink-soft">Pas encore de score.</p>
            )}
          </section>

          {/* Location / map */}
          <section className="panel p-5">
            <h2 className="font-display text-xl font-bold">Localisation</h2>
            <p
              className={`mt-1 text-sm font-bold ${accurate ? "text-moss" : "text-vermilion"}`}
            >
              {accurate ? "● " : "◌ "}
              {accuracyLabel[listing.geocode_accuracy ?? ""] ?? "Localisation inconnue"}
            </p>
            {listing.lat != null && listing.lon != null ? (
              <div className="mt-3">
                <ListingMap listings={[listing]} height="240px" zoom={accurate ? 13 : 9} />
              </div>
            ) : (
              <p className="mt-2 text-ink-soft">Coordonnées non disponibles.</p>
            )}
          </section>

          {/* Notes */}
          <section className="panel p-5">
            <h2 className="font-display text-xl font-bold">Notes</h2>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (noteDraft.trim()) addNote.mutate(noteDraft.trim());
              }}
            >
              <input
                className="field"
                placeholder="Ajouter une note…"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">
                +
              </button>
            </form>
            <ul className="mt-3 space-y-2">
              {listing.notes.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-2 border-b border-line pb-2 text-sm">
                  <span>{n.note}</span>
                  <button
                    className="text-ink-mute hover:text-vermilion"
                    aria-label="Supprimer la note"
                    onClick={() => delNote.mutate(n.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Tasks */}
          <section className="panel p-5">
            <h2 className="font-display text-xl font-bold">Tâches</h2>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (taskDraft.trim()) addTask.mutate(taskDraft.trim());
              }}
            >
              <input
                className="field"
                placeholder="Nouvelle tâche…"
                value={taskDraft}
                onChange={(e) => setTaskDraft(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">
                +
              </button>
            </form>
            <ul className="mt-3 space-y-2">
              {listing.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={t.status === "done"}
                    onChange={() =>
                      toggleTask.mutate({
                        taskId: t.id,
                        status: t.status === "done" ? "todo" : "done",
                      })
                    }
                  />
                  <span className={t.status === "done" ? "text-ink-mute line-through" : ""}>
                    {t.title}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Due diligence */}
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Due diligence</h2>
              <span className="font-mono text-sm text-ink-mute">
                {checkedCount}/{DUE_DILIGENCE.length}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {DUE_DILIGENCE.map((item) => (
                <li key={item.id}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-vermilion"
                      checked={!!checked[item.id]}
                      onChange={() => toggleCheck(item.id)}
                    />
                    <span className={checked[item.id] ? "text-ink-mute line-through" : ""}>
                      {item.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
