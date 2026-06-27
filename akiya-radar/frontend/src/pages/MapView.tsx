import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { api } from "@/api/client";
import { ErrorState, Spinner } from "@/components/feedback";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ListingMap } from "@/components/ListingMap";
import { fmtYen, scoreColor } from "@/lib/format";
import { latestScore, type ListingSummary } from "@/lib/types";

export function MapView() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["listings", { limit: 200 }],
    queryFn: () => api.listings({ limit: 200 }),
  });
  const [selected, setSelected] = useState<ListingSummary | null>(null);

  if (isLoading) return <Spinner label="Chargement de la carte" />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />;

  const listings = data?.items ?? [];
  const located = listings.filter((l) => l.lat != null && l.lon != null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">Carte</h1>
        <p className="text-sm text-ink-soft">
          {located.length} bien(s) localisé(s) · ◌ contour pointillé = position approximative
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <ListingMap listings={located} height="72vh" onSelect={setSelected} />
        <aside className="panel h-[72vh] overflow-y-auto p-4">
          <h2 className="font-display text-lg font-bold">
            {selected ? "Bien sélectionné" : "Liste"}
          </h2>
          {selected ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-bold">
                  {selected.title_original ?? selected.title_fr}
                </h3>
                <ScoreBadge score={latestScore(selected)?.total_score} />
              </div>
              <p className="text-sm text-ink-soft">
                {[selected.city, selected.prefecture].filter(Boolean).join(" · ")}
              </p>
              <p className="font-mono font-bold">{fmtYen(selected.price_yen)}</p>
              <Link to={`/listings/${selected.id}`} className="btn btn-primary w-full">
                Voir la fiche
              </Link>
              <button className="btn w-full" onClick={() => setSelected(null)}>
                Retour à la liste
              </button>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {located.map((l) => (
                <li key={l.id}>
                  <button
                    className="flex w-full items-center justify-between gap-2 border-b border-line py-2 text-left hover:text-vermilion"
                    onClick={() => setSelected(l)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">
                        {l.title_original ?? l.title_fr}
                      </span>
                      <span className="text-xs text-ink-mute">{fmtYen(l.price_yen)}</span>
                    </span>
                    <span className={`font-mono font-bold ${scoreColor(latestScore(l)?.total_score)}`}>
                      {latestScore(l)?.total_score ?? "?"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
