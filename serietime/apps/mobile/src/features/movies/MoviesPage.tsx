import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { MediaDto } from '@serietime/types';
import { upcomingGroupLabel } from '@serietime/core';
import { EmptyState, GridToggleButton, PillHeader, PosterGrid, PosterTile, SkeletonBlock, TopTabs } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { useAppStore } from '../../lib/store.js';

type MoviesResponse = {
  toWatch: MediaDto[];
  upcoming: { media: MediaDto; releaseDate: string }[];
};

export function MoviesPage() {
  const [tab, setTab] = useState('À VOIR');
  const navigate = useNavigate();
  const { moviesGridMode, toggleMoviesGrid } = useAppStore();
  const { data, isLoading } = useQuery({
    queryKey: ['movies'],
    queryFn: () => api.get<MoviesResponse>('/api/movies'),
  });

  return (
    <div className="page-with-bottom-nav min-h-full bg-white">
      <div className="safe-top bg-white">
        <TopTabs tabs={['À VOIR', 'À VENIR']} active={tab} onChange={setTab} />
      </div>

      {isLoading && (
        <div className="grid grid-cols-3 gap-1 p-1 pt-14">
          {[...Array(9).keys()].map((i) => (
            <SkeletonBlock key={i} style={{ aspectRatio: '2/3' }} />
          ))}
        </div>
      )}

      {tab === 'À VOIR' && data && (
        <>
          <div className="relative flex items-center justify-center">
            <PillHeader label="À VOIR" />
            <div className="absolute right-3">
              <GridToggleButton active={moviesGridMode} onToggle={toggleMoviesGrid} />
            </div>
          </div>
          {data.toWatch.length === 0 ? (
            <EmptyState title="Aucun film à voir" message="Ajoutez des films depuis Explorer." />
          ) : (
            <div className="px-1">
              <PosterGrid>
                {data.toWatch.map((movie) => (
                  <PosterTile
                    key={movie.id}
                    posterUrl={tmdbImage(movie.posterPath)}
                    title={movie.title}
                    onClick={() => navigate(`/movie/${movie.id}`)}
                  />
                ))}
              </PosterGrid>
            </div>
          )}
        </>
      )}

      {tab === 'À VENIR' && data && (
        <>
          {data.upcoming.length === 0 ? (
            <EmptyState title="Aucun film à venir" />
          ) : (
            groupUpcoming(data.upcoming).map((group) => (
              <section key={group.label}>
                <PillHeader label={group.label} />
                <div className="grid grid-cols-3 gap-1 px-1">
                  {group.items.map((item) => (
                    <PosterTile
                      key={item.media.id}
                      posterUrl={tmdbImage(item.media.posterPath)}
                      title={item.media.title}
                      onClick={() => navigate(`/movie/${item.media.id}`)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

function groupUpcoming(items: { media: MediaDto; releaseDate: string }[]) {
  const groups = new Map<string, { media: MediaDto; releaseDate: string }[]>();
  for (const item of items) {
    const label = upcomingGroupLabel(new Date(item.releaseDate));
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}
