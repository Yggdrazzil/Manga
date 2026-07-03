import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MediaDto } from '@serietime/types';
import { EmptyState, ToggleSwitch } from '@serietime/ui';
import { api, tmdbImage } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';

const PROVIDERS = ['Netflix', 'Amazon Prime Video', 'Disney+', 'Apple TV+', 'Canal+', 'Crunchyroll', 'ADN', 'Max', 'Paramount+'];
const CHANNELS = ['TF1', 'France 2', 'France 3', 'M6', 'Arte', 'Canal+', 'W9', 'TMC', 'Tokyo MX'];

type Kind = 'subscriptions' | 'channels' | 'disliked';

const TITLES: Record<Kind, string> = {
  subscriptions: "Services d'abonnement",
  channels: 'Choix des chaînes',
  disliked: 'Non appréciés',
};

export function SimpleSettingsListPage({ kind }: { kind: Kind }) {
  const queryClient = useQueryClient();
  const settingsKey = kind === 'subscriptions' ? 'subscriptions' : 'channels';

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ settings: { subscriptions: string[]; upcoming: { channels: string[]; hideWatched: boolean } } }>('/api/settings'),
    enabled: kind !== 'disliked',
  });

  const { data: dislikedData } = useQuery({
    queryKey: ['disliked'],
    queryFn: () => api.get<{ items: MediaDto[] }>('/api/disliked'),
    enabled: kind === 'disliked',
  });

  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.post('/api/settings', patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const restore = useMutation({
    mutationFn: (mediaId: string) => api.post(`/api/disliked/${mediaId}`, { hidden: false }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['disliked'] }),
  });

  if (kind === 'disliked') {
    return (
      <div className="min-h-full bg-white pb-10">
        <PageHeader title={TITLES[kind]} />
        {dislikedData && dislikedData.items.length === 0 && (
          <EmptyState title="Aucun contenu masqué" message="Les séries et films masqués n'apparaissent plus dans vos recommandations." />
        )}
        {dislikedData?.items.map((m) => (
          <div key={m.id} className="flex items-center gap-4 px-6 py-3" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <span className="shrink-0 overflow-hidden" style={{ width: 48, aspectRatio: '2/3', borderRadius: 3, background: '#E5E5E5' }}>
              {tmdbImage(m.posterPath, 'w92') && <img src={tmdbImage(m.posterPath, 'w92')!} alt="" className="h-full w-full object-cover" />}
            </span>
            <span className="min-w-0 flex-1 truncate" style={{ fontSize: 17 }}>
              {m.title}
            </span>
            <button onClick={() => restore.mutate(m.id)} style={{ color: 'var(--color-blue-link)', fontSize: 15 }}>
              Restaurer
            </button>
          </div>
        ))}
      </div>
    );
  }

  const options = kind === 'subscriptions' ? PROVIDERS : CHANNELS;
  const selected: string[] =
    kind === 'subscriptions'
      ? (settingsData?.settings.subscriptions ?? [])
      : (settingsData?.settings.upcoming.channels ?? []);

  const toggle = (name: string) => {
    const next = selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name];
    if (kind === 'subscriptions') update.mutate({ subscriptions: next });
    else
      update.mutate({
        upcoming: { ...(settingsData?.settings.upcoming ?? { hideWatched: false }), channels: next },
      });
  };

  return (
    <div className="min-h-full bg-white pb-10">
      <PageHeader title={TITLES[kind]} />
      {options.map((name) => (
        <div key={name} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <span style={{ fontSize: 18 }}>{name}</span>
          <ToggleSwitch checked={selected.includes(name)} onChange={() => toggle(name)} label={name} />
        </div>
      ))}
    </div>
  );
}
