import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatShortDateFr } from '@serietime/core';
import { EmptyState, SkeletonBlock } from '@serietime/ui';
import { api } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  date: string;
  isRead: boolean;
};

// Notifications locales (spec §27).
export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ notifications: Notification[] }>('/api/notifications'),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="min-h-full bg-white pb-10">
      <PageHeader title="Notifications" />
      {isLoading && (
        <div className="p-6">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} style={{ height: 72, marginBottom: 12 }} />
          ))}
        </div>
      )}
      {data && data.notifications.length === 0 && (
        <EmptyState title="Aucune notification" message="Les nouveaux épisodes et imports terminés apparaîtront ici." />
      )}
      {data?.notifications.map((n) => (
        <button
          key={n.id}
          onClick={() => !n.isRead && markRead.mutate(n.id)}
          className="flex w-full items-center gap-4 px-6 py-4 text-left"
          style={{ borderBottom: '1px solid var(--color-border-light)', opacity: n.isRead ? 0.6 : 1 }}
        >
          <span className="shrink-0 overflow-hidden" style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-chip-grey)' }}>
            {n.imageUrl && <img src={n.imageUrl} alt="" className="h-full w-full object-cover" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block" style={{ fontSize: 16.5, fontWeight: n.isRead ? 400 : 600 }}>
              {n.title}
            </span>
            {n.body && (
              <span className="block truncate" style={{ fontSize: 14.5, color: 'var(--color-text-muted)' }}>
                {n.body}
              </span>
            )}
            <span className="block" style={{ fontSize: 13, color: 'var(--color-text-soft)' }}>
              {formatShortDateFr(n.date)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
