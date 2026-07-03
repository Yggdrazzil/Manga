import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clapperboard, Play, Plus, Search, Tv, X } from 'lucide-react';
import { EmptyState, SkeletonBlock } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { useToast } from '../../hooks/useToast.js';

type FeedItem = {
  id: string | null;
  tmdbId: string | null;
  type: 'show' | 'movie';
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  inLibrary: boolean;
};

const EXPLORE_TABS = ['FLUX', 'DÉCOUVRIR', 'LISTES'];
const SEARCH_TABS = ['SÉRIES ET FILMS', 'LISTES', 'PERSONNES'];
const PASTEL_BACKGROUNDS = ['#F5EFDC', '#DDE7EE', '#EFE0E0', '#E3EEDD'];

export function ExplorePage({ searchMode = false }: { searchMode?: boolean }) {
  const [tab, setTab] = useState('FLUX');
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(searchMode);
  const [searchTab, setSearchTab] = useState('SÉRIES ET FILMS');
  const searching = focused || query.length > 0;

  return (
    <div className="page-with-bottom-nav min-h-full bg-white">
      {/* Header recherche (spec §20.1) */}
      <div className="safe-top sticky top-0 z-30 bg-white">
        <div className="flex items-center gap-3 px-6" style={{ height: 70 }}>
          <Search size={26} aria-hidden color={searching ? '#000' : 'var(--color-text-muted)'} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Rechercher"
            aria-label="Rechercher"
            className="min-w-0 flex-1 bg-transparent py-2 outline-none"
            style={{ fontSize: 19, borderBottom: '1px solid var(--color-border)' }}
          />
          {query && (
            <button aria-label="Effacer" onClick={() => setQuery('')}>
              <X size={20} color="var(--color-text-muted)" aria-hidden />
            </button>
          )}
          {searching && (
            <button
              onClick={() => {
                setQuery('');
                setFocused(false);
              }}
              style={{ color: 'var(--color-blue-link)', fontSize: 16 }}
            >
              Annuler
            </button>
          )}
        </div>

        {/* Pills (spec §20.2) */}
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-6 pb-3">
          {(searching ? SEARCH_TABS : EXPLORE_TABS).map((t) => {
            const active = searching ? t === searchTab : t === tab;
            return (
              <button
                key={t}
                onClick={() => (searching ? setSearchTab(t) : setTab(t))}
                aria-pressed={active}
                className="shrink-0 uppercase"
                style={{
                  background: active ? 'var(--color-primary-yellow)' : 'var(--color-chip-grey)',
                  borderRadius: 999,
                  padding: '15px 26px',
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {searching ? (
        <SearchResults query={query} tab={searchTab} />
      ) : tab === 'FLUX' ? (
        <FeedView />
      ) : tab === 'DÉCOUVRIR' ? (
        <DiscoverView />
      ) : (
        <ExploreLists />
      )}
    </div>
  );
}

function FeedView() {
  const { data, isLoading } = useQuery({
    queryKey: ['explore', 'feed'],
    queryFn: () => api.get<{ feed: FeedItem[] }>('/api/explore/feed'),
    staleTime: 30 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-5">
        {[0, 1].map((i) => (
          <SkeletonBlock key={i} style={{ height: 380, marginBottom: 20 }} />
        ))}
      </div>
    );
  }
  if (!data || data.feed.length === 0) {
    return (
      <EmptyState
        title="Pas encore de recommandations"
        message="Configurez une clé TMDb sur le serveur et suivez des séries pour alimenter votre flux."
      />
    );
  }
  return (
    <div className="px-5 pb-6 pt-2">
      {data.feed.map((item, i) => (
        <ExploreHeroCard key={`${item.type}-${item.tmdbId}`} item={item} pastel={PASTEL_BACKGROUNDS[i % PASTEL_BACKGROUNDS.length]!} />
      ))}
    </div>
  );
}

// Carte hero du flux (spec §20.3).
function ExploreHeroCard({ item, pastel }: { item: FeedItem; pastel: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [added, setAdded] = useState(false);

  const add = async () => {
    if (!item.tmdbId) return;
    const endpoint = item.type === 'show' ? '/api/shows/add-from-tmdb' : '/api/movies/add-from-tmdb';
    if (item.type === 'movie') await api.post(`/api/movies/add-from-tmdb`, { tmdbId: item.tmdbId });
    else await api.post(endpoint, { tmdbId: item.tmdbId });
    setAdded(true);
    toast('Ajouté à votre watchlist');
    void queryClient.invalidateQueries({ queryKey: [item.type === 'show' ? 'shows' : 'movies'] });
  };

  const open = async () => {
    if (!item.tmdbId) return;
    const endpoint = item.type === 'show' ? '/api/shows/add-from-tmdb' : '/api/movies/add-from-tmdb';
    const res = await api.post<{ mediaId: string }>(endpoint, { tmdbId: item.tmdbId });
    navigate(`/${item.type === 'show' ? 'show' : 'movie'}/${res.mediaId}`);
  };

  const TypeIcon = item.type === 'show' ? Tv : Clapperboard;
  return (
    <div className="mb-6 overflow-hidden" style={{ borderRadius: 5, boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}>
      <button onClick={() => void open()} className="relative block w-full text-left" style={{ aspectRatio: '16/11', background: '#222' }}>
        {tmdbImage(item.backdropPath ?? item.posterPath, 'w780') && (
          <img src={tmdbImage(item.backdropPath ?? item.posterPath, 'w780')!} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
        <span className="absolute inset-0" style={{ background: 'linear-gradient(rgba(0,0,0,0.05), rgba(0,0,0,0.55))' }} />
        <span
          role="button"
          tabIndex={0}
          aria-label="Ajouter à la watchlist"
          onClick={(e) => {
            e.stopPropagation();
            void add();
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), void add())}
          className="absolute right-4 top-4 flex items-center justify-center"
          style={{
            width: 46,
            height: 46,
            borderRadius: 10,
            border: '2.5px solid var(--color-primary-yellow)',
            background: added ? 'var(--color-primary-yellow)' : 'rgba(0,0,0,0.25)',
          }}
        >
          <Plus size={26} color={added ? '#000' : 'var(--color-primary-yellow)'} aria-hidden />
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-center justify-center" style={{ width: 58, height: 58, borderRadius: '50%', border: '3px solid #FFF' }}>
            <Play size={24} fill="#FFF" color="#FFF" aria-hidden />
          </span>
        </span>
        <span className="absolute bottom-3 left-4 right-4 text-white">
          <span className="flex items-center gap-2">
            <TypeIcon size={22} aria-hidden />
            <span style={{ fontSize: 24, fontWeight: 800 }}>{item.title}</span>
          </span>
          <span className="block" style={{ fontSize: 14.5, opacity: 0.92 }}>
            {item.year ?? ''}
          </span>
        </span>
      </button>
      {item.overview && (
        <p className="px-5 py-4" style={{ background: pastel, fontSize: 16.5, lineHeight: 1.4 }}>
          {item.overview.length > 110 ? `${item.overview.slice(0, 110)} …` : item.overview}
        </p>
      )}
    </div>
  );
}

function DiscoverView() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['explore', 'discover'],
    queryFn: () =>
      api.get<{ shows: FeedItem[]; movies: FeedItem[] }>('/api/explore/discover'),
    staleTime: 30 * 60_000,
  });
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1 p-1">
        {[...Array(9).keys()].map((i) => (
          <SkeletonBlock key={i} style={{ aspectRatio: '2/3' }} />
        ))}
      </div>
    );
  }
  if (!data || (data.shows.length === 0 && data.movies.length === 0)) {
    return <EmptyState title="Rien à découvrir" message="Configurez une clé TMDb sur le serveur." />;
  }
  const open = async (item: FeedItem) => {
    if (!item.tmdbId) return;
    const endpoint = item.type === 'show' ? '/api/shows/add-from-tmdb' : '/api/movies/add-from-tmdb';
    const res = await api.post<{ mediaId: string }>(endpoint, { tmdbId: item.tmdbId });
    navigate(`/${item.type === 'show' ? 'show' : 'movie'}/${res.mediaId}`);
  };
  return (
    <div className="pb-6">
      {(['Séries tendance', 'Films tendance'] as const).map((title, idx) => {
        const items = idx === 0 ? data.shows : data.movies;
        return (
          <section key={title} className="mt-4">
            <h2 className="px-6" style={{ fontSize: 24, fontWeight: 800 }}>
              {title}
            </h2>
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-6">
              {items.map((item) => (
                <button
                  key={item.tmdbId}
                  onClick={() => void open(item)}
                  aria-label={item.title}
                  className="shrink-0 overflow-hidden"
                  style={{ width: 118, aspectRatio: '2/3', borderRadius: 3, background: '#E5E5E5' }}
                >
                  {tmdbImage(item.posterPath, 'w185') && (
                    <img src={tmdbImage(item.posterPath, 'w185')!} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ExploreLists() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['lists'],
    queryFn: () => api.get<{ lists: { id: string; title: string; posterPaths: string[]; itemCount: number }[] }>('/api/lists'),
  });
  if (!data || data.lists.length === 0) {
    return <EmptyState title="Aucune liste" message="Créez des listes depuis votre profil." />;
  }
  return (
    <div className="p-6">
      {data.lists.map((list) => (
        <button
          key={list.id}
          onClick={() => navigate(`/lists/${list.id}`)}
          className="relative mb-5 block w-full overflow-hidden text-left"
          style={{ height: 155, borderRadius: 5, background: '#333' }}
        >
          <span className="absolute inset-0 flex">
            {list.posterPaths.slice(0, 4).map((p) => (
              <img key={p} src={tmdbImage(p, 'w185') ?? ''} alt="" className="h-full w-1/4 object-cover" />
            ))}
          </span>
          <span className="absolute inset-0" style={{ background: 'var(--overlay-dark)' }} />
          <span className="absolute bottom-3 left-4 text-white" style={{ fontSize: 22, fontWeight: 800 }}>
            {list.title}
          </span>
        </button>
      ))}
    </div>
  );
}

function SearchResults({ query, tab }: { query: string; tab: string }) {
  const navigate = useNavigate();
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const type = tab === 'LISTES' ? 'lists' : tab === 'PERSONNES' ? 'people' : 'media';
  const { data, isLoading } = useQuery({
    queryKey: ['search', debounced, type],
    queryFn: () => api.get<{ results: unknown[] }>(`/api/search?q=${encodeURIComponent(debounced)}&type=${type}`),
    enabled: debounced.length > 0,
  });

  const mediaResults = useMemo(() => (type === 'media' ? ((data?.results ?? []) as FeedItem[]) : []), [data, type]);

  if (!debounced) return null;
  if (isLoading) {
    return (
      <div className="p-4">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} style={{ height: 80, marginBottom: 10 }} />
        ))}
      </div>
    );
  }
  if (!data || data.results.length === 0) {
    // État vide (spec §20.4)
    return (
      <EmptyState title="Toutes nos excuses" message={`Nous n'avons trouvé aucun résultat pour « ${debounced} »`} />
    );
  }

  if (type === 'media') {
    const open = async (item: FeedItem) => {
      if (item.id) {
        navigate(`/${item.type === 'show' ? 'show' : 'movie'}/${item.id}`);
        return;
      }
      if (!item.tmdbId) return;
      const endpoint = item.type === 'show' ? '/api/shows/add-from-tmdb' : '/api/movies/add-from-tmdb';
      const res = await api.post<{ mediaId: string }>(endpoint, { tmdbId: item.tmdbId });
      navigate(`/${item.type === 'show' ? 'show' : 'movie'}/${res.mediaId}`);
    };
    return (
      <div className="pb-6">
        {mediaResults.map((item) => (
          <button
            key={`${item.type}-${item.id ?? item.tmdbId}`}
            onClick={() => void open(item)}
            className="flex w-full items-center gap-4 px-5 py-2 text-left"
          >
            <span className="shrink-0 overflow-hidden" style={{ width: 56, aspectRatio: '2/3', borderRadius: 3, background: '#E5E5E5' }}>
              {tmdbImage(item.posterPath, 'w92') && <img src={tmdbImage(item.posterPath, 'w92')!} alt="" className="h-full w-full object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate" style={{ fontSize: 18, fontWeight: 700 }}>
                {item.title}
              </span>
              <span className="block" style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                {[item.type === 'show' ? 'Série' : 'Film', item.year].filter(Boolean).join(' · ')}
              </span>
            </span>
            {item.inLibrary && (
              <span className="uppercase" style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-muted)' }}>
                Suivi
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (type === 'people') {
    const people = data.results as { id: string; name: string; profilePath: string | null }[];
    return (
      <div className="pb-6">
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-4 px-5 py-2">
            <span className="shrink-0 overflow-hidden" style={{ width: 52, height: 52, borderRadius: '50%', background: '#E5E5E5' }}>
              {tmdbImage(p.profilePath, 'w185') && <img src={tmdbImage(p.profilePath, 'w185')!} alt="" className="h-full w-full object-cover" />}
            </span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{p.name}</span>
          </div>
        ))}
      </div>
    );
  }

  const lists = data.results as { id: string; title: string; posterPaths: string[] }[];
  return (
    <div className="p-6">
      {lists.map((list) => (
        <button
          key={list.id}
          onClick={() => navigate(`/lists/${list.id}`)}
          className="relative mb-5 block w-full overflow-hidden text-left"
          style={{ height: 155, borderRadius: 5, background: '#333' }}
        >
          <span className="absolute inset-0" style={{ background: 'var(--overlay-dark)' }} />
          <span className="absolute bottom-3 left-4 text-white" style={{ fontSize: 22, fontWeight: 800 }}>
            {list.title}
          </span>
        </button>
      ))}
    </div>
  );
}
