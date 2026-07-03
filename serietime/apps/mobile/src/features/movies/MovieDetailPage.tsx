import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Clock, Eye, Heart, ListPlus, MoreHorizontal, Play, Share2 } from 'lucide-react';
import type { MediaDto } from '@serietime/types';
import { ActionSheet, CheckCircle, SkeletonBlock } from '@serietime/ui';
import { api, offlineTolerantPost, tmdbImage } from '../../lib/api.js';
import { useBackClose } from '../../hooks/useBackButton.js';

type MovieDetail = {
  media: MediaDto;
  providers: { name: string; offerType: string; url: string | null }[];
  cast: { name: string; character: string | null; profilePath: string | null }[];
  trailerUrl: string | null;
};

export function MovieDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  useBackClose(menuOpen, () => setMenuOpen(false));

  const { data, isLoading } = useQuery({
    queryKey: ['movie', id],
    queryFn: () => api.get<MovieDetail>(`/api/movies/${id}`),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['movie', id] });
    void queryClient.invalidateQueries({ queryKey: ['movies'] });
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const toggleWatched = useMutation({
    mutationFn: () =>
      offlineTolerantPost(`/api/movies/${id}/${data?.media.userStatus === 'completed' ? 'unwatched' : 'watched'}`),
    onSettled: refresh,
  });

  if (isLoading || !data) {
    return <SkeletonBlock style={{ height: 300, borderRadius: 0 }} />;
  }
  const { media } = data;
  const watched = media.userStatus === 'completed';

  return (
    <div className="min-h-full bg-white pb-10">
      <div className="relative" style={{ height: 260, background: '#111' }}>
        {tmdbImage(media.backdropPath, 'w780') && (
          <img src={tmdbImage(media.backdropPath, 'w780')!} alt="" className="h-full w-full object-cover" />
        )}
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
          <p style={{ fontSize: 15, opacity: 0.9 }}>
            {[media.year, media.runtime ? `${Math.floor(media.runtime / 60)} h ${media.runtime % 60} m` : null, media.genres]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <span className="flex items-center gap-2" style={{ fontSize: 17 }}>
          <Eye size={22} aria-hidden />
          {watched ? 'Vu' : 'Pas vu'}
        </span>
        <CheckCircle checked={watched} onClick={() => toggleWatched.mutate()} label={watched ? 'Marquer non vu' : 'Marquer vu'} />
      </div>

      <section className="py-5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <h2 className="px-6" style={{ fontSize: 24, fontWeight: 800 }}>
          Où regarder
        </h2>
        <div className="mt-3 px-6">
          {data.providers.length === 0 ? (
            <p style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Non disponible</p>
          ) : (
            data.providers.slice(0, 3).map((p) => (
              <a
                key={`${p.name}-${p.offerType}`}
                href={p.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="mb-3 flex w-fit items-center gap-3 uppercase text-white"
                style={{ background: '#00A8E1', borderRadius: 999, padding: '12px 26px', fontSize: 15, fontWeight: 800 }}
              >
                <Play size={18} fill="#FFF" aria-hidden /> {p.name}
              </a>
            ))
          )}
        </div>
      </section>

      {media.overview && (
        <section className="py-5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <h2 className="px-6" style={{ fontSize: 24, fontWeight: 800 }}>
            Synopsis
          </h2>
          <p className="mt-3 px-6" style={{ fontSize: 18, lineHeight: 1.45 }}>
            {media.overview}
          </p>
        </section>
      )}

      {data.cast.length > 0 && (
        <section className="py-5">
          <h2 className="px-6" style={{ fontSize: 24, fontWeight: 800 }}>
            Distribution
          </h2>
          <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto px-6">
            {data.cast.slice(0, 12).map((actor) => (
              <div key={actor.name} className="relative shrink-0 overflow-hidden" style={{ width: 130, height: 180, borderRadius: 5, background: '#333' }}>
                {tmdbImage(actor.profilePath, 'w185') && (
                  <img src={tmdbImage(actor.profilePath, 'w185')!} alt={actor.name} loading="lazy" className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-x-0 bottom-0 p-2 text-white" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
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

      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          {
            label: media.isFavorite ? 'Retirer des favoris' : 'Favoris',
            icon: <Heart size={22} fill={media.isFavorite ? '#C7222A' : 'none'} color={media.isFavorite ? '#C7222A' : '#000'} aria-hidden />,
            onClick: () => void api.post(`/api/movies/${id}/favorite`).then(refresh),
          },
          { label: 'Ajouter à une liste', icon: <ListPlus size={22} aria-hidden />, onClick: () => navigate(`/show/${id}/lists`) },
          {
            label: 'Regarder plus tard',
            icon: <Clock size={22} aria-hidden />,
            onClick: () => void api.post(`/api/movies/${id}/watchlist`).then(refresh),
          },
          {
            label: 'Partager',
            icon: <Share2 size={22} aria-hidden />,
            onClick: () => void navigator.share?.({ title: media.title }).catch(() => undefined),
          },
        ]}
      />
    </div>
  );
}
