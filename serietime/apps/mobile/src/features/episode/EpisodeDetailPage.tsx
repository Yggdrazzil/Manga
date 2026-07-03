import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, ChevronDown, Eye, Share } from 'lucide-react';
import type { EpisodeDto } from '@serietime/types';
import { formatEpisodeCode, formatShortDateFr } from '@serietime/core';
import { CheckCircle, ShowPill, SkeletonBlock } from '@serietime/ui';
import { api, offlineTolerantPost, tmdbImage } from '../../lib/api.js';

// Fiche épisode : modal plein écran sur fond gris (spec §30).
export function EpisodeDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dateOpen, setDateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['episode', id],
    queryFn: () => api.get<{ episode: EpisodeDto; backdropPath: string | null }>(`/api/episodes/${id}`),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['episode', id] });
    void queryClient.invalidateQueries({ queryKey: ['shows'] });
    void queryClient.invalidateQueries({ queryKey: ['show'] });
  };

  const toggleWatched = useMutation({
    mutationFn: () =>
      offlineTolerantPost(`/api/episodes/${id}/${data?.episode.watched ? 'unwatched' : 'watched'}`),
    onSettled: refresh,
  });

  const setDate = useMutation({
    mutationFn: (watchedAt: string) => api.post(`/api/episodes/${id}/date`, { watchedAt }),
    onSettled: refresh,
  });

  const ep = data?.episode;
  const image = tmdbImage(data?.backdropPath, 'w780');

  return (
    <div className="min-h-full" style={{ background: 'var(--color-page-muted)' }}>
      <div className="safe-top sticky top-0 z-20 bg-white">
        <div className="relative flex items-center justify-center" style={{ height: 60 }}>
          <button aria-label="Fermer" onClick={() => navigate(-1)} className="absolute left-2 flex h-11 w-11 items-center justify-center">
            <ChevronDown size={30} strokeWidth={2.4} aria-hidden />
          </button>
          <span aria-hidden style={{ width: 90, height: 8, borderRadius: 999, background: '#DDD' }} />
        </div>
      </div>

      <div className="p-5">
        {isLoading || !ep ? (
          <SkeletonBlock style={{ height: 420 }} />
        ) : (
          <div className="overflow-hidden bg-white shadow-episode-card" style={{ borderRadius: 5 }}>
            <div className="relative" style={{ aspectRatio: '16/10', background: '#111' }}>
              {image && <img src={image} alt="" className="h-full w-full object-cover" />}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.65))' }} />
              <div className="absolute left-4 top-4 right-4 flex items-start justify-between">
                <span className="[&>button]:!border-white [&>button]:!bg-transparent [&>button]:!text-white [&_svg_path]:!stroke-white">
                  <ShowPill label={ep.showTitle} onClick={() => navigate(`/show/${ep.showMediaId}`)} />
                </span>
                <button
                  aria-label="Partager"
                  onClick={() => void navigator.share?.({ title: `${ep.showTitle} ${formatEpisodeCode(ep.seasonNumber, ep.episodeNumber)}` }).catch(() => undefined)}
                >
                  <Share size={24} color="#FFF" aria-hidden />
                </button>
              </div>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p style={{ fontSize: 27, fontWeight: 800 }}>
                  {formatEpisodeCode(ep.seasonNumber, ep.episodeNumber)}
                  {ep.absoluteNumber ? ` (E${String(ep.absoluteNumber).padStart(2, '0')})` : ''}
                </p>
                <p className="truncate" style={{ fontSize: 17 }}>
                  {ep.title}
                </p>
              </div>
            </div>

            {/* Bande basse : date, statut vu, check (spec §30) */}
            <div className="flex items-center gap-6 px-5 py-4">
              <button className="flex items-center gap-2" onClick={() => setDateOpen(true)} aria-label="Modifier la date de visionnage">
                <Calendar size={22} aria-hidden />
                <span style={{ fontSize: 17 }}>
                  {ep.watchedAt ? formatShortDateFr(ep.watchedAt) : ep.airDate ? formatShortDateFr(ep.airDate) : '—'}
                </span>
              </button>
              <span className="flex items-center gap-2" style={{ fontSize: 17 }}>
                <Eye size={22} aria-hidden />
                {ep.watched ? 'Vu' : 'Pas vu'}
              </span>
              <span className="ml-auto">
                <CheckCircle checked={ep.watched} onClick={() => toggleWatched.mutate()} />
              </span>
            </div>
          </div>
        )}

        {ep?.overview && (
          <p className="mt-5 px-1" style={{ fontSize: 16.5, lineHeight: 1.5 }}>
            {ep.overview}
          </p>
        )}
      </div>

      {dateOpen && ep && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Date de visionnage">
          <button aria-label="Fermer" className="absolute inset-0" style={{ background: 'var(--overlay-dark)' }} onClick={() => setDateOpen(false)} />
          <div className="relative mx-8 w-full max-w-sm bg-white p-6" style={{ borderRadius: 5 }}>
            <p style={{ fontSize: 18, fontWeight: 700 }}>Date de visionnage</p>
            <input
              type="date"
              defaultValue={(ep.watchedAt ?? new Date().toISOString()).slice(0, 10)}
              onChange={(e) => {
                if (e.target.value) {
                  setDate.mutate(new Date(`${e.target.value}T20:00:00`).toISOString());
                  setDateOpen(false);
                }
              }}
              className="mt-4 w-full py-2"
              style={{ borderBottom: '1px solid var(--color-border)', fontSize: 18 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
