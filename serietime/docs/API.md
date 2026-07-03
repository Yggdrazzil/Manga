# API SerieTime

API REST servie par Fastify. Toutes les routes applicatives sont préfixées par `/api` (sauf
`GET /health`). L'authentification se fait par **token Bearer** (session en base, hash bcrypt) ;
toutes les routes `/api/*` l'exigent sauf `auth/needs-setup`, `auth/setup` et `auth/login`.

## Santé

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | `{ ok, app: "SerieTime", version }` |

## Auth

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/auth/needs-setup` | `true` si aucun compte n'existe encore |
| POST | `/api/auth/setup` | Crée le compte local (`displayName`, `password`, `email?`) → token |
| POST | `/api/auth/login` | Connexion (`password`) → token |
| POST | `/api/auth/logout` | Invalide la session |
| GET | `/api/auth/me` | Utilisateur courant |
| POST | `/api/auth/password` | Change le mot de passe (`currentPassword`, `newPassword`) |

## Import TV Time

Voir [IMPORT_TVTIME.md](IMPORT_TVTIME.md) pour le détail.

```txt
POST /api/import/tvtime/upload
POST /api/import/tvtime/:id/analyze
POST /api/import/tvtime/:id/confirm
GET  /api/import/tvtime            (historique)
GET  /api/import/tvtime/:id
GET  /api/import/tvtime/:id/unresolved
POST /api/import/tvtime/:id/resolve
POST /api/import/tvtime/:id/ignore
GET  /api/import/tvtime/:id/report
```

## Séries

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/shows` | Séries suivies |
| GET | `/api/shows/queue` | File « À voir » groupée (à voir, pas regardé depuis un moment, pas commencé, abandonné) |
| GET | `/api/shows/upcoming` | Épisodes à venir groupés par date |
| GET | `/api/shows/profile` | Profil > Séries groupées par statut (`?hidden=true` inclut les masquées) |
| GET | `/api/shows/:id` | Fiche série (média, providers, cast, trailer, recommandations) |
| GET | `/api/shows/:id/episodes` | Saisons + épisodes + progression + épisode suivant |
| GET | `/api/shows/:id/images` | Affiches et bannières disponibles |
| POST | `/api/shows/:id/status` | Change le statut (`watching`/`completed`/`watchlist`/`paused`/`abandoned`/`not_started`) |
| POST | `/api/shows/:id/favorite` | Bascule favori |
| POST | `/api/shows/:id/watchlater` | Regarder plus tard |
| POST | `/api/shows/:id/abandon` | Abandonner |
| POST | `/api/shows/:id/poster` | Change l'affiche (`posterPath`) |
| POST | `/api/shows/:id/banner` | Change la bannière (`backdropPath`) |
| POST | `/api/shows/:id/mark-all-watched` | Marque tout vu (`seasonNumber?` pour une saison) |
| DELETE | `/api/shows/:id/tracking` | Retire la série du suivi (média global conservé) |
| POST | `/api/shows/add-from-tmdb` | Ajoute une série depuis un id TMDb |

## Épisodes

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/episodes/:id` | Fiche épisode |
| POST | `/api/episodes/:id/watched` | Marque vu (`watchedAt?`) |
| POST | `/api/episodes/:id/unwatched` | Marque non vu |
| POST | `/api/episodes/:id/rating` | Note (`rating` 0–10 ou `null`) |
| POST | `/api/episodes/:id/date` | Modifie la date de visionnage |

## Films

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/movies` | À voir + à venir |
| GET | `/api/movies/profile` | VU / PAS VU (`?sort=`, `?filter=`, `?hidden=`) |
| GET | `/api/movies/:id` | Fiche film |
| POST | `/api/movies/:id/watched` | Marque vu |
| POST | `/api/movies/:id/unwatched` | Marque non vu |
| POST | `/api/movies/:id/favorite` | Bascule favori |
| POST | `/api/movies/:id/watchlist` | Ajoute à la watchlist |
| POST | `/api/movies/add-from-tmdb` | Ajoute un film depuis un id TMDb |

## Recherche & Explorer

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/search?q=&type=` | `type` = `media` / `lists` / `people` (local + TMDb) |
| GET | `/api/explore/feed` | Flux personnel de recommandations |
| GET | `/api/explore/discover` | Séries et films tendance |
| GET | `/api/recommendations` | Alias du flux |
| GET | `/api/disliked` / POST `/api/disliked/:mediaId` | Contenus masqués |

## Profil, listes, paramètres

| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/api/profile` | Profil complet / mise à jour |
| GET | `/api/profile/stats` | Statistiques (temps, épisodes, films, notes) |
| GET | `/api/profile/favorites` | Favoris (`?type=show\|movie`) |
| GET/POST | `/api/lists` | Liste / création |
| GET/PUT/DELETE | `/api/lists/:id` | Détail / renommage / suppression |
| POST/DELETE | `/api/lists/:id/items[/:mediaId]` | Ajout / retrait d'un média |
| POST | `/api/lists/:id/reorder` | Réordonne (`mediaIds`) |
| GET/POST | `/api/settings` | Paramètres |
| POST | `/api/cache/clear` | Vide le cache API serveur |
| POST | `/api/backup/export` \| `/api/backup/import` | Export / restauration JSON |
| GET | `/api/notifications` / POST `/api/notifications/:id/read` | Notifications locales |

## Sources externes & cache

TMDb (métadonnées, providers, castings, recommandations) et TVmaze (fallback épisodes/calendrier)
sont appelés **via un cache serveur** `ApiCache` avec des durées de fraîcheur adaptées (série en
cours 3 j, terminée 90 j, film 180 j, providers 7 j, épisodes futurs 1 j). Les clés API ne sont
jamais exposées au mobile.
