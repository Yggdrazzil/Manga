import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import type { ListDto } from '@serietime/types';
import { ActionSheet, EmptyState, SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useBackClose } from '../../hooks/useBackButton.js';

// Page Listes (spec §28.1).
export function ListsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuList, setMenuList] = useState<ListDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  useBackClose(menuList !== null, () => setMenuList(null));
  useBackClose(creating, () => setCreating(false));

  const { data, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: () => api.get<{ lists: ListDto[] }>('/api/lists'),
  });

  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>('/api/lists', { title }),
    onSuccess: (res) => {
      setCreating(false);
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      navigate(`/lists/${res.id}`);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/lists/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lists'] }),
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
          {[0, 1].map((i) => (
            <SkeletonBlock key={i} style={{ height: 155, marginBottom: 20 }} />
          ))}
        </div>
      )}
      {data && data.lists.length === 0 && <EmptyState title="Aucune liste" message="Créez votre première liste." />}
      {data?.lists.map((list) => (
        <div key={list.id} className="relative mx-6 mb-5 overflow-hidden" style={{ height: 155, borderRadius: 5, background: '#333' }}>
          <button onClick={() => navigate(`/lists/${list.id}`)} className="absolute inset-0" aria-label={list.title}>
            <span className="absolute inset-0 flex">
              {list.posterPaths.slice(0, 4).map((p) => (
                <img key={p} src={tmdbImage(p, 'w185') ?? ''} alt="" className="h-full w-1/4 object-cover" />
              ))}
            </span>
            <span className="absolute inset-0" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.72))' }} />
          </button>
          <button
            aria-label={`Menu ${list.title}`}
            onClick={() => setMenuList(list)}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center"
          >
            <MoreHorizontal size={24} color="#FFF" aria-hidden />
          </button>
          <span className="pointer-events-none absolute bottom-3 left-4 text-white" style={{ fontSize: 22, fontWeight: 800 }}>
            {list.title}
          </span>
        </div>
      ))}

      <ActionSheet
        open={menuList !== null}
        onClose={() => setMenuList(null)}
        items={[
          { label: 'Ouvrir', onClick: () => menuList && navigate(`/lists/${menuList.id}`) },
          { label: 'Renommer', onClick: () => menuList && navigate(`/lists/${menuList.id}/edit`) },
          { label: 'Supprimer la liste', onClick: () => menuList && remove.mutate(menuList.id) },
        ]}
      />

      {creating && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Créer une liste">
          <button aria-label="Fermer" className="absolute inset-0" style={{ background: 'var(--overlay-dark)' }} onClick={() => setCreating(false)} />
          <div className="relative mx-8 w-full max-w-sm bg-white p-6" style={{ borderRadius: 5 }}>
            <p style={{ fontSize: 18, fontWeight: 700 }}>Créer une liste</p>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && title && create.mutate()}
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
