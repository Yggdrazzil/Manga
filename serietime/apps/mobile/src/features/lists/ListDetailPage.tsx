import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaDto } from '@serietime/types';
import { EmptyState, PosterGrid, PosterTile, SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';

type ListDetail = { id: string; title: string; description: string | null; items: MediaDto[] };

export function ListDetailPage({ edit = false }: { edit?: boolean }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['lists', id],
    queryFn: () => api.get<ListDetail>(`/api/lists/${id}`),
  });
  const [title, setTitle] = useState<string | null>(null);

  const rename = useMutation({
    mutationFn: (newTitle: string) => api.put(`/api/lists/${id}`, { title: newTitle }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      navigate(`/lists/${id}`, { replace: true });
    },
  });

  const removeItem = useMutation({
    mutationFn: (mediaId: string) => api.delete(`/api/lists/${id}/items/${mediaId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lists'] }),
  });

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Liste" />
        <div className="grid grid-cols-3 gap-1 p-1">
          {[...Array(6).keys()].map((i) => (
            <SkeletonBlock key={i} style={{ aspectRatio: '2/3' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white pb-10">
      <PageHeader title={data.title} />
      {edit && (
        <div className="flex items-center gap-3 px-6 py-4">
          <input
            value={title ?? data.title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 py-2 outline-none"
            style={{ borderBottom: '1px solid var(--color-border)', fontSize: 18 }}
            aria-label="Titre de la liste"
          />
          <button
            onClick={() => title && rename.mutate(title)}
            className="uppercase"
            style={{ fontSize: 14, fontWeight: 800 }}
          >
            Sauvegarder
          </button>
        </div>
      )}
      {data.items.length === 0 ? (
        <EmptyState title="Liste vide" message="Ajoutez des séries ou films depuis leur fiche." />
      ) : (
        <div className="px-1 pt-2">
          <PosterGrid>
            {data.items.map((m) => (
              <PosterTile
                key={m.id}
                posterUrl={tmdbImage(m.posterPath)}
                title={m.title}
                onClick={() => navigate(`/${m.type === 'show' ? 'show' : 'movie'}/${m.id}`)}
                onLongPress={() => removeItem.mutate(m.id)}
              />
            ))}
          </PosterGrid>
        </div>
      )}
    </div>
  );
}
