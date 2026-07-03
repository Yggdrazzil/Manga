import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import type { MediaDto } from '@serietime/types';
import { EmptyState, PillHeader, PosterGrid, PosterTile, SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';

const GROUPS: [string, string][] = [
  ['en_cours', 'EN COURS'],
  ['pas_regarde_depuis_un_moment', 'PAS REGARDÉ DEPUIS UN MOMENT'],
  ['abandonne', 'ABANDONNÉ'],
  ['pas_commence', 'PAS COMMENCÉ'],
  ['termine', 'TERMINÉ'],
];

// Profil > Séries (spec §22).
export function ProfileShowsPage() {
  const navigate = useNavigate();
  const [showHidden, setShowHidden] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['shows', 'profile', showHidden],
    queryFn: () => api.get<{ groups: Record<string, MediaDto[]> }>(`/api/shows/profile?hidden=${showHidden}`),
  });

  return (
    <div className="min-h-full bg-white pb-10">
      <PageHeader
        title="Séries"
        right={
          <button
            aria-label={showHidden ? 'Masquer les éléments cachés' : 'Afficher les éléments cachés'}
            aria-pressed={showHidden}
            onClick={() => setShowHidden(!showHidden)}
            className="flex items-center justify-center"
            style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--color-primary-yellow)' }}
          >
            <Eye size={22} aria-hidden />
          </button>
        }
      />
      {isLoading && (
        <div className="grid grid-cols-3 gap-1 p-1">
          {[...Array(6).keys()].map((i) => (
            <SkeletonBlock key={i} style={{ aspectRatio: '2/3' }} />
          ))}
        </div>
      )}
      {data &&
        GROUPS.map(([key, label]) => {
          const items = data.groups[key] ?? [];
          if (items.length === 0) return null;
          return (
            <section key={key}>
              <PillHeader label={label} />
              <div className="px-1">
                <PosterGrid>
                  {items.map((media) => (
                    <PosterTile
                      key={media.id}
                      posterUrl={tmdbImage(media.posterPath)}
                      title={media.title}
                      onClick={() => navigate(`/show/${media.id}`)}
                    />
                  ))}
                </PosterGrid>
              </div>
            </section>
          );
        })}
      {data && Object.values(data.groups).every((g) => g.length === 0) && <EmptyState title="Aucune série" />}
    </div>
  );
}
