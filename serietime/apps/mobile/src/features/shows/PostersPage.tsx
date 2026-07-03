import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';

type ImagesResponse = { posters: string[]; backdrops: string[]; selectedPoster: string | null; selectedBackdrop: string | null };

export function PostersPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['show', id, 'images'],
    queryFn: () => api.get<ImagesResponse>(`/api/shows/${id}/images`),
  });
  const select = useMutation({
    mutationFn: (posterPath: string) => api.post(`/api/shows/${id}/poster`, { posterPath }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['show', id] });
      void queryClient.invalidateQueries({ queryKey: ['shows'] });
    },
  });

  return (
    <div className="min-h-full bg-white pb-8">
      <PageHeader title="Modifier l'affiche" />
      <div className="grid grid-cols-2 gap-3 p-4">
        {isLoading &&
          [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} style={{ aspectRatio: '2/3' }} />)}
        {data?.posters.map((poster) => {
          const selected = poster === data.selectedPoster;
          return (
            <button
              key={poster}
              onClick={() => select.mutate(poster)}
              className="relative overflow-hidden"
              style={{ aspectRatio: '2/3', borderRadius: 5, background: '#E5E5E5' }}
              aria-label={selected ? 'Affiche sélectionnée' : 'Choisir cette affiche'}
              aria-pressed={selected}
            >
              {tmdbImage(poster, 'w342') && (
                <img src={tmdbImage(poster, 'w342')!} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
              {selected && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white" style={{ background: 'var(--overlay-dark)' }}>
                  <Star size={34} fill="var(--color-primary-yellow)" color="var(--color-primary-yellow)" aria-hidden />
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Sélectionnée</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
