import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { QueueItemDto, UpcomingItemDto } from '@serietime/types';
import { formatEpisodeCode, formatTimeHHMM } from '@serietime/core';
import { GridToggleButton, PillHeader, PosterGrid, PosterTile, EmptyState, SkeletonBlock, ShowPill, CheckCircle, Badge } from '@serietime/ui';
import { api, offlineTolerantPost, tmdbImage } from '../../lib/api.js';
import { useAppStore } from '../../lib/store.js';
import { TopTabs } from '@serietime/ui';
import { EpisodeQueueCard } from './EpisodeQueueCard.js';

const GROUP_LABELS: Record<QueueItemDto['group'], string> = {
  a_voir: 'À VOIR',
  pas_regarde_depuis_un_moment: 'PAS REGARDÉ DEPUIS UN MOMENT',
  pas_commence: 'PAS COMMENCÉ',
  abandonne: 'ABANDONNÉ',
};

export function ShowsPage() {
  const [tab, setTab] = useState('À VOIR');
  return (
    <div className="page-with-bottom-nav min-h-full" style={{ background: 'var(--color-page-muted)' }}>
      <div className="safe-top bg-white">
        <TopTabs tabs={['À VOIR', 'À VENIR']} active={tab} onChange={setTab} />
      </div>
      {tab === 'À VOIR' ? <QueueView /> : <UpcomingView />}
    </div>
  );
}

function QueueView() {
  const { showsGridMode, toggleShowsGrid } = useAppStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['shows', 'queue'],
    queryFn: () => api.get<{ items: QueueItemDto[] }>('/api/shows/queue'),
  });

  const markWatched = useMutation({
    mutationFn: (episodeId: string) => offlineTolerantPost(`/api/episodes/${episodeId}/watched`),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['shows'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const groups = useMemo(() => {
    const map = new Map<QueueItemDto['group'], QueueItemDto[]>();
    for (const item of data?.items ?? []) map.set(item.group, [...(map.get(item.group) ?? []), item]);
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="px-3 pt-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} style={{ height: 122, marginBottom: 12 }} />
        ))}
      </div>
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="Rien à voir pour le moment"
        message="Ajoutez des séries depuis Explorer ou importez vos données TV Time dans les paramètres."
      />
    );
  }

  return (
    <div className="pb-4">
      {[...groups.entries()].map(([group, items], groupIndex) => (
        <section key={group}>
          <div className="relative flex items-center justify-center">
            <PillHeader label={GROUP_LABELS[group]} />
            {groupIndex === 0 && (
              <div className="absolute right-3">
                <GridToggleButton active={showsGridMode} onToggle={toggleShowsGrid} />
              </div>
            )}
          </div>
          {showsGridMode ? (
            <div className="px-1">
              <PosterGrid>
                {items.map((item) => (
                  <PosterTile
                    key={item.media.id}
                    posterUrl={tmdbImage(item.media.posterPath)}
                    title={item.media.title}
                    onClick={() => navigate(`/show/${item.media.id}`)}
                  />
                ))}
              </PosterGrid>
            </div>
          ) : (
            items.map((item) => (
              <EpisodeQueueCard
                key={item.media.id}
                item={item}
                onCheck={() => item.nextEpisode && markWatched.mutate(item.nextEpisode.id)}
              />
            ))
          )}
        </section>
      ))}
    </div>
  );
}

function UpcomingView() {
  const { data, isLoading } = useQuery({
    queryKey: ['shows', 'upcoming'],
    queryFn: () => api.get<{ groups: { label: string; items: UpcomingItemDto[] }[] }>('/api/shows/upcoming'),
  });

  if (isLoading) {
    return (
      <div className="px-3 pt-4">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} style={{ height: 122, marginBottom: 12 }} />
        ))}
      </div>
    );
  }
  if (!data || data.groups.length === 0) {
    return <EmptyState title="Aucun épisode à venir" message="Les prochaines diffusions de vos séries apparaîtront ici." />;
  }

  return (
    <div className="pb-4">
      {data.groups.map((group) => (
        <section key={group.label}>
          <PillHeader label={group.label} />
          {group.items.map((item) => (
            <UpcomingCard key={`${item.media.id}-${item.date}`} item={item} />
          ))}
        </section>
      ))}
    </div>
  );
}

// Carte à venir : heure + chaîne en haut droite, multi-épisodes dépliable (spec §18).
function UpcomingCard({ item }: { item: UpcomingItemDto }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const episodes = item.episodes;
  const first = episodes[0]!;
  const now = Date.now();

  const renderEpisode = (ep: (typeof episodes)[number], showMeta: boolean) => {
    const aired = ep.airDate ? new Date(ep.airDate).getTime() <= now : false;
    const isPremiere = ep.seasonNumber >= 1 && ep.episodeNumber === 1;
    return (
      <div key={ep.id} className="flex" style={{ minHeight: 122 }}>
        <div className="shrink-0" style={{ width: 96, background: '#E5E5E5' }}>
          {tmdbImage(ep.stillPath ?? item.media.backdropPath) && (
            <img
              src={tmdbImage(ep.stillPath ?? item.media.backdropPath)!}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <ShowPill
              label={item.media.title}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/show/${item.media.id}`);
              }}
            />
            {showMeta && ep.airDate && (
              <span className="shrink-0 text-right" style={{ fontSize: 14, fontWeight: 700 }}>
                {formatTimeHHMM(ep.airDate)}
                <br />
                <span className="uppercase" style={{ fontSize: 12.5, fontWeight: 700 }}>
                  {ep.network ?? ''}
                </span>
              </span>
            )}
          </div>
          <p style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>
            {formatEpisodeCode(ep.seasonNumber, ep.episodeNumber)}
          </p>
          <p className="truncate" style={{ fontSize: 18.5 }}>
            {ep.title}
          </p>
          {isPremiere && (
            <p className="mt-1">
              <Badge label="PREMIERE" variant="black" />
            </p>
          )}
        </div>
        {aired && (
          <div className="flex items-center pr-4">
            <CheckCircle
              onClick={(e) => {
                e.stopPropagation();
                void offlineTolerantPost(`/api/episodes/${ep.id}/watched`);
              }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/episode/${first.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/episode/${first.id}`)}
      className="cursor-pointer overflow-hidden bg-white shadow-episode-card"
      style={{ margin: '0 12px 12px', borderRadius: 5 }}
    >
      {expanded ? episodes.map((ep) => renderEpisode(ep, true)) : renderEpisode(first, true)}
      {episodes.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="flex w-full items-center justify-between px-5"
          style={{
            height: 52,
            color: 'var(--color-blue-link)',
            fontSize: 16,
            borderTop: '1px solid var(--color-border-light)',
          }}
        >
          {episodes.length} épisodes
          {expanded ? <ChevronUp size={20} aria-hidden /> : <ChevronDown size={20} aria-hidden />}
        </button>
      )}
    </div>
  );
}
