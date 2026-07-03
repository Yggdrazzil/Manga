import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronRight, Clapperboard, Heart, MoreHorizontal, Tv } from 'lucide-react';
import type { MediaDto, ProfileStatsDto } from '@serietime/types';
import { minutesToBreakdown } from '@serietime/core';
import { ActionSheet, SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { useBackClose } from '../../hooks/useBackButton.js';
import { useToast } from '../../hooks/useToast.js';

type ProfileResponse = {
  user: { displayName: string; avatarUrl: string | null; coverUrl: string | null };
  stats: ProfileStatsDto;
  lists: { id: string; title: string; posterPaths: string[] }[];
  shows: MediaDto[];
  favoriteShows: MediaDto[];
  movies: MediaDto[];
  favoriteMovies: MediaDto[];
};

export function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [listIndex, setListIndex] = useState(0);
  useBackClose(menuOpen, () => setMenuOpen(false));

  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<ProfileResponse>('/api/profile'),
  });

  if (isLoading || !data) {
    return (
      <div className="page-with-bottom-nav">
        <SkeletonBlock style={{ height: 220, borderRadius: 0 }} />
        <div className="p-6">
          <SkeletonBlock style={{ height: 140 }} />
        </div>
      </div>
    );
  }

  const { user, stats } = data;
  const showTime = minutesToBreakdown(stats.showMinutes);
  const movieTime = minutesToBreakdown(stats.movieMinutes);

  return (
    <div className="page-with-bottom-nav min-h-full bg-white">
      {/* Header profil (spec §21.1) */}
      <div className="relative" style={{ height: 220, background: '#222' }}>
        {user.coverUrl && <img src={user.coverUrl} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.55))' }} />
        <div className="safe-top absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3">
          <button
            aria-label="Notifications"
            onClick={() => navigate('/settings/notifications')}
            className="flex items-center justify-center"
            style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--color-primary-yellow)' }}
          >
            <Bell size={24} color="#000" aria-hidden />
          </button>
          <button aria-label="Menu" onClick={() => setMenuOpen(true)} className="flex h-11 w-11 items-center justify-center">
            <MoreHorizontal size={28} color="#FFF" aria-hidden />
          </button>
        </div>
        <div className="absolute bottom-5 left-5 flex items-center gap-4">
          <span className="block overflow-hidden" style={{ width: 84, height: 84, borderRadius: '50%', border: '2px solid #FFF', background: '#555' }}>
            {user.avatarUrl && <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />}
          </span>
          <span>
            <span className="block text-white" style={{ fontSize: 29, fontWeight: 800 }}>
              {user.displayName}
            </span>
            <button
              onClick={() => navigate('/profile/edit')}
              className="mt-1 uppercase text-white"
              style={{ border: '2px solid #FFF', borderRadius: 999, padding: '5px 18px', fontSize: 13, fontWeight: 800, letterSpacing: '0.04em' }}
            >
              Modifier
            </button>
          </span>
        </div>
      </div>

      {/* Compteurs locaux (spec §21.2) */}
      <div className="flex" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        {[
          { value: stats.showsCount, label: 'Séries', to: '/profile/shows' },
          { value: stats.moviesCount, label: 'Films', to: '/profile/movies' },
          { value: stats.ratingsCount, label: stats.ratingsCount > 1 ? 'Notes' : 'Note', to: '/profile/stats' },
        ].map((c, i) => (
          <button
            key={c.label}
            onClick={() => navigate(c.to)}
            className="flex-1 py-5 text-center"
            style={{ borderLeft: i > 0 ? '1px solid var(--color-border-light)' : 'none' }}
          >
            <span className="block" style={{ fontSize: 26, fontWeight: 800 }}>
              {c.value}
            </span>
            <span style={{ fontSize: 16 }}>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Statistiques (spec §21.4) */}
      <Section title="Statistiques" onClick={() => navigate('/profile/stats')}>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-6">
          <StatsCard icon={<Tv size={20} aria-hidden />} title="Temps passé devant des séries" values={[[showTime.months, 'MOIS'], [showTime.days, 'JOURS'], [showTime.hours, 'HEURES']]} />
          <StatsCard icon={<Tv size={20} aria-hidden />} title="Épisodes vus" values={[[stats.episodesWatched, 'ÉPISODES']]} />
          <StatsCard icon={<Clapperboard size={20} aria-hidden />} title="Temps passé devant des films" values={[[movieTime.months, 'MOIS'], [movieTime.days, 'JOURS'], [movieTime.hours, 'HEURES']]} />
          <StatsCard icon={<Clapperboard size={20} aria-hidden />} title="Films regardés" values={[[stats.moviesWatched, 'FILMS']]} />
        </div>
      </Section>

      {/* Listes (spec §21.5) */}
      {data.lists.length > 0 && (
        <Section title="Listes" onClick={() => navigate('/lists')}>
          <div
            className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-6"
            onScroll={(e) => {
              const el = e.currentTarget;
              setListIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth - 48)));
            }}
          >
            {data.lists.map((list) => (
              <button
                key={list.id}
                onClick={() => navigate(`/lists/${list.id}`)}
                className="relative shrink-0 snap-center overflow-hidden text-left"
                style={{ width: 'calc(100% - 48px)', height: 155, borderRadius: 5, background: '#333' }}
              >
                <span className="absolute inset-0 flex">
                  {list.posterPaths.slice(0, 4).map((p) => (
                    <img key={p} src={tmdbImage(p, 'w185') ?? ''} alt="" className="h-full w-1/4 object-cover" />
                  ))}
                </span>
                <span className="absolute inset-0" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }} />
                <span className="absolute bottom-3 left-4 text-white" style={{ fontSize: 22, fontWeight: 800 }}>
                  {list.title}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex justify-center gap-2">
            {data.lists.map((l, i) => (
              <span
                key={l.id}
                aria-hidden
                style={{ width: 8, height: 8, borderRadius: '50%', background: i === listIndex ? 'var(--color-primary-yellow)' : 'var(--color-border)' }}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Rows posters (spec §21.6) */}
      <PosterRowSection title="Séries" items={data.shows} onTitleClick={() => navigate('/profile/shows')} />
      <PosterRowSection title="Séries préférées" heart items={data.favoriteShows} onTitleClick={() => navigate('/profile/favorites/shows')} />
      <PosterRowSection title="Films" items={data.movies} onTitleClick={() => navigate('/profile/movies')} />
      <PosterRowSection title="Films préférés" heart items={data.favoriteMovies} onTitleClick={() => navigate('/profile/favorites/movies')} />

      {/* Menu trois points (spec §25) */}
      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: 'Paramètres', onClick: () => navigate('/settings') },
          { label: 'Partager', onClick: () => toast('Partage social désactivé') },
          { label: "Centre d'aide", onClick: () => toast('SerieTime est une application personnelle auto-hébergée') },
        ]}
      />
    </div>
  );
}

function Section({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <section className="py-5">
      <button onClick={onClick} className="mb-4 flex w-full items-center justify-between px-6">
        <span style={{ fontSize: 26, fontWeight: 800 }}>{title}</span>
        <ChevronRight size={26} aria-hidden />
      </button>
      {children}
    </section>
  );
}

function StatsCard({ icon, title, values }: { icon: React.ReactNode; title: string; values: [number, string][] }) {
  return (
    <div className="shrink-0" style={{ width: 300, border: '1px solid var(--color-border)', borderRadius: 5 }}>
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

function PosterRowSection({
  title,
  items,
  onTitleClick,
  heart = false,
}: {
  title: string;
  items: MediaDto[];
  onTitleClick: () => void;
  heart?: boolean;
}) {
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <section className="py-4">
      <button onClick={onTitleClick} className="mb-3 flex w-full items-center justify-between px-6">
        <span className="flex items-center gap-2" style={{ fontSize: 26, fontWeight: 800 }}>
          {title}
          {heart && <Heart size={22} fill="#C7222A" color="#C7222A" aria-hidden />}
        </span>
        <ChevronRight size={26} aria-hidden />
      </button>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-6">
        {items.map((media) => (
          <button
            key={media.id}
            onClick={() => navigate(`/${media.type === 'show' ? 'show' : 'movie'}/${media.id}`)}
            aria-label={media.title}
            className="shrink-0 overflow-hidden"
            style={{ width: 118, aspectRatio: '2/3', borderRadius: 3, background: '#E5E5E5' }}
          >
            {tmdbImage(media.posterPath, 'w185') && (
              <img src={tmdbImage(media.posterPath, 'w185')!} alt="" loading="lazy" className="h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
