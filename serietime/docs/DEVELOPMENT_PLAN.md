# SerieTime — Plan de développement (Phase 0)

Ce document répond à la Phase 0 de `SPEC_SERIETIME.md` : arborescence finale, schéma Prisma,
routes API, composants UI et plan d'implémentation en phases.

---

## 1. Arborescence finale

```txt
serietime/
  apps/
    mobile/                      # React + Vite + TypeScript + Tailwind, PWA + Capacitor
      src/
        app/                     # AppShell, providers (QueryClient, router), bouton retour Android
        components/              # composants écran-spécifiques
        features/
          shows/                 # À voir / À venir, fiche série, saisons, épisodes
          movies/                # grille films, fiche film
          explore/               # flux, découvrir, recherche
          profile/               # profil, stats, édition, favoris
          lists/                 # listes, ajout à une liste
          settings/              # paramètres (compte / application / à venir), notifications
          import/                # import TV Time (upload, analyse, rapport, résolution)
          setup/                 # setup serveur + login
        hooks/                   # useBackButton, useBottomSheet, useServerUrl…
        lib/                     # client API, auth store (zustand), query client, offline queue
        routes/                  # définition react-router
        styles/                  # tokens CSS (couleurs, radius, ombres), global.css
      public/
        icons/                   # icon-192, icon-512, icon-maskable-512 (générées, pas d'assets TV Time)
        screenshots/
        manifest.webmanifest
      android/                   # généré par `npx cap add android` (non commité sauf config)
      capacitor.config.ts
      vite.config.ts
      package.json

    server/                      # Node + Fastify + Prisma + SQLite
      src/
        index.ts                 # bootstrap
        app.ts                   # buildApp() Fastify (testable)
        config/                  # env parsing (zod)
        db/                      # client Prisma singleton
        modules/
          auth/                  # setup/login/logout/me, sessions
          import-tvtime/         # upload, analyse ZIP, matching, confirm, unresolved, resolve
          media/                 # helpers média communs
          shows/                 # queue, upcoming, profile, détail, statuts
          episodes/              # watched/unwatched/rating/date
          movies/                # liste, watched, favorite, watchlist
          search/                # recherche locale + TMDb
          explore/               # feed, discover, recommendations
          profile/               # profil + stats + favoris
          lists/                 # CRUD listes + items + reorder
          settings/              # settings, cache clear, notifications
          backup/                # export / import JSON
        services/
          tmdb/                  # client TMDb + cache ApiCache
          tvmaze/                # fallback épisodes/calendrier
          tvdb/                  # optionnel, désactivé par défaut
        utils/
      prisma/
        schema.prisma
        migrations/
      data/
        imports/                 # {importId}/original.zip, parsed-files.json, import-report.json
      package.json

  packages/
    core/                        # logique métier pure, sans I/O — testée unitairement
      src/
        importers/               # détection fichiers ZIP, parsers CSV/JSON tolérants, normalisation
        matching/                # scoring, priorités ID > titre+année > titre
        stats/                   # temps de visionnage, compteurs, progression
        media/                   # detectMediaType, épisode suivant, groupes par statut/date
        dates/                   # formatage FR, groupes AUJOURD'HUI/DEMAIN/…
        utils/
    ui/
      src/
        components/              # composants réutilisables purs (voir §4)
        tokens/                  # design tokens (couleurs, radius, ombres, typo)
    types/
      src/                       # types partagés API/serveur/mobile (DTOs zod)

  docs/
    SPEC_SERIETIME.md
    DEVELOPMENT_PLAN.md
    README_ANDROID.md
    IMPORT_TVTIME.md
    API.md
    screenshots/reference/       # 41 captures de référence

  .env.example
  docker-compose.yml
  Dockerfile.server
  pnpm-workspace.yaml
  package.json
  README.md
```

## 2. Schéma Prisma

Le schéma suit §13 de la spec, corrigé pour que toutes les relations soient bidirectionnelles
(exigence Prisma) sans supprimer de domaine métier :

- `User` ⇄ `UserMediaStatus`, `UserEpisodeStatus`, `WatchEvent`, `MediaList`, `Notification`, `Rating`
- `Media` (type `show|movie`) ⇄ `Show`/`Movie` (1-1), `UserMediaStatus`, `WatchEvent`, `Rating`,
  `ListItem`, `Provider`, `Credit`, `ImportMapping`
- `Show` ⇄ `Season` ⇄ `Episode` (unique `[showId, seasonNumber, episodeNumber]`)
- `Rating` ajouté explicitement (référencé par la spec dans Media/Episode) : note utilisateur
  sur média ou épisode
- `Import` ⇄ `ImportMapping` (statuts `matched_auto|matched_manual|unresolved|ignored`)
- `AppSetting`, `ApiCache` pour paramètres et cache API externes
- SQLite ne supporte pas les enums natifs ni `Json` ⇒ enums Prisma conservés (Prisma les émule)
  et champs `*Json` en `String` sérialisé (choix documenté dans le schéma)

Le schéma complet est dans `apps/server/prisma/schema.prisma`.

## 3. Routes API

Préfixe `/api` (sauf `GET /health`).

| Domaine | Routes |
|---|---|
| Health | `GET /health` |
| Auth | `POST /api/auth/setup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Import | `POST /api/import/tvtime/upload`, `POST /api/import/tvtime/:id/analyze`, `POST /api/import/tvtime/:id/confirm`, `GET /api/import/tvtime/:id`, `GET /api/import/tvtime/:id/unresolved`, `POST /api/import/tvtime/:id/resolve`, `POST /api/import/tvtime/:id/ignore`, `GET /api/import/tvtime/:id/report` |
| Shows | `GET /api/shows`, `GET /api/shows/queue`, `GET /api/shows/upcoming`, `GET /api/shows/profile`, `GET /api/shows/:id`, `GET /api/shows/:id/episodes`, `POST /api/shows/:id/status`, `POST /api/shows/:id/favorite`, `POST /api/shows/:id/watchlater`, `POST /api/shows/:id/abandon`, `POST /api/shows/:id/poster`, `POST /api/shows/:id/banner`, `POST /api/shows/:id/mark-all-watched`, `DELETE /api/shows/:id/tracking` |
| Episodes | `GET /api/episodes/:id`, `POST /api/episodes/:id/watched`, `POST /api/episodes/:id/unwatched`, `POST /api/episodes/:id/rating`, `POST /api/episodes/:id/date` |
| Movies | `GET /api/movies`, `GET /api/movies/profile`, `GET /api/movies/:id`, `POST /api/movies/:id/watched`, `POST /api/movies/:id/unwatched`, `POST /api/movies/:id/favorite`, `POST /api/movies/:id/watchlist` |
| Search/Explore | `GET /api/search?q=&type=`, `GET /api/explore/feed`, `GET /api/explore/discover`, `GET /api/recommendations` |
| Profile | `GET /api/profile`, `POST /api/profile`, `GET /api/profile/stats`, `GET /api/profile/favorites` |
| Lists | `GET /api/lists`, `POST /api/lists`, `GET /api/lists/:id`, `PUT /api/lists/:id`, `DELETE /api/lists/:id`, `POST /api/lists/:id/items`, `DELETE /api/lists/:id/items/:mediaId`, `POST /api/lists/:id/reorder` |
| Settings | `GET /api/settings`, `POST /api/settings`, `POST /api/cache/clear`, `POST /api/backup/export`, `POST /api/backup/import`, `GET /api/notifications`, `POST /api/notifications/:id/read` |

Auth : token Bearer opaque (session en base), hash bcrypt. Toutes les routes `/api/*` sauf
`auth/setup`, `auth/login` exigent le token.

## 4. Composants UI

Liste §34 de la spec, répartie ainsi :

**packages/ui (purs, réutilisables)** : `TopTabs`, `PillHeader`, `GridToggleButton`,
`PosterGrid`, `PosterTile`, `FloatingFilterButton`, `ToggleSwitch`, `RadioOption`,
`ActionSheet`, `BottomSheet`, `EmptyState`, `SkeletonBlock`, `Toast`, `CheckCircle`,
`ShowPill`, `Badge`.

**apps/mobile (écrans/features)** : `AppShell`, `BottomNav`, `EpisodeQueueCard`,
`UpcomingEpisodeCard`, `FilterBottomSheet`, `ExploreSearchHeader`, `ExploreTabs`,
`ExploreHeroCard`, `ProfileHeader`, `ProfileStatsStrip`, `StatsCarouselCard`,
`PosterRowSection`, `ListCoverCard`, `SettingsTabs`, `SettingsSection`, `SettingsRow`,
`SeriesHeroHeader`, `SeriesTabs`, `ProviderButton`, `InterestQuestionnaire`, `CastCarousel`,
`SeasonAccordion`, `EpisodeRow`, `EpisodeDetailModal`, `PosterSelectionGrid`,
`BannerSelectionList`, `ImportDropzone`, `ImportAnalysisReport`, `UnresolvedMappingTable`.

## 5. Plan d'implémentation en phases

1. **Phase 1 — Monorepo** : workspace pnpm, packages, tsconfig, lint.
2. **Phase 2 — Serveur socle** : Fastify, config env zod, Prisma+SQLite, `/health`, auth locale.
3. **Phase 3 — Modèle de données** : schéma Prisma complet, migration initiale, seed minimal.
4. **Phase 4 — Import TV Time** : upload ZIP (limite 100 Mo, SHA-256, anti Zip Slip),
   détection tolérante des fichiers (CSV/JSON), normalisation, matching scoré,
   rapport, confirm, résolution manuelle. Tests unitaires sur parsers/matching.
5. **Phase 5 — Mobile shell** : Vite, Tailwind (tokens spec §10), routes, bottom nav,
   PWA (manifest + service worker), Capacitor config, safe areas, bouton retour Android.
6. **Phase 6 — Écrans principaux** : Séries (À voir/À venir, liste + grille), Films,
   Explorer (flux/recherche), Profil (header, stats, sections).
7. **Phase 7 — Fiches** : fiche série (À propos/Épisodes), fiche épisode (modal),
   menus trois points, personnaliser affiche/bannière, listes.
8. **Phase 8 — Settings** : paramètres 3 onglets, édition profil, notifications,
   écran import TV Time, backup.
9. **Phase 9 — Offline** : persistance TanStack Query, cache SW images/API, queue de
   mutations offline rejouée à la reconnexion.
10. **Phase 10 — Tests & polish** : tests unitaires core, tests d'intégration import/API,
    build APK documenté, README complets.
