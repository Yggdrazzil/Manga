import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';

type ImagesResponse = { posters: string[]; backdrops: string[]; selectedPoster: string | null; selectedBackdrop: string | null };

export function BannersPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['show', id, 'images'],
    queryFn: () => api.get<ImagesResponse>(`/api/shows/${id}/images`),
  });
  const select = useMutation({
    mutationFn: (backdropPath: string) => api.post(`/api/shows/${id}/banner`, { backdropPath }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['show', id] });
      void queryClient.invalidateQueries({ queryKey: ['shows'] });
    },
  });

  return (
    <div className="min-h-full bg-white pb-8">
      <PageHeader title="Changer la bannière" />
      <div className="flex flex-col gap-4 p-4">
        {isLoading && [0, 1, 2].map((i) => <SkeletonBlock key={i} style={{ aspectRatio: '16/9' }} />)}
        {data?.backdrops.map((backdrop) => {
          const selected = backdrop === data.selectedBackdrop;
          return (
            <button
              key={backdrop}
              onClick={() => select.mutate(backdrop)}
              className="relative w-full overflow-hidden"
              style={{ aspectRatio: '16/9', borderRadius: 5, background: '#E5E5E5' }}
              aria-label={selected ? 'Bannière sélectionnée' : 'Choisir cette bannière'}
              aria-pressed={selected}
            >
              {tmdbImage(backdrop, 'w780') && (
                <img src={tmdbImage(backdrop, 'w780')!} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
              {selected && (
                <span className="absolute inset-0 flex items-center justify-center gap-2 text-white" style={{ background: 'var(--overlay-dark)' }}>
                  <Star size={28} fill="var(--color-primary-yellow)" color="var(--color-primary-yellow)" aria-hidden />
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
