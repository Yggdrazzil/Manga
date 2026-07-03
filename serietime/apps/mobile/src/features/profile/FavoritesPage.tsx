import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { MediaDto } from '@serietime/types';
import { EmptyState, PosterGrid, PosterTile, SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';

export function FavoritesPage({ type }: { type: 'show' | 'movie' }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['favorites', type],
    queryFn: () => api.get<{ favorites: MediaDto[] }>(`/api/profile/favorites?type=${type}`),
  });
  return (
    <div className="min-h-full bg-white pb-10">
      <PageHeader title={type === 'show' ? 'Séries préférées' : 'Films préférés'} />
      {isLoading && (
        <div className="grid grid-cols-3 gap-1 p-1">
          {[...Array(6).keys()].map((i) => (
            <SkeletonBlock key={i} style={{ aspectRatio: '2/3' }} />
          ))}
        </div>
      )}
      {data && data.favorites.length === 0 && <EmptyState title="Aucun favori" />}
      {data && (
        <div className="px-1 pt-2">
          <PosterGrid>
            {data.favorites.map((m) => (
              <PosterTile
                key={m.id}
                posterUrl={tmdbImage(m.posterPath)}
                title={m.title}
                onClick={() => navigate(`/${m.type === 'show' ? 'show' : 'movie'}/${m.id}`)}
              />
            ))}
          </PosterGrid>
        </div>
      )}
    </div>
  );
}
