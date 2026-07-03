import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import type { MediaDto } from '@serietime/types';
import { Chip, EmptyState, FloatingFilterButton, BottomSheet, PillHeader, PosterGrid, PosterTile, RadioOption, SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useBackClose } from '../../hooks/useBackButton.js';

type Sort = 'last_watched' | 'last_added' | 'alpha';
type Filter = 'all' | 'seen' | 'unseen';

const SORT_LABELS: [Sort, string][] = [
  ['last_watched', 'Dernier visionnage'],
  ['last_added', 'Dernier ajout'],
  ['alpha', 'Ordre alphabétique'],
];
const FILTER_LABELS: [Filter, string][] = [
  ['all', 'Tous'],
  ['seen', 'Vu'],
  ['unseen', 'Non vu'],
];

// Profil > Films avec bottom sheet filtres (spec §23).
export function ProfileMoviesPage() {
  const navigate = useNavigate();
  const [showHidden, setShowHidden] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<Sort>('last_watched');
  const [filter, setFilter] = useState<Filter>('all');
  const [draftSort, setDraftSort] = useState<Sort>(sort);
  const [draftFilter, setDraftFilter] = useState<Filter>(filter);
  useBackClose(sheetOpen, () => setSheetOpen(false));

  const { data, isLoading } = useQuery({
    queryKey: ['movies', 'profile', sort, filter, showHidden],
    queryFn: () =>
      api.get<{ seen: MediaDto[]; unseen: MediaDto[] }>(
        `/api/movies/profile?sort=${sort}&filter=${filter}&hidden=${showHidden}`,
      ),
  });

  const openSheet = () => {
    setDraftSort(sort);
    setDraftFilter(filter);
    setSheetOpen(true);
  };

  return (
    <div className="min-h-full bg-white pb-24">
      <PageHeader
        title="Films"
        right={
          <button
            aria-label="Afficher les éléments cachés"
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
      {data && (
        <>
          {data.seen.length > 0 && (
            <section>
              <PillHeader label="VU" />
              <div className="px-1">
                <PosterGrid>
                  {data.seen.map((m) => (
                    <PosterTile key={m.id} posterUrl={tmdbImage(m.posterPath)} title={m.title} onClick={() => navigate(`/movie/${m.id}`)} />
                  ))}
                </PosterGrid>
              </div>
            </section>
          )}
          {data.unseen.length > 0 && (
            <section>
              <PillHeader label="PAS VU" />
              <div className="px-1">
                <PosterGrid>
                  {data.unseen.map((m) => (
                    <PosterTile key={m.id} posterUrl={tmdbImage(m.posterPath)} title={m.title} onClick={() => navigate(`/movie/${m.id}`)} />
                  ))}
                </PosterGrid>
              </div>
            </section>
          )}
          {data.seen.length === 0 && data.unseen.length === 0 && <EmptyState title="Aucun film" />}
        </>
      )}

      <FloatingFilterButton onClick={openSheet} />

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} ariaLabel="Filtres">
        <div className="pt-5">
          <p className="px-6" style={{ fontSize: 22, fontWeight: 800 }}>
            Trier par
          </p>
          <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto px-6 pb-5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            {SORT_LABELS.map(([value, label]) => (
              <Chip key={value} label={label} active={draftSort === value} onClick={() => setDraftSort(value)} />
            ))}
          </div>
          <p className="px-6 pt-5" style={{ fontSize: 22, fontWeight: 800 }}>
            Avancement
          </p>
          <div role="radiogroup" aria-label="Avancement" className="mt-1">
            {FILTER_LABELS.map(([value, label]) => (
              <RadioOption key={value} label={label} selected={draftFilter === value} onSelect={() => setDraftFilter(value)} trailing />
            ))}
          </div>
          <div className="flex gap-4 px-6 py-5" style={{ borderTop: '1px solid var(--color-border-light)' }}>
            <button
              onClick={() => {
                setDraftSort('last_watched');
                setDraftFilter('all');
              }}
              className="flex-1 uppercase"
              style={{ border: '1.5px solid var(--color-border)', borderRadius: 999, padding: '14px 0', fontSize: 14, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}
            >
              Réinitialiser
            </button>
            <button
              onClick={() => {
                setSort(draftSort);
                setFilter(draftFilter);
                setSheetOpen(false);
              }}
              className="flex-1 uppercase"
              style={{ background: 'var(--color-primary-yellow-soft)', borderRadius: 999, padding: '14px 0', fontSize: 14, fontWeight: 800, letterSpacing: '0.05em' }}
            >
              Appliquer
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
