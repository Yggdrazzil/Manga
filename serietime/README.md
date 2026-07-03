# SerieTime

Application personnelle de suivi de séries, animés et films — pensée pour remplacer TV Time
après la fermeture du service. Interface mobile fidèle aux captures TV Time, **installable en PWA
Android** et **buildable en APK via Capacitor**, adossée à un **serveur personnel
Node/Fastify/Prisma/SQLite**.

> Usage strictement personnel. Aucune fonctionnalité sociale (pas d'amis, d'abonnés, de profils
> publics ni de commentaires publics). Aucun asset propriétaire TV Time n'est réutilisé.

## Architecture

Monorepo pnpm :

```txt
serietime/
  apps/
    mobile/    React + Vite + TypeScript + Tailwind, PWA + Capacitor Android
    server/    Node + Fastify + Prisma + SQLite, API REST /api
  packages/
    core/      logique métier pure (parsing import, matching, stats, dates) + tests
    ui/        composants UI réutilisables
    types/     types TypeScript partagés
  docs/        SPEC, plan, guides Android / import / API, captures de référence
```

Le **serveur est la source de vérité** (base SQLite). Le mobile appelle l'API et conserve un cache
local (TanStack Query + Service Worker) pour un usage hors-ligne partiel.

## Prérequis

- Node.js ≥ 20
- pnpm ≥ 10 (`corepack enable`)
- Pour l'APK : Android Studio + JDK 17

## Installation serveur

```bash
pnpm install
cp .env.example .env            # renseigner TMDB_API_KEY pour les métadonnées
pnpm db:migrate                 # crée la base SQLite et applique les migrations
pnpm dev:server                 # démarre l'API sur http://localhost:4000
```

Vérifier : `curl http://localhost:4000/health` → `{"ok":true,"app":"SerieTime","version":"1.0.0"}`.

Au premier lancement, aucun compte n'existe : l'app mobile propose alors de **créer le compte
local** (nom d'affichage + mot de passe, e-mail optionnel).

### Configuration TMDb (recommandé)

Les titres, synopsis, affiches, castings et « où regarder » viennent de **TMDb**. Sans clé,
l'app fonctionne mais affiche des posters vides et ne peut pas enrichir la recherche externe.
Renseignez `TMDB_API_KEY` (ou `TMDB_READ_ACCESS_TOKEN`) dans `.env`. **TVmaze** sert de fallback
séries (épisodes, calendrier) et ne nécessite pas de clé.

### Configuration optionnelle TheTVDB

Désactivé par défaut. Activez-le (`TVDB_ENABLED=true`, `TVDB_API_KEY`, `TVDB_PIN`) uniquement si
vos exports TV Time contiennent des identifiants TheTVDB et que le matching TMDb échoue.

Les clés API restent **exclusivement côté serveur** — jamais exposées au mobile.

## Installation mobile (développement)

```bash
pnpm dev:mobile                 # http://localhost:5173
```

Au premier lancement l'app demande l'**URL du serveur**, teste `GET /health`, puis propose la
connexion / création de compte.

## Import ZIP TV Time

Depuis **Paramètres → Compte → Importer mes données TV Time**, sélectionnez votre archive `.zip`.
L'import est robuste, tolérant et vérifiable — voir [docs/IMPORT_TVTIME.md](docs/IMPORT_TVTIME.md).

## Build PWA

```bash
pnpm --filter @serietime/mobile build
```

Le dossier `apps/mobile/dist` contient la PWA (manifest, service worker, icônes). Servez-le en
HTTPS et ouvrez-le dans Chrome Android : « Ajouter à l'écran d'accueil » installe SerieTime en mode
standalone.

## Build APK Android

Voir [docs/README_ANDROID.md](docs/README_ANDROID.md). En résumé :

```bash
cd apps/mobile
pnpm build
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

## Docker (serveur)

```bash
cp .env.example .env
docker compose up -d            # API sur le port 4000, base persistée dans apps/server/data
```

## Sauvegarde et restauration

- **Paramètres → Sauvegarde locale → Exporter** : télécharge un JSON de toutes vos données
  (séries, épisodes vus, films, listes, favoris, historique).
- **Restaurer une sauvegarde** : réimporte ce JSON. La restauration est tolérante (les lignes
  corrompues sont ignorées sans interrompre le processus).

## Tests

```bash
pnpm test                       # unitaires (core) + intégration (API serveur)
```

- `packages/core` : normalisation titres, extraction d'IDs, parsers CSV/JSON, score de matching,
  épisode suivant, progression, stats de temps, groupes par date.
- `apps/server` : import ZIP de bout en bout, résolution de mapping, marquage vu/non-vu, favoris,
  listes, affiche/bannière, export de sauvegarde.

## Limitations

- L'enrichissement des métadonnées (posters, castings, providers) nécessite une clé TMDb.
- Hors-ligne : consultation des écrans déjà chargés et mutations en file d'attente (marquage
  vu/non-vu, favoris, ajout à une liste). La recherche externe et l'import ZIP exigent le réseau.
- Application mono-utilisateur par serveur (usage personnel).

## Documentation

- [docs/SPEC_SERIETIME.md](docs/SPEC_SERIETIME.md) — cahier des charges complet
- [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) — arborescence, Prisma, routes, phases
- [docs/README_ANDROID.md](docs/README_ANDROID.md) — PWA & APK Android
- [docs/IMPORT_TVTIME.md](docs/IMPORT_TVTIME.md) — pipeline d'import
- [docs/API.md](docs/API.md) — référence de l'API REST
