import { useQuery } from '@tanstack/react-query';
import { Clapperboard, Star, Tv } from 'lucide-react';
import type { ProfileStatsDto } from '@serietime/types';
import { minutesToBreakdown } from '@serietime/core';
import { SkeletonBlock } from '@serietime/ui';
import { api } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';

export function StatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['profile', 'stats'],
    queryFn: () => api.get<{ stats: ProfileStatsDto }>('/api/profile/stats'),
  });
  const stats = data?.stats;
  const showTime = stats ? minutesToBreakdown(stats.showMinutes) : null;
  const movieTime = stats ? minutesToBreakdown(stats.movieMinutes) : null;

  return (
    <div className="min-h-full bg-white pb-10">
      <PageHeader title="Statistiques" />
      {isLoading && (
        <div className="p-6">
          <SkeletonBlock style={{ height: 140, marginBottom: 16 }} />
          <SkeletonBlock style={{ height: 140 }} />
        </div>
      )}
      {stats && showTime && movieTime && (
        <div className="flex flex-col gap-4 p-6">
          <Card icon={<Tv size={20} aria-hidden />} title="Temps passé devant des séries" values={[[showTime.months, 'MOIS'], [showTime.days, 'JOURS'], [showTime.hours, 'HEURES']]} />
          <Card icon={<Tv size={20} aria-hidden />} title="Épisodes vus" values={[[stats.episodesWatched, 'ÉPISODES']]} />
          <Card icon={<Clapperboard size={20} aria-hidden />} title="Temps passé devant des films" values={[[movieTime.months, 'MOIS'], [movieTime.days, 'JOURS'], [movieTime.hours, 'HEURES']]} />
          <Card icon={<Clapperboard size={20} aria-hidden />} title="Films regardés" values={[[stats.moviesWatched, 'FILMS']]} />
          <Card icon={<Star size={20} aria-hidden />} title="Notes attribuées" values={[[stats.ratingsCount, 'NOTES']]} />
        </div>
      )}
    </div>
  );
}

function Card({ icon, title, values }: { icon: React.ReactNode; title: string; values: [number, string][] }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 5 }}>
      <p className="flex items-center gap-2 px-4 py-3" style={{ fontSize: 16.5, fontWeight: 600, borderBottom: '1px solid var(--color-border-light)' }}>
        {icon} {title}
      </p>
      <div className="flex justify-around px-4 py-4">
        {values.map(([value, label]) => (
          <span key={label} className="text-center">
            <span className="block" style={{ fontSize: 27, fontWeight: 800 }}>
              {value}
            </span>
            <span className="uppercase" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
