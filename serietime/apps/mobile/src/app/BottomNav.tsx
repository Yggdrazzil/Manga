import { NavLink, useLocation } from 'react-router-dom';
import { Clapperboard, Search, Tv, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const items = [
  { to: '/shows', label: 'Séries', Icon: Tv },
  { to: '/movies', label: 'Films', Icon: Clapperboard },
  { to: '/explore', label: 'Explorer', Icon: Search },
  { to: '/profile', label: 'Profil', Icon: User },
];

export function BottomNav() {
  const location = useLocation();
  // Point rouge Explorer si nouvelles recommandations (spec §11.1).
  const { data: feed } = useQuery({
    queryKey: ['explore', 'feed'],
    queryFn: () => api.get<{ feed: unknown[] }>('/api/explore/feed'),
    staleTime: 30 * 60_000,
  });
  const hasNewRecommendations = (feed?.feed.length ?? 0) > 0 && location.pathname !== '/explore';

  return (
    <nav
      className="app-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-white"
      style={{ borderTop: '1px solid var(--color-border)' }}
      aria-label="Navigation principale"
    >
      <div className="flex" style={{ height: 72 }}>
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center justify-center gap-1"
            style={({ isActive }) => ({ color: isActive ? '#000' : 'var(--color-text-muted)' })}
          >
            <span className="relative">
              <Icon size={26} strokeWidth={1.8} aria-hidden />
              {to === '/explore' && hasNewRecommendations && (
                <span
                  aria-hidden
                  className="absolute"
                  style={{
                    top: -2,
                    right: -4,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--color-red-dot)',
                  }}
                />
              )}
            </span>
            <span style={{ fontSize: 11.5 }}>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
