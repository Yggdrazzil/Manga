import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/api/client";
import { ErrorState, Spinner } from "@/components/feedback";
import { ListingCard } from "@/components/ListingCard";

const STAT_DEFS: { key: keyof StatMap; label: string; jp: string; accent: string }[] = [
  { key: "total", label: "Biens suivis", jp: "総数", accent: "text-ink" },
  { key: "new", label: "Nouveaux", jp: "新着", accent: "text-indigo" },
  { key: "favorites", label: "Favoris", jp: "★", accent: "text-vermilion" },
  { key: "very_interesting", label: "Très intéressants", jp: "注目", accent: "text-moss" },
  { key: "critical_flags", label: "Red flags critiques", jp: "危険", accent: "text-vermilion" },
  { key: "open_tasks", label: "Tâches ouvertes", jp: "課題", accent: "text-gold" },
];

type StatMap = {
  total: number;
  new: number;
  favorites: number;
  very_interesting: number;
  critical_flags: number;
  open_tasks: number;
};

export function Dashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
  });

  if (isLoading) return <Spinner label="Chargement du cockpit" />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-extrabold">Tableau de bord</h1>
        <p className="text-ink-soft">Vue d'ensemble de votre recherche d'akiya.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STAT_DEFS.map((s, i) => (
            <div
              key={s.key}
              className="panel animate-reveal-up p-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-mute">
                  {s.label}
                </span>
                <span className="font-display text-sm text-ink/30" aria-hidden>
                  {s.jp}
                </span>
              </div>
              <p className={`mt-1 font-display text-4xl font-extrabold ${s.accent}`}>
                {data.stats[s.key]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Top opportunités</h2>
          <Link to="/listings?sort=score" className="text-sm font-bold text-vermilion hover:underline">
            Tout voir →
          </Link>
        </div>
        {data.top_opportunities.length === 0 ? (
          <p className="text-ink-soft">Aucun bien scoré pour l'instant.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.top_opportunities.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl font-bold">Derniers ajoutés</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.recent_listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>
    </div>
  );
}
