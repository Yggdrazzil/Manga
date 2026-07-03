import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store.js';
import { popBackHandler } from '../hooks/useBackButton.js';
import { BottomNav } from './BottomNav.js';
import { SetupServerPage } from '../features/setup/SetupServerPage.js';
import { LoginPage } from '../features/setup/LoginPage.js';
import { ShowsPage } from '../features/shows/ShowsPage.js';
import { ShowDetailPage } from '../features/shows/ShowDetailPage.js';
import { PostersPage } from '../features/shows/PostersPage.js';
import { BannersPage } from '../features/shows/BannersPage.js';
import { AddToListPage } from '../features/lists/AddToListPage.js';
import { EpisodeDetailPage } from '../features/episode/EpisodeDetailPage.js';
import { MoviesPage } from '../features/movies/MoviesPage.js';
import { MovieDetailPage } from '../features/movies/MovieDetailPage.js';
import { ExplorePage } from '../features/explore/ExplorePage.js';
import { ProfilePage } from '../features/profile/ProfilePage.js';
import { ProfileEditPage } from '../features/profile/ProfileEditPage.js';
import { ProfileShowsPage } from '../features/profile/ProfileShowsPage.js';
import { ProfileMoviesPage } from '../features/profile/ProfileMoviesPage.js';
import { FavoritesPage } from '../features/profile/FavoritesPage.js';
import { StatsPage } from '../features/profile/StatsPage.js';
import { ListsPage } from '../features/lists/ListsPage.js';
import { ListDetailPage } from '../features/lists/ListDetailPage.js';
import { SettingsPage } from '../features/settings/SettingsPage.js';
import { NotificationsPage } from '../features/settings/NotificationsPage.js';
import { ImportTvtimePage } from '../features/import/ImportTvtimePage.js';
import { ImportDetailPage } from '../features/import/ImportDetailPage.js';
import { ImportUnresolvedPage } from '../features/import/ImportUnresolvedPage.js';
import { BackupPage } from '../features/settings/BackupPage.js';
import { SimpleSettingsListPage } from '../features/settings/SimpleSettingsListPage.js';
import { ExitConfirmDialog } from './ExitConfirmDialog.js';
import { ToastProvider } from '../hooks/useToast.js';

const MAIN_TABS = ['/shows', '/movies', '/explore', '/profile'];

export function App() {
  const { serverUrl, token } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [exitDialog, setExitDialog] = useState(false);

  // Spec §9.3 : bouton retour Android.
  const handleBack = useCallback((): void => {
    if (popBackHandler()) return;
    const path = location.pathname;
    if (!MAIN_TABS.includes(path)) {
      if (window.history.length > 1) navigate(-1);
      else navigate('/shows');
      return;
    }
    if (path !== '/shows') {
      navigate('/shows');
      return;
    }
    setExitDialog(true);
  }, [location.pathname, navigate]);

  useEffect(() => {
    let remove: (() => void) | undefined;
    void (async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const listener = await CapApp.addListener('backButton', () => handleBack());
        remove = () => void listener.remove();
      } catch {
        // hors Capacitor (navigateur) : rien à faire, le navigateur gère l'historique
      }
    })();
    return () => remove?.();
  }, [handleBack]);

  if (!serverUrl && location.pathname !== '/setup-server') {
    return <Navigate to="/setup-server" replace />;
  }
  if (serverUrl && !token && !['/setup-server', '/login'].includes(location.pathname)) {
    return <Navigate to="/login" replace />;
  }

  const showBottomNav = MAIN_TABS.includes(location.pathname);

  return (
    <ToastProvider>
    <div className="min-h-full bg-white">
      <Routes>
        <Route path="/" element={<Navigate to="/shows" replace />} />
        <Route path="/setup-server" element={<SetupServerPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route path="/shows" element={<ShowsPage />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route path="/show/:id" element={<ShowDetailPage />} />
        <Route path="/show/:id/posters" element={<PostersPage />} />
        <Route path="/show/:id/banners" element={<BannersPage />} />
        <Route path="/show/:id/lists" element={<AddToListPage />} />

        <Route path="/episode/:id" element={<EpisodeDetailPage />} />
        <Route path="/movie/:id" element={<MovieDetailPage />} />
        <Route path="/search" element={<ExplorePage searchMode />} />

        <Route path="/lists" element={<ListsPage />} />
        <Route path="/lists/:id" element={<ListDetailPage />} />
        <Route path="/lists/:id/edit" element={<ListDetailPage edit />} />

        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/profile/stats" element={<StatsPage />} />
        <Route path="/profile/shows" element={<ProfileShowsPage />} />
        <Route path="/profile/movies" element={<ProfileMoviesPage />} />
        <Route path="/profile/favorites/shows" element={<FavoritesPage type="show" />} />
        <Route path="/profile/favorites/movies" element={<FavoritesPage type="movie" />} />

        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/import-tvtime" element={<ImportTvtimePage />} />
        <Route path="/settings/import-tvtime/:importId" element={<ImportDetailPage />} />
        <Route path="/settings/import-tvtime/:importId/unresolved" element={<ImportUnresolvedPage />} />
        <Route path="/settings/backup" element={<BackupPage />} />
        <Route path="/settings/notifications" element={<NotificationsPage />} />
        <Route path="/settings/subscriptions" element={<SimpleSettingsListPage kind="subscriptions" />} />
        <Route path="/settings/channels" element={<SimpleSettingsListPage kind="channels" />} />
        <Route path="/settings/disliked" element={<SimpleSettingsListPage kind="disliked" />} />

        <Route path="*" element={<Navigate to="/shows" replace />} />
      </Routes>
      {showBottomNav && <BottomNav />}
      <ExitConfirmDialog open={exitDialog} onClose={() => setExitDialog(false)} />
    </div>
    </ToastProvider>
  );
}
