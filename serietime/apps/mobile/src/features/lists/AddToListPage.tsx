import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import type { ListDto } from '@serietime/types';
import { EmptyState, SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useToast } from '../../hooks/useToast.js';

// Ajouter à une liste (spec §28.2) — :id est le mediaId.
export function AddToListPage() {
  const { id: mediaId = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['lists', 'for-media', mediaId],
    queryFn: () => api.get<{ lists: ListDto[] }>(`/api/lists?mediaId=${mediaId}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['lists'] });
  };

  const toggle = useMutation({
    mutationFn: async (list: ListDto) => {
      if (list.containsMediaId) {
        await api.delete(`/api/lists/${list.id}/items/${mediaId}`);
        return { list, added: false };
      }
      await api.post(`/api/lists/${list.id}/items`, { mediaId });
      return { list, added: true };
    },
    onSuccess: ({ list, added }) => {
      invalidate();
      toast(added ? `Ajouté à ${list.title}` : `Retiré de ${list.title}`);
    },
  });

  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>('/api/lists', { title }),
    onSuccess: async (res) => {
      await api.post(`/api/lists/${res.id}/items`, { mediaId });
      setCreating(false);
      setTitle('');
      invalidate();
      toast(`Ajouté à ${title}`);
    },
  });

  return (
    <div className="min-h-full bg-white pb-10">
      <PageHeader title="Listes" />
      <div className="px-6 py-4">
        <button
          onClick={() => setCreating(true)}
          className="w-full uppercase"
          style={{ background: 'var(--color-primary-yellow)', borderRadius: 999, padding: '15px 0', fontSize: 15, fontWeight: 800, letterSpacing: '0.05em' }}
        >
          Créer une liste
        </button>
      </div>
      {isLoading && (
        <div className="px-6">
          <SkeletonBlock style={{ height: 155 }} />
        </div>
      )}
      {data && data.lists.length === 0 && <EmptyState title="Aucune liste" />}
      {data?.lists.map((list) => (
        <div key={list.id} className="relative mx-6 mb-5 overflow-hidden" style={{ height: 155, borderRadius: 5, background: '#333' }}>
          <span className="absolute inset-0 flex">
            {list.posterPaths.slice(0, 4).map((p) => (
              <img key={p} src={tmdbImage(p, 'w185') ?? ''} alt="" className="h-full w-1/4 object-cover" />
            ))}
          </span>
          <span className="absolute inset-0" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.72))' }} />
          <span className="absolute bottom-3 left-4 text-white" style={{ fontSize: 22, fontWeight: 800 }}>
            {list.title}
          </span>
          <button
            aria-label={list.containsMediaId ? `Retirer de ${list.title}` : `Ajouter à ${list.title}`}
            aria-pressed={list.containsMediaId}
            onClick={() => toggle.mutate(list)}
            className="absolute bottom-3 right-3 flex items-center justify-center"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '2.5px solid ' + (list.containsMediaId ? 'var(--color-primary-yellow)' : '#FFF'),
              background: list.containsMediaId ? 'var(--color-primary-yellow)' : 'transparent',
            }}
          >
            {list.containsMediaId && <Check size={22} color="#000" aria-hidden />}
          </button>
        </div>
      ))}

      {creating && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" role="dialog" aria-modal="true">
          <button aria-label="Fermer" className="absolute inset-0" style={{ background: 'var(--overlay-dark)' }} onClick={() => setCreating(false)} />
          <div className="relative mx-8 w-full max-w-sm bg-white p-6" style={{ borderRadius: 5 }}>
            <p style={{ fontSize: 18, fontWeight: 700 }}>Créer une liste</p>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la liste"
              className="mt-4 w-full py-2 outline-none"
              style={{ borderBottom: '1px solid var(--color-border)', fontSize: 18 }}
            />
            <div className="mt-6 flex justify-end gap-6">
              <button onClick={() => setCreating(false)} className="uppercase" style={{ fontSize: 14, fontWeight: 800 }}>
                Annuler
              </button>
              <button onClick={() => title && create.mutate()} className="uppercase" style={{ fontSize: 14, fontWeight: 800 }}>
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
