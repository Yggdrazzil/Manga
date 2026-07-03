import { useNavigate } from 'react-router-dom';
import type { QueueItemDto } from '@serietime/types';
import { formatEpisodeCode } from '@serietime/core';
import { Badge, CheckCircle, ShowPill } from '@serietime/ui';
import { tmdbImage } from '../../lib/api.js';

const BADGE_LABELS: Record<string, { label: string; variant: 'black' | 'yellow' }> = {
  PREMIERE: { label: 'PREMIERE', variant: 'black' },
  NOUVEAU: { label: 'NOUVEAU', variant: 'yellow' },
  PLUS_RECENT: { label: 'PLUS RÉCENT', variant: 'black' },
};

export function EpisodeQueueCard({
  item,
  onCheck,
  topRight,
}: {
  item: QueueItemDto;
  onCheck?: () => void;
  topRight?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const ep = item.nextEpisode;
  const image = tmdbImage(ep?.stillPath ?? item.media.backdropPath ?? item.media.posterPath, 'w342');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => (ep ? navigate(`/episode/${ep.id}`) : navigate(`/show/${item.media.id}`))}
      onKeyDown={(e) => e.key === 'Enter' && (ep ? navigate(`/episode/${ep.id}`) : navigate(`/show/${item.media.id}`))}
      className="flex cursor-pointer overflow-hidden bg-white shadow-episode-card"
      style={{ margin: '0 12px 12px', borderRadius: 5, minHeight: 122 }}
    >
      <div className="shrink-0" style={{ width: 96, background: '#E5E5E5' }}>
        {image && <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />}
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
          {topRight}
        </div>
        {ep ? (
          <>
            <p className="flex items-baseline gap-2">
              <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>
                {formatEpisodeCode(ep.seasonNumber, ep.episodeNumber)}
              </span>
              {item.remainingCount > 0 && (
                <span style={{ fontSize: 15, fontWeight: 800 }}>+{item.remainingCount}</span>
              )}
            </p>
            <p className="truncate" style={{ fontSize: 18.5, lineHeight: 1.25 }}>
              {ep.title}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 18.5, color: 'var(--color-text-muted)' }}>Aucun épisode à voir</p>
        )}
        {item.badges.length > 0 && (
          <p className="mt-1 flex gap-2">
            {item.badges.map((b) => {
              const badge = BADGE_LABELS[b];
              return badge ? <Badge key={b} label={badge.label} variant={badge.variant} /> : null;
            })}
          </p>
        )}
      </div>
      {ep && (
        <div className="flex items-center pr-4">
          <CheckCircle
            checked={false}
            onClick={(e) => {
              e.stopPropagation();
              onCheck?.();
            }}
            label={`Marquer ${formatEpisodeCode(ep.seasonNumber, ep.episodeNumber)} vu`}
          />
        </div>
      )}
    </div>
  );
}
