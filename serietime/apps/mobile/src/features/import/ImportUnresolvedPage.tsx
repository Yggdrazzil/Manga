import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UnresolvedMappingDto } from '@serietime/types';
import { EmptyState, SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useToast } from '../../hooks/useToast.js';
import { useBackClose } from '../../hooks/useBackButton.js';

type SearchResult = {
  id: string | null;
  tmdbId: string | null;
  type: 'show' | 'movie';
  title: string;
  year: number | null;
  posterPath: string | null;
};

// Résolution manuelle des mappings (spec §15.7).
export function ImportUnresolvedPage() {
  const { importId = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchFor, setSearchFor] = useState<UnresolvedMappingDto | null>(null);
  useBackClose(searchFor !== null, () => setSearchFor(null));

  const { data, isLoading } = useQuery({
    queryKey: ['import', importId, 'unresolved'],
    queryFn: () => api.get<{ items: UnresolvedMappingDto[] }>(`/api/import/tvtime/${importId}/unresolved`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['import', importId] });
  };

  const resolve = useMutation({
    mutationFn: (body: { mappingId: string; mediaId?: string; tmdbId?: string; create?: { title: string; year?: number; type: 'show' | 'movie' } }) =>
      api.post(`/api/import/tvtime/${importId}/resolve`, body),
    onSuccess: () => {
      invalidate();
      toast('Élément résolu');
      setSearchFor(null);
    },
  });

  const ignore = useMutation({
    mutationFn: (mappingId: string) => api.post(`/api/import/tvtime/${importId}/ignore`, { mappingId }),
    onSuccess: () => {
      invalidate();
      toast('Élément ignoré');
    },
  });

  return (
    <div className="min-h-full pb-10" style={{ background: 'var(--color-page-muted)' }}>
      <PageHeader title="À résoudre" />
      {isLoading && (
        <div className="p-4">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} style={{ height: 160, marginBottom: 12 }} />
          ))}
        </div>
      )}
      {data && data.items.length === 0 && (
        <EmptyState title="Tout est résolu" message="Aucun élément ne nécessite votre attention." />
      )}
      {data?.items.map((item) => (
        <div key={item.id} className="mx-3 mb-3 bg-white p-4 shadow-episode-card" style={{ borderRadius: 5 }}>
          <p className="truncate" style={{ fontSize: 19, fontWeight: 800 }}>
            {item.sourceTitle}
          </p>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
            {[
              item.sourceType === 'movie' ? 'Film' : item.sourceType === 'show' ? 'Série' : 'Type inconnu',
              item.year,
              item.externalIds.tvdbId ? `TVDB ${item.externalIds.tvdbId}` : null,
              item.externalIds.tmdbId ? `TMDb ${item.externalIds.tmdbId}` : null,
              item.matchScore !== null ? `score ${item.matchScore}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {item.suggestions.length > 0 && (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
              {item.suggestions.slice(0, 5).map((sug) => (
                <button
                  key={`${sug.mediaId ?? sug.tmdbId}`}
                  onClick={() =>
                    resolve.mutate({
                      mappingId: item.id,
                      ...(sug.mediaId ? { mediaId: sug.mediaId } : { tmdbId: sug.tmdbId }),
                    })
                  }
                  className="shrink-0 text-left"
                  style={{ width: 92 }}
                  aria-label={`Choisir ${sug.title}`}
                >
                  <span className="block overflow-hidden" style={{ aspectRatio: '2/3', borderRadius: 3, background: '#E5E5E5' }}>
                    {tmdbImage(sug.posterPath, 'w92') && (
                      <img src={tmdbImage(sug.posterPath, 'w92')!} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="mt-1 block truncate" style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {sug.title}
                  </span>
                  <span className="block" style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                    {[sug.year, `score ${sug.score}`].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton
              label="RECHERCHER"
              onClick={() => setSearchFor(item)}
            />
            <ActionButton
              label="CRÉER MANUELLEMENT"
              onClick={() =>
                resolve.mutate({
                  mappingId: item.id,
                  create: {
                    title: item.sourceTitle,
                    year: item.year ?? undefined,
                    type: item.sourceType === 'movie' ? 'movie' : 'show',
                  },
                })
              }
            />
            <ActionButton label="IGNORER" muted onClick={() => ignore.mutate(item.id)} />
          </div>
        </div>
      ))}

      {searchFor && (
        <SearchSheet
          mapping={searchFor}
          onClose={() => setSearchFor(null)}
          onPick={(result) =>
            resolve.mutate({
              mappingId: searchFor.id,
              ...(result.id ? { mediaId: result.id } : { tmdbId: result.tmdbId ?? undefined }),
            })
          }
        />
      )}
    </div>
  );
}

function ActionButton({ label, onClick, muted = false }: { label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="uppercase"
      style={{
        border: muted ? '1.5px solid var(--color-border)' : '2px solid #000',
        color: muted ? 'var(--color-text-muted)' : '#000',
        borderRadius: 999,
        padding: '9px 16px',
        fontSize: 12.5,
        fontWeight: 800,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </button>
  );
}

function SearchSheet({
  mapping,
  onClose,
  onPick,
}: {
  mapping: UnresolvedMappingDto;
  onClose: () => void;
  onPick: (result: SearchResult) => void;
}) {
  const [query, setQuery] = useState(mapping.sourceTitle);
  const { data, isLoading } = useQuery({
    queryKey: ['search', query, 'media'],
    queryFn: () => api.get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}&type=media`),
    enabled: query.length > 1,
  });

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Rechercher">
      <button aria-label="Fermer" className="absolute inset-0" style={{ background: 'var(--overlay-dark)' }} onClick={onClose} />
      <div className="bottom-sheet absolute bottom-0 left-0 right-0 bg-white" style={{ borderRadius: '5px 5px 0 0', maxHeight: '80%', overflowY: 'auto' }}>
        <div className="p-5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher"
            className="w-full py-2 outline-none"
            style={{ borderBottom: '1px solid var(--color-border)', fontSize: 18 }}
            aria-label="Rechercher un titre"
          />
          {isLoading && <SkeletonBlock style={{ height: 60, marginTop: 12 }} />}
          {data?.results.slice(0, 12).map((r) => (
            <button key={`${r.type}-${r.id ?? r.tmdbId}`} onClick={() => onPick(r)} className="flex w-full items-center gap-3 py-2 text-left">
              <span className="shrink-0 overflow-hidden" style={{ width: 44, aspectRatio: '2/3', borderRadius: 3, background: '#E5E5E5' }}>
                {tmdbImage(r.posterPath, 'w92') && <img src={tmdbImage(r.posterPath, 'w92')!} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontSize: 16, fontWeight: 600 }}>
                  {r.title}
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {[r.type === 'show' ? 'Série' : 'Film', r.year].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
