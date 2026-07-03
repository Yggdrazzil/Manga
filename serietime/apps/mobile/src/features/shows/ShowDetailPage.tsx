import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  Clock,
  Heart,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Play,
  Settings,
  Share2,
  SquareMinus,
} from 'lucide-react';
import type { EpisodeDto, MediaDto } from '@serietime/types';
import { formatEpisodeCode } from '@serietime/core';
import { ActionSheet, BottomSheet, CheckCircle, EmptyState, SkeletonBlock, TopTabs } from '@serietime/ui';
import { api, offlineTolerantPost, tmdbImage } from '../../lib/api.js';
import { useAppStore } from '../../lib/store.js';
import { useBackClose } from '../../hooks/useBackButton.js';

type ShowDetail = {
  media: MediaDto;
  show: {
    numberOfSeasons: number | null;
    network: string | null;
    platform: string | null;
    airTime: string | null;
    airDay: string | null;
  } | null;
  providers: { name: string; offerType: string; url: string | null }[];
  cast: { name: string; character: string | null; profilePath: string | null }[];
  trailerUrl: string | null;
  recommendations: MediaDto[];
};

type SeasonData = {
  id: string;
  seasonNumber: number;
  title: string;
  watchedCount: number;
  totalCount: number;
  episodes: EpisodeDto[];
};

const STATUS_LABELS: Record<string, string> = {
  watching: 'En cours',
  completed: 'Terminé',
  watchlist: 'Regarder plus tard',
  paused: 'En pause',
  abandoned: 'Abandonné',
  not_started: 'Pas commencé',
};

const INTEREST_OPTIONS = [
  'LES ACTEURS',
  'LA PRÉMISSE',
  'LES CRÉATEURS',
  'LA CHAÎNE/LA PLATEFORME',
  "LA FRANCHISE OU L'UNIVERS",
  'AUTRE',
];

export function ShowDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('À PROPOS');
  const [menuOpen, setMenuOpen] = useState(false);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useBackClose(menuOpen, () => setMenuOpen(false));
  useBackClose(personalizeOpen, () => setPersonalizeOpen(false));

  const { data, isLoading } = useQuery({
    queryKey: ['show', id],
    queryFn: () => api.get<ShowDetail>(`/api/shows/${id}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['show', id] });
    void queryClient.invalidateQueries({ queryKey: ['shows'] });
  };

  const deleteTracking = useMutation({
    mutationFn: () => api.delete(`/api/shows/${id}/tracking`),
    onSuccess: () => {
      invalidate();
      navigate(-1);
    },
  });

  if (isLoading || !data) {
    return (
      <div>
        <SkeletonBlock style={{ height: 260, borderRadius: 0 }} />
        <div className="p-4">
          <SkeletonBlock style={{ height: 58 }} />
        </div>
      </div>
    );
  }

  const { media, show } = data;
  const backdrop = tmdbImage(media.backdropPath, 'w780');
  const subtitle = [
    show?.numberOfSeasons ? `${show.numberOfSeasons} saison${show.numberOfSeasons > 1 ? 's' : ''}` : null,
    show?.platform ?? show?.network,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="min-h-full bg-white pb-8">
      {/* Header hero (spec §29.1) */}
      <div className="relative" style={{ height: 260, background: '#111' }}>
        {backdrop && <img src={backdrop} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.6))' }} />
        <div className="safe-top absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-2">
          <button aria-label="Retour" onClick={() => navigate(-1)} className="flex h-11 w-11 items-center justify-center">
            <ChevronDown size={30} color="#FFF" aria-hidden />
          </button>
          <button aria-label="Menu" onClick={() => setMenuOpen(true)} className="flex h-11 w-11 items-center justify-center">
            <MoreHorizontal size={28} color="#FFF" aria-hidden />
          </button>
        </div>
        <div className="absolute bottom-4 left-5 right-5 text-white">
          <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>{media.title}</h1>
          {subtitle && <p style={{ fontSize: 15, opacity: 0.9 }}>{subtitle}</p>}
        </div>
      </div>

      <TopTabs tabs={['À PROPOS', 'ÉPISODES']} active={tab} onChange={setTab} />
      {tab === 'À PROPOS' ? <AboutTab data={data} /> : <EpisodesTab showMediaId={id} onChange={invalidate} />}

      {/* Menu trois points (spec §31) */}
      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: STATUS_LABELS[media.userStatus ?? 'not_started'] ?? 'Pas commencé', highlighted: true },
          { label: 'Personnaliser', icon: <Pencil size={22} aria-hidden />, onClick: () => setPersonalizeOpen(true) },
          {
            label: media.isFavorite ? 'Retirer des favoris' : 'Favoris',
            icon: <Heart size={22} fill={media.isFavorite ? '#C7222A' : 'none'} color={media.isFavorite ? '#C7222A' : '#000'} aria-hidden />,
            onClick: () => void api.post(`/api/shows/${id}/favorite`).then(invalidate),
          },
          { label: 'Ajouter à une liste', icon: <ListPlus size={22} aria-hidden />, onClick: () => navigate(`/show/${id}/lists`) },
          {
            label: 'Regarder plus tard',
            icon: <Clock size={22} aria-hidden />,
            onClick: () => void api.post(`/api/shows/${id}/watchlater`).then(invalidate),
          },
          { label: 'Supprimer la série', icon: <SquareMinus size={22} aria-hidden />, onClick: () => setConfirmDelete(true) },
          {
            label: 'Partager',
            icon: <Share2 size={22} aria-hidden />,
            onClick: () => void navigator.share?.({ title: media.title }).catch(() => undefined),
          },
        ]}
      />

      {/* Personnaliser (spec §31.1) */}
      <BottomSheet open={personalizeOpen} onClose={() => setPersonalizeOpen(false)} ariaLabel="Personnaliser">
        <div className="p-6">
          <p style={{ fontSize: 22, fontWeight: 800 }}>Personnaliser</p>
          <button
            className="mt-5 block w-full text-left"
            style={{ fontSize: 18, padding: '12px 0' }}
            onClick={() => {
              setPersonalizeOpen(false);
              navigate(`/show/${id}/posters`);
            }}
          >
            Modifier l'affiche
          </button>
          <button
            className="block w-full text-left"
            style={{ fontSize: 18, padding: '12px 0' }}
            onClick={() => {
              setPersonalizeOpen(false);
              navigate(`/show/${id}/banners`);
            }}
          >
            Changer la bannière
          </button>
        </div>
      </BottomSheet>

      {/* Confirmation suppression (spec §32.7) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" role="alertdialog" aria-modal="true">
          <button aria-label="Annuler" className="absolute inset-0" style={{ background: 'var(--overlay-dark)' }} onClick={() => setConfirmDelete(false)} />
          <div className="relative mx-8 w-full max-w-sm bg-white p-6" style={{ borderRadius: 5 }}>
            <p style={{ fontSize: 18, fontWeight: 700 }}>Supprimer cette série de votre suivi ?</p>
            <div className="mt-6 flex justify-end gap-6">
              <button onClick={() => setConfirmDelete(false)} className="uppercase" style={{ fontSize: 14, fontWeight: 800 }}>
                Annuler
              </button>
              <button
                onClick={() => deleteTracking.mutate()}
                className="uppercase"
                style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-red-dot)' }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-6" style={{ fontSize: 24, fontWeight: 800 }}>
      {children}
    </h2>
  );
}

function AboutTab({ data }: { data: ShowDetail }) {
  const { media, show, providers, cast, trailerUrl, recommendations } = data;
  const { interestAnswers, setInterestAnswer } = useAppStore();
  const answer = interestAnswers[media.id];
  const navigate = useNavigate();

  return (
    <div className="pb-10">
      {/* Où regarder (spec §29.3) */}
      <section className="py-5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <div className="flex items-center justify-between px-6">
          <SectionTitle>Où regarder</SectionTitle>
          <Settings size={22} aria-hidden color="#000" />
        </div>
        <div className="mt-4 px-6">
          {providers.length === 0 ? (
            <p style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Non disponible</p>
          ) : (
            providers
              .filter((p) => p.offerType === 'flatrate')
              .concat(providers.filter((p) => p.offerType !== 'flatrate'))
              .slice(0, 3)
              .map((p) => (
                <a
                  key={`${p.name}-${p.offerType}`}
                  href={p.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-3 flex w-fit items-center gap-3 uppercase text-white"
                  style={{
                    background: '#00A8E1',
                    borderRadius: 999,
                    padding: '12px 26px',
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: '0.03em',
                  }}
                >
                  <Play size={18} fill="#FFF" aria-hidden /> {p.name}
                </a>
              ))
          )}
        </div>
      </section>

      {/* Questionnaire local (spec §29.3) */}
      <section className="py-6" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <p className="px-6 text-center uppercase" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>
          Qu'est-ce qui vous intéresse le plus dans cette série ?
        </p>
        <div className="mt-4 flex flex-col gap-3 px-6">
          {INTEREST_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setInterestAnswer(media.id, option)}
              aria-pressed={answer === option}
              className="w-full uppercase"
              style={{
                background: answer === option ? 'var(--color-primary-yellow)' : 'var(--color-chip-grey)',
                borderRadius: 6,
                padding: '16px 0',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.03em',
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      {/* Informations */}
      <section className="py-6" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <SectionTitle>Informations sur la série</SectionTitle>
        <p className="mt-2 px-6" style={{ fontSize: 15, color: 'var(--color-text-muted)' }}>
          {[media.status, media.genres].filter(Boolean).join(' · ')}
        </p>
        {media.overview && (
          <p className="mt-4 px-6" style={{ fontSize: 18, lineHeight: 1.45 }}>
            {media.overview}
          </p>
        )}
      </section>

      {/* Bande-annonce */}
      {trailerUrl && (
        <section className="py-6" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <SectionTitle>Regarder la bande annonce</SectionTitle>
          <a href={trailerUrl} target="_blank" rel="noreferrer" className="mt-4 block px-6">
            <span className="relative block overflow-hidden" style={{ borderRadius: 5, aspectRatio: '16/9', background: '#111' }}>
              {tmdbImage(media.backdropPath, 'w780') && (
                <img src={tmdbImage(media.backdropPath, 'w780')!} alt="" className="h-full w-full object-cover opacity-80" />
              )}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: '50%', border: '3px solid #FFF' }}>
                  <Play size={28} fill="#FFF" color="#FFF" aria-hidden />
                </span>
              </span>
            </span>
          </a>
        </section>
      )}

      {/* Diffusion */}
      {(show?.airDay || show?.airTime || media.runtime) && (
        <section className="py-6" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <SectionTitle>Diffusion</SectionTitle>
          <p className="mt-3 px-6" style={{ fontSize: 20, fontWeight: 700 }}>
            {[show?.airDay, show?.airTime].filter(Boolean).join(' | ')}
          </p>
          {media.runtime && (
            <p className="px-6" style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>
              {media.runtime} min
            </p>
          )}
        </section>
      )}

      {/* Distribution */}
      {cast.length > 0 && (
        <section className="py-6" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <SectionTitle>Distribution</SectionTitle>
          <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto px-6">
            {cast.slice(0, 12).map((actor) => (
              <div
                key={actor.name}
                className="relative shrink-0 overflow-hidden"
                style={{ width: 130, height: 180, borderRadius: 5, background: '#333' }}
              >
                {tmdbImage(actor.profilePath, 'w185') && (
                  <img src={tmdbImage(actor.profilePath, 'w185')!} alt={actor.name} loading="lazy" className="h-full w-full object-cover" />
                )}
                <div
                  className="absolute inset-x-0 bottom-0 p-2 text-white"
                  style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}
                >
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{actor.name}</p>
                  {actor.character && (
                    <p className="uppercase" style={{ fontSize: 10.5, opacity: 0.85 }}>
                      {actor.character}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommandations : « Vous pourriez aussi aimer » (spec §29.3) */}
      {recommendations.length > 0 && (
        <section className="py-6" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <SectionTitle>Vous pourriez aussi aimer</SectionTitle>
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-6">
            {recommendations.map((rec) => (
              <button
                key={rec.tmdbId}
                onClick={() =>
                  void api
                    .post<{ mediaId: string }>('/api/shows/add-from-tmdb', { tmdbId: rec.tmdbId })
                    .then((r) => navigate(`/show/${r.mediaId}`))
                }
                className="shrink-0 overflow-hidden"
                style={{ width: 110, aspectRatio: '2/3', borderRadius: 3, background: '#E5E5E5' }}
                aria-label={rec.title}
              >
                {tmdbImage(rec.posterPath, 'w185') && (
                  <img src={tmdbImage(rec.posterPath, 'w185')!} alt={rec.title} loading="lazy" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Notes locales (spec §29.3) */}
      <section className="py-6">
        <SectionTitle>Mes notes</SectionTitle>
        <MyRating media={media} />
      </section>
    </div>
  );
}

function MyRating({ media }: { media: MediaDto }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(media.rating ?? 0);
  return (
    <div className="mt-3 flex items-center gap-2 px-6">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          aria-label={`${star} étoiles`}
          onClick={() => {
            setValue(star * 2);
            void api
              .post(`/api/shows/${media.id}/status`, { status: media.userStatus ?? 'not_started' })
              .catch(() => undefined);
            void queryClient.invalidateQueries({ queryKey: ['show', media.id] });
          }}
          style={{ fontSize: 30, color: value >= star * 2 ? 'var(--color-primary-yellow)' : 'var(--color-border)' }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function EpisodesTab({ showMediaId, onChange }: { showMediaId: string; onChange: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(new Set());
  const { data, isLoading } = useQuery({
    queryKey: ['show', showMediaId, 'episodes'],
    queryFn: () => api.get<{ seasons: SeasonData[]; nextEpisode: EpisodeDto | null }>(`/api/shows/${showMediaId}/episodes`),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['show', showMediaId] });
    onChange();
  };

  const toggleEpisode = (ep: EpisodeDto) => {
    void offlineTolerantPost(`/api/episodes/${ep.id}/${ep.watched ? 'unwatched' : 'watched'}`).then(refresh);
  };

  if (isLoading || !data) {
    return (
      <div className="p-4">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} style={{ height: 76, marginBottom: 12 }} />
        ))}
      </div>
    );
  }
  if (data.seasons.length === 0) {
    return <EmptyState title="Aucun épisode" message="Les épisodes apparaîtront après synchronisation des métadonnées." />;
  }

  return (
    <div className="pb-10" style={{ background: 'var(--color-page-muted)' }}>
      {/* Démarrer le suivi (spec §29.4) */}
      {data.nextEpisode && (
        <section className="pt-5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <h2 className="px-6" style={{ fontSize: 24, fontWeight: 800 }}>
            Démarrer le suivi
          </h2>
          <div className="px-3 py-4">
            <div className="flex overflow-hidden bg-white shadow-episode-card" style={{ borderRadius: 5, minHeight: 100 }}>
              <div className="shrink-0" style={{ width: 96, background: '#E5E5E5' }}>
                {tmdbImage(data.nextEpisode.stillPath) && (
                  <img src={tmdbImage(data.nextEpisode.stillPath)!} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                <p style={{ fontSize: 22, fontWeight: 800 }}>
                  {formatEpisodeCode(data.nextEpisode.seasonNumber, data.nextEpisode.episodeNumber)}
                  {data.nextEpisode.absoluteNumber ? ` (E${String(data.nextEpisode.absoluteNumber).padStart(2, '0')})` : ''}
                </p>
                <p className="truncate" style={{ fontSize: 16 }}>
                  {data.nextEpisode.title}
                </p>
              </div>
              <div className="flex items-center pr-4">
                <CheckCircle onClick={() => toggleEpisode(data.nextEpisode!)} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tous les épisodes (spec §29.4) */}
      <section className="pt-5">
        <div className="flex items-center justify-between px-6">
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>Tous les épisodes</h2>
          <button
            aria-label="Tout marquer vu"
            onClick={() => void api.post(`/api/shows/${showMediaId}/mark-all-watched`, {}).then(refresh)}
            className="flex items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #000' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 12.5l5.5 5.5L20 7" stroke="#000" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 px-3">
          {data.seasons.map((season) => {
            const open = openSeasons.has(season.seasonNumber);
            return (
              <div key={season.id} className="mb-3">
                <div
                  className="flex items-center justify-between bg-white px-5 shadow-season-card"
                  style={{
                    height: 76,
                    borderRadius: 5,
                    borderBottom: open ? '3px solid var(--color-primary-yellow)' : 'none',
                  }}
                >
                  <button
                    className="flex flex-1 items-center gap-2"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenSeasons((prev) => {
                        const next = new Set(prev);
                        if (next.has(season.seasonNumber)) next.delete(season.seasonNumber);
                        else next.add(season.seasonNumber);
                        return next;
                      })
                    }
                  >
                    <span style={{ fontSize: 24, fontWeight: 800 }}>{season.title}</span>
                    <ChevronDown
                      size={22}
                      aria-hidden
                      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                    />
                  </button>
                  <span className="mr-4" style={{ fontSize: 17 }}>
                    {season.watchedCount}/{season.totalCount}
                  </span>
                  <CheckCircle
                    size={44}
                    checked={season.totalCount > 0 && season.watchedCount === season.totalCount}
                    onClick={() =>
                      void api
                        .post(`/api/shows/${showMediaId}/mark-all-watched`, { seasonNumber: season.seasonNumber })
                        .then(refresh)
                    }
                    label={`Marquer la saison ${season.seasonNumber} vue`}
                  />
                </div>
                {open && (
                  <div className="mt-2">
                    {season.episodes.map((ep) => (
                      <div
                        key={ep.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/episode/${ep.id}`)}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/episode/${ep.id}`)}
                        className="mb-2 flex cursor-pointer overflow-hidden bg-white shadow-episode-card"
                        style={{ borderRadius: 5, minHeight: 96 }}
                      >
                        <div className="shrink-0" style={{ width: 96, background: '#E5E5E5' }}>
                          {tmdbImage(ep.stillPath) && (
                            <img src={tmdbImage(ep.stillPath)!} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-2">
                          <p style={{ fontSize: 20, fontWeight: 800 }}>
                            {formatEpisodeCode(ep.seasonNumber, ep.episodeNumber)}
                            {ep.absoluteNumber ? ` (E${String(ep.absoluteNumber).padStart(2, '0')})` : ''}
                          </p>
                          <p className="line-clamp-2" style={{ fontSize: 15.5 }}>
                            {ep.title}
                          </p>
                        </div>
                        <div className="flex items-center pr-4">
                          <CheckCircle
                            size={44}
                            checked={ep.watched}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEpisode(ep);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
