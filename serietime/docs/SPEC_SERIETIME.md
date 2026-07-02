# Cahier des charges ultra détaillé — SerieTime

> Fichier destiné à être donné à Claude Code.  
> Instruction recommandée : **Lis intégralement ce fichier avant de coder. Ne commence aucune implémentation tant que tu n’as pas proposé le plan de fichiers, les modèles de données, les routes et l’ordre d’exécution. Respecte la spec sans improviser.**

---

## 1. Vision produit

Créer **SerieTime**, une application personnelle de suivi de séries, animés et films, utilisable sur téléphone Android, en particulier sur **Oppo Find X**, et inspirée quasi pixel-perfect de l’expérience TV Time observée dans les captures fournies.

L’application doit permettre de remplacer TV Time pour un usage personnel après fermeture du service.

SerieTime doit permettre :

- d’importer un fichier `.zip` d’export TV Time ;
- de récupérer tout l’historique de visionnage ;
- de récupérer les séries suivies ;
- de récupérer les épisodes vus ;
- de récupérer les films vus ;
- de récupérer les watchlists ;
- de récupérer les favoris ;
- de récupérer les listes personnelles ;
- de récupérer les notes si présentes ;
- de récupérer les dates de visionnage si présentes ;
- de suivre les épisodes à voir ;
- de voir les épisodes à venir ;
- de consulter une fiche série ;
- de consulter une fiche épisode ;
- de consulter les films vus et non vus ;
- de rechercher séries et films ;
- de découvrir des contenus ;
- de gérer le profil local ;
- de gérer des listes ;
- de gérer les paramètres ;
- d’avoir une interface mobile très proche des captures ;
- d’être installable sur Android comme une app ;
- d’être également générable en APK Android via Capacitor.

L’app est destinée à un usage **strictement personnel**. Il ne faut pas créer de réseau social, pas de profils publics, pas de commentaires publics, pas d’amis, pas d’abonnés, pas de groupes sociaux.

Le nom visible de l’app doit être :

```txt
SerieTime
```

Toute mention éventuelle de TV Time doit être remplacée par :

```txt
SerieTime
```

---

## 2. Objectif UX/UI

### 2.1 Niveau de fidélité attendu

L’objectif est une reproduction **quasi pixel-perfect** des écrans fournis par l’utilisateur.

Claude Code doit se baser sur les captures comme référence prioritaire pour :

- les structures d’écrans ;
- les menus ;
- les onglets ;
- les espacements ;
- les marges ;
- les tailles de texte ;
- les cartes ;
- les grilles ;
- les boutons ;
- les bottom sheets ;
- les overlays ;
- les headers ;
- les comportements au scroll ;
- les interactions tactiles ;
- la bottom navigation ;
- les états vides ;
- les couleurs dominantes ;
- les badges ;
- les boutons jaunes ;
- les onglets soulignés ;
- les fiches séries ;
- les fiches épisodes ;
- les paramètres ;
- le profil.

Il ne faut pas “moderniser” l’interface.  
Il ne faut pas proposer une autre direction artistique.  
Il ne faut pas transformer l’app en dashboard SaaS.  
Il faut reproduire le style simple, blanc, noir, jaune, mobile-first, avec cartes, posters, gros titres et navigation basse.

### 2.2 Ce qu’il est interdit de copier

Ne pas réutiliser :

- le nom TV Time ;
- le logo TV Time ;
- une icône propriétaire TV Time ;
- des assets propriétaires internes à TV Time ;
- des textes légaux TV Time ;
- des fonctionnalités sociales publiques TV Time.

Les images de films/séries doivent venir des APIs de métadonnées ou des données importées, pas d’un scraping TV Time.

---

## 3. Cibles de livraison

SerieTime doit être livrée sous deux formes.

### 3.1 PWA Android installable

L’utilisateur doit pouvoir ouvrir SerieTime dans Chrome Android sur son Oppo Find X, puis l’installer sur l’écran d’accueil.

La PWA doit :

- avoir une icône Android ;
- s’ouvrir en mode standalone ;
- ne pas afficher la barre navigateur ;
- respecter les safe areas Android ;
- supporter le bouton retour Android ;
- permettre l’import d’un fichier `.zip` ;
- fonctionner partiellement hors ligne ;
- conserver un cache local des écrans déjà consultés.

### 3.2 APK Android via Capacitor

L’utilisateur doit aussi pouvoir générer et installer un fichier :

```txt
SerieTime.apk
```

L’APK doit :

- afficher le nom `SerieTime` ;
- utiliser le package Android `com.serietime.app` ;
- avoir une icône adaptive Android ;
- pouvoir se connecter au serveur personnel SerieTime ;
- permettre l’import ZIP via file picker Android ;
- gérer le bouton retour Android ;
- gérer les bottom sheets ;
- gérer les modales ;
- respecter les safe areas ;
- fonctionner sur Oppo / Android / ColorOS.

---

## 4. Architecture technique imposée

### 4.1 Pourquoi séparer mobile et serveur

Ne pas faire une simple app Next.js monolithique avec API routes si l’objectif est aussi un APK Android.

Pour Capacitor, l’app mobile doit être une app web statique embarquée, qui communique avec un backend séparé.

Architecture imposée :

```txt
serietime/
  apps/
    mobile/
      React + Vite + TypeScript + Tailwind
      PWA
      Capacitor Android
    server/
      Node.js + Fastify ou Express
      Prisma
      SQLite
      API REST
  packages/
    core/
      logique métier partagée
      parsing
      matching
      stats
      calculs épisodes
    ui/
      composants UI réutilisables
    types/
      types TypeScript partagés
  docs/
    SPEC_SERIETIME.md
    screenshots/
      reference/
```

### 4.2 Stack mobile

Utiliser :

```txt
React
Vite
TypeScript
Tailwind CSS
TanStack Query
Zustand
React Hook Form
Zod
Framer Motion
Lucide React
Capacitor
Workbox ou Vite PWA
```

### 4.3 Stack serveur

Utiliser :

```txt
Node.js
TypeScript
Fastify de préférence
Prisma ORM
SQLite
Zod
JWT ou session token
Multer ou busboy pour upload ZIP
adm-zip / yauzl / unzipper pour ZIP
csv-parse pour CSV
```

Fastify est préféré pour garder une API propre et rapide.

### 4.4 Package manager

Utiliser :

```txt
pnpm
```

Créer :

```txt
pnpm-workspace.yaml
package.json racine
turbo.json optionnel
```

Ne pas ajouter Turborepo si cela complexifie inutilement.

---

## 5. Structure exacte du projet

Créer cette structure minimale :

```txt
serietime/
  apps/
    mobile/
      src/
        app/
        components/
        features/
        hooks/
        lib/
        routes/
        styles/
      public/
        icons/
        screenshots/
        manifest.webmanifest
      android/
      capacitor.config.ts
      vite.config.ts
      package.json

    server/
      src/
        index.ts
        app.ts
        config/
        db/
        modules/
          auth/
          import-tvtime/
          media/
          shows/
          episodes/
          movies/
          search/
          profile/
          lists/
          settings/
          stats/
          providers/
          sync/
          backup/
        services/
          tmdb/
          tvmaze/
          tvdb/
        utils/
      prisma/
        schema.prisma
        migrations/
      data/
        imports/
      package.json

  packages/
    core/
      src/
        importers/
        matching/
        stats/
        media/
        dates/
        utils/
    ui/
      src/
        components/
        tokens/
    types/
      src/

  docs/
    SPEC_SERIETIME.md
    README_ANDROID.md
    screenshots/
      reference/

  .env.example
  docker-compose.yml
  Dockerfile.server
  README.md
```

---

## 6. Fonctionnement global serveur/mobile

### 6.1 Principe

Le serveur est la source de vérité.

Le mobile affiche les données en appelant l’API serveur.

La base SQLite est côté serveur.

Le mobile garde un cache local pour accélérer l’affichage et permettre un usage hors-ligne partiel.

### 6.2 Premier lancement mobile

Au premier lancement de l’app mobile ou APK :

Écran :

```txt
SerieTime

Connectez votre application à votre serveur personnel.

URL du serveur
[ https://... ]

[TESTER LA CONNEXION]

[CONTINUER]
```

Comportement :

- l’utilisateur saisit l’URL du serveur ;
- l’app appelle `GET /health` ;
- si OK, elle sauvegarde l’URL ;
- sinon elle affiche une erreur claire ;
- l’utilisateur ne peut pas continuer si le serveur est inaccessible.

États d’erreur :

```txt
Serveur inaccessible
Certificat HTTPS invalide
Version serveur incompatible
Réponse serveur invalide
```

### 6.3 Authentification

Comme l’app est personnelle, prévoir une authentification simple.

#### Serveur

Au premier démarrage :

- si aucun utilisateur n’existe, créer un compte local ;
- l’utilisateur définit :
  - nom d’affichage ;
  - mot de passe ;
  - optionnellement e-mail.

Connexion :

```txt
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
```

Stockage :

- mot de passe hashé avec Argon2 ou bcrypt ;
- token session côté mobile ;
- aucune clé API externe exposée côté mobile.

#### Mobile

L’app mobile stocke :

- URL serveur ;
- token de session ;
- préférences locales.

Ne jamais stocker :

- clé TMDb ;
- clé TheTVDB ;
- secrets serveur.

---

## 7. Variables d’environnement

### 7.1 Serveur

Créer `.env.example` à la racine et dans `apps/server`.

```env
NODE_ENV=development
PORT=4000

DATABASE_URL="file:./data/serietime.sqlite"

APP_NAME="SerieTime"
APP_URL="https://serietime.mondomaine.fr"
APP_SECRET="change-me"

JWT_SECRET="change-me"
SESSION_DURATION_DAYS=30

TMDB_API_KEY=""
TMDB_READ_ACCESS_TOKEN=""

TVMAZE_ENABLED=true

TVDB_ENABLED=false
TVDB_API_KEY=""
TVDB_PIN=""

DEFAULT_LANGUAGE="fr-FR"
DEFAULT_COUNTRY="FR"
DEFAULT_TIMEZONE="Europe/Paris"

MAX_IMPORT_ZIP_SIZE_MB=100

CORS_ALLOWED_ORIGINS="http://localhost:5173,capacitor://localhost,https://serietime.mondomaine.fr"
```

### 7.2 Mobile

```env
VITE_APP_NAME="SerieTime"
VITE_DEFAULT_SERVER_URL="http://localhost:4000"
VITE_ENABLE_CAPACITOR=true
```

---

## 8. PWA Android

### 8.1 Manifest

Créer :

```txt
apps/mobile/public/manifest.webmanifest
```

Contenu :

```json
{
  "id": "/",
  "name": "SerieTime",
  "short_name": "SerieTime",
  "description": "Suivi personnel de séries, animés et films",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FFFFFF",
  "theme_color": "#FFFFFF",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/home-mobile.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### 8.2 Service worker

Mettre en place :

- cache de l’app shell ;
- cache des images déjà vues ;
- cache des appels API principaux ;
- fallback offline simple.

Disponible hors ligne :

```txt
Accueil déjà chargé
Séries déjà chargées
Films déjà chargés
Profil
Stats
Listes
Fiches séries déjà consultées
Fiches épisodes déjà consultées
```

Non disponible hors ligne :

```txt
Recherche externe
Refresh metadata
Import ZIP
Providers streaming actualisés
```

---

## 9. Capacitor Android

### 9.1 Configuration

Dans `apps/mobile` :

```bash
pnpm add @capacitor/core @capacitor/cli @capacitor/android
npx cap init SerieTime com.serietime.app
npx cap add android
```

Créer :

```txt
apps/mobile/capacitor.config.ts
```

Configuration :

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.serietime.app',
  appName: 'SerieTime',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

### 9.2 Commandes Android attendues

Dans le README :

```bash
cd apps/mobile
pnpm build
npx cap sync android
npx cap open android
```

Build APK :

```bash
cd apps/mobile/android
./gradlew assembleDebug
```

Livrable :

```txt
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### 9.3 Bouton retour Android

Comportement obligatoire :

```txt
Si bottom sheet ouverte -> fermer bottom sheet
Sinon si action sheet ouverte -> fermer action sheet
Sinon si modal ouverte -> fermer modal
Sinon si page détail -> retour à la page précédente
Sinon si onglet principal autre que Séries -> revenir à Séries
Sinon si onglet Séries -> demander confirmation avant quitter
```

Message confirmation :

```txt
Quitter SerieTime ?
[ANNULER] [QUITTER]
```

### 9.4 Safe areas Android

CSS obligatoire :

```css
html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
}

.app-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}

.page-with-bottom-nav {
  padding-bottom: calc(72px + env(safe-area-inset-bottom));
}

.floating-filter-button {
  bottom: calc(88px + env(safe-area-inset-bottom));
}

.bottom-sheet {
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## 10. Design system

### 10.1 Couleurs

```css
:root {
  --color-background: #FFFFFF;
  --color-page-muted: #F2F2F2;
  --color-surface: #FFFFFF;

  --color-text: #000000;
  --color-text-muted: #808080;
  --color-text-soft: #A0A0A0;

  --color-border: #D6D6D6;
  --color-border-light: #E8E8E8;

  --color-primary-yellow: #FFD400;
  --color-primary-yellow-soft: #FFE873;

  --color-black: #000000;
  --color-white: #FFFFFF;

  --color-pill-grey: #858585;
  --color-chip-grey: #EFEFEF;
  --color-chip-selected-grey: #CFCFCF;

  --color-blue-link: #0075D9;
  --color-red-dot: #C7222A;
  --color-success-green: #62D600;

  --overlay-dark: rgba(0, 0, 0, 0.58);
}
```

### 10.2 Typographie

Police système :

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
```

Tailles :

```txt
Screen title: 20px, 700
Top tabs: 17-18px, 800, uppercase, letter-spacing 0.04em
Section title: 24-28px, 800
Profile name: 28-30px, 800
Episode code card: 25-28px, 800
Episode title card: 18-21px, 400/500
Settings row: 20-22px, 400
Settings heading: 22-24px, 800
Badge text: 12-13px, 800, uppercase
Bottom nav label: 11-12px, 400
```

### 10.3 Rayons

```css
--radius-card: 5px;
--radius-poster: 3px;
--radius-pill: 999px;
--radius-large-button: 999px;
--radius-bottom-sheet: 5px 5px 0 0;
```

### 10.4 Ombres

Cartes épisodes :

```css
box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
```

Cartes série saisons :

```css
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
```

Bottom sheets :

```css
box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.18);
```

### 10.5 Marges

```txt
Page principale: 0px
Sections: 24px horizontal quand profil/settings
Cartes épisodes: 12px horizontal
Grilles posters: 4px à 6px gap
Header tabs: 58px hauteur
Bottom nav: 72px + safe area
```

---

## 11. Navigation globale

### 11.1 Bottom nav

Visible sur :

```txt
Séries
Films
Explorer
Profil
```

Non visible sur :

```txt
Fiche série
Fiche épisode
Paramètres
Édition profil
Listes détail
Modifier affiche
Changer bannière
Import TV Time
```

Style :

- fond blanc ;
- bordure top `1px #D6D6D6` ;
- icônes outline ;
- tab actif noir ;
- tabs inactifs gris ;
- label sous icône ;
- hauteur `72px + safe-area`.

Items :

```txt
Séries : icône TV
Films : icône clap
Explorer : icône loupe
Profil : icône utilisateur
```

Si nouvelle recommandation/exploration :

- petit point rouge sur Explorer ;
- position haut droit de l’icône.

---

## 12. Routes

Routes mobile :

```txt
/
/setup-server
/login

/shows
/movies
/explore
/profile

/show/:id
/show/:id/posters
/show/:id/banners
/show/:id/lists

/episode/:id

/movie/:id

/search

/lists
/lists/:id
/lists/:id/edit

/profile/edit
/profile/stats
/profile/shows
/profile/movies
/profile/favorites/shows
/profile/favorites/movies

/settings
/settings/import-tvtime
/settings/import-tvtime/:importId
/settings/import-tvtime/:importId/unresolved
/settings/backup
/settings/notifications
/settings/subscriptions
/settings/channels
/settings/disliked
```

---

## 13. Modèle de données Prisma

### 13.1 User

```prisma
model User {
  id           String   @id @default(cuid())
  email        String?
  displayName  String
  avatarUrl    String?
  coverUrl     String?
  birthYear    Int?
  gender       String?
  countryCode  String   @default("FR")
  passwordHash String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  mediaStatuses   UserMediaStatus[]
  episodeStatuses UserEpisodeStatus[]
  watchEvents     WatchEvent[]
  lists           MediaList[]
  notifications   Notification[]
}
```

### 13.2 Media

```prisma
model Media {
  id                String   @id @default(cuid())
  type              MediaType

  title             String
  originalTitle     String?
  localizedTitle    String?
  overview          String?
  localizedOverview String?

  posterPath        String?
  backdropPath      String?

  firstAirDate      DateTime?
  releaseDate       DateTime?
  year              Int?

  status            String?
  originalLanguage  String?
  originCountry     String?

  runtime           Int?
  popularity        Float?
  voteAverage       Float?
  voteCount         Int?

  tmdbId            String?
  tvdbId            String?
  imdbId            String?

  sourcePriority    String?
  lastSyncedAt      DateTime?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  show              Show?
  movie             Movie?
  statuses          UserMediaStatus[]
  watchEvents       WatchEvent[]
  ratings           Rating[]
  listItems         ListItem[]
  providers         Provider[]
  credits           Credit[]

  @@index([type])
  @@index([title])
  @@index([tmdbId])
  @@index([tvdbId])
  @@index([imdbId])
}
```

### 13.3 Enums

```prisma
enum MediaType {
  show
  movie
}

enum UserMediaState {
  watching
  completed
  watchlist
  paused
  abandoned
  not_started
}

enum EpisodeState {
  watched
  unwatched
}

enum WatchEventType {
  watched
  rewatched
  marked_unwatched
  rated
  added_to_watchlist
  removed_from_watchlist
  favorited
  unfavorited
  abandoned
  paused
}

enum ImportStatus {
  uploaded
  analyzed
  imported
  failed
}

enum MatchStatus {
  matched_auto
  matched_manual
  unresolved
  ignored
}
```

### 13.4 Show

```prisma
model Show {
  id                  String   @id @default(cuid())
  mediaId             String   @unique
  media               Media    @relation(fields: [mediaId], references: [id])

  numberOfSeasons     Int?
  numberOfEpisodes    Int?
  inProduction        Boolean?
  network             String?
  platform            String?
  nextEpisodeAirDate  DateTime?
  lastEpisodeAirDate  DateTime?
  airTime             String?
  airDay              String?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  seasons             Season[]
  episodes            Episode[]
}
```

### 13.5 Season

```prisma
model Season {
  id            String   @id @default(cuid())
  showId        String
  show          Show     @relation(fields: [showId], references: [id])

  seasonNumber  Int
  title         String?
  overview      String?
  posterPath    String?
  airDate       DateTime?
  episodeCount  Int?

  tmdbId        String?
  tvdbId        String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  episodes      Episode[]

  @@unique([showId, seasonNumber])
  @@index([showId])
}
```

### 13.6 Episode

```prisma
model Episode {
  id                String   @id @default(cuid())

  showId            String
  show              Show     @relation(fields: [showId], references: [id])

  seasonId          String?
  season            Season?  @relation(fields: [seasonId], references: [id])

  seasonNumber      Int
  episodeNumber     Int
  absoluteNumber    Int?

  title             String
  localizedTitle    String?
  overview          String?
  localizedOverview String?
  stillPath         String?

  airDate           DateTime?
  airTime           String?
  runtime           Int?

  tmdbId            String?
  tvdbId            String?
  imdbId            String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  statuses          UserEpisodeStatus[]
  watchEvents       WatchEvent[]
  ratings           Rating[]

  @@unique([showId, seasonNumber, episodeNumber])
  @@index([showId])
  @@index([seasonId])
  @@index([airDate])
}
```

### 13.7 Movie

```prisma
model Movie {
  id        String   @id @default(cuid())
  mediaId   String   @unique
  media     Media    @relation(fields: [mediaId], references: [id])

  homepage  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 13.8 UserMediaStatus

```prisma
model UserMediaStatus {
  id             String         @id @default(cuid())
  userId         String
  user           User           @relation(fields: [userId], references: [id])

  mediaId        String
  media          Media          @relation(fields: [mediaId], references: [id])

  status         UserMediaState
  isFavorite     Boolean        @default(false)
  isHidden       Boolean        @default(false)
  personalNote   String?
  rating         Float?

  addedAt        DateTime       @default(now())
  startedAt      DateTime?
  completedAt    DateTime?
  lastWatchedAt  DateTime?

  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@unique([userId, mediaId])
  @@index([userId])
  @@index([mediaId])
  @@index([status])
}
```

### 13.9 UserEpisodeStatus

```prisma
model UserEpisodeStatus {
  id           String       @id @default(cuid())
  userId       String
  user         User         @relation(fields: [userId], references: [id])

  episodeId    String
  episode      Episode      @relation(fields: [episodeId], references: [id])

  status       EpisodeState
  watchedAt    DateTime?
  rating       Float?
  reaction     String?
  personalNote String?

  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@unique([userId, episodeId])
  @@index([userId])
  @@index([episodeId])
  @@index([status])
}
```

### 13.10 WatchEvent

```prisma
model WatchEvent {
  id          String         @id @default(cuid())
  userId      String
  user        User           @relation(fields: [userId], references: [id])

  mediaId     String
  media       Media          @relation(fields: [mediaId], references: [id])

  episodeId   String?
  episode     Episode?       @relation(fields: [episodeId], references: [id])

  eventType   WatchEventType
  eventDate   DateTime
  source      String
  metadataJson Json?

  createdAt   DateTime       @default(now())

  @@index([userId])
  @@index([eventDate])
}
```

### 13.11 Lists

```prisma
model MediaList {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])

  title          String
  description    String?
  coverMode      String   @default("auto_collage")
  coverUrl       String?
  isFavoriteList Boolean  @default(false)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  items          ListItem[]
}

model ListItem {
  id        String    @id @default(cuid())
  listId    String
  list      MediaList @relation(fields: [listId], references: [id])

  mediaId   String
  media     Media     @relation(fields: [mediaId], references: [id])

  position  Int
  addedAt   DateTime  @default(now())
  createdAt DateTime  @default(now())

  @@unique([listId, mediaId])
  @@index([listId])
  @@index([mediaId])
}
```

### 13.12 Provider

```prisma
model Provider {
  id               String   @id @default(cuid())
  mediaId           String
  media             Media    @relation(fields: [mediaId], references: [id])

  countryCode       String
  providerName      String
  providerLogoPath  String?
  offerType         String
  url               String?
  source            String
  fetchedAt         DateTime
  createdAt         DateTime @default(now())

  @@index([mediaId])
  @@index([countryCode])
}
```

### 13.13 People / Credits

```prisma
model Person {
  id                 String   @id @default(cuid())
  name               String
  profilePath        String?
  tmdbId             String?
  tvdbId             String?
  imdbId             String?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  credits            Credit[]

  @@index([name])
}

model Credit {
  id             String @id @default(cuid())

  mediaId        String
  media          Media  @relation(fields: [mediaId], references: [id])

  personId       String
  person         Person @relation(fields: [personId], references: [id])

  roleType       String
  characterName  String?
  job            String?
  department     String?
  orderIndex     Int?

  createdAt      DateTime @default(now())

  @@index([mediaId])
  @@index([personId])
}
```

### 13.14 Import

```prisma
model Import {
  id          String       @id @default(cuid())
  source      String
  fileName    String
  fileHash    String       @unique
  status      ImportStatus
  summaryJson Json?
  errorJson   Json?

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  mappings    ImportMapping[]
}

model ImportMapping {
  id               String      @id @default(cuid())
  importId          String
  import            Import      @relation(fields: [importId], references: [id])

  sourceRawId       String?
  sourceUrl         String?
  sourceTitle       String
  sourceType        String

  matchedMediaId    String?
  matchedEpisodeId  String?

  matchStatus       MatchStatus
  matchScore        Int?

  rawJson           Json?

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([importId])
  @@index([matchStatus])
}
```

### 13.15 Notifications

```prisma
model Notification {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])

  type         String
  title        String
  body         String?
  imageUrl     String?
  date         DateTime
  isRead       Boolean  @default(false)
  metadataJson Json?

  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([date])
}
```

### 13.16 Settings / Cache

```prisma
model AppSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  valueJson Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ApiCache {
  id           String   @id @default(cuid())
  source       String
  cacheKey     String
  responseJson Json
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  @@unique([source, cacheKey])
  @@index([expiresAt])
}
```

> Note pour Claude Code : si le schéma Prisma ci-dessus contient une relation manquante à cause du découpage, corriger proprement le schéma en conservant exactement les intentions fonctionnelles. Ne pas supprimer de domaine métier.

---

## 14. APIs serveur

Toutes les routes API doivent être préfixées par :

```txt
/api
```

### 14.1 Health

```txt
GET /health
```

Réponse :

```json
{
  "ok": true,
  "app": "SerieTime",
  "version": "1.0.0"
}
```

### 14.2 Auth

```txt
POST /api/auth/setup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### 14.3 Import TV Time

```txt
POST /api/import/tvtime/upload
POST /api/import/tvtime/:id/analyze
POST /api/import/tvtime/:id/confirm
GET  /api/import/tvtime/:id
GET  /api/import/tvtime/:id/unresolved
POST /api/import/tvtime/:id/resolve
POST /api/import/tvtime/:id/ignore
GET  /api/import/tvtime/:id/report
```

### 14.4 Shows

```txt
GET  /api/shows
GET  /api/shows/queue
GET  /api/shows/upcoming
GET  /api/shows/profile
GET  /api/shows/:id
GET  /api/shows/:id/episodes
POST /api/shows/:id/status
POST /api/shows/:id/favorite
POST /api/shows/:id/watchlater
POST /api/shows/:id/abandon
POST /api/shows/:id/poster
POST /api/shows/:id/banner
POST /api/shows/:id/mark-all-watched
```

### 14.5 Episodes

```txt
GET  /api/episodes/:id
POST /api/episodes/:id/watched
POST /api/episodes/:id/unwatched
POST /api/episodes/:id/rating
POST /api/episodes/:id/date
```

### 14.6 Movies

```txt
GET  /api/movies
GET  /api/movies/profile
GET  /api/movies/:id
POST /api/movies/:id/watched
POST /api/movies/:id/unwatched
POST /api/movies/:id/favorite
POST /api/movies/:id/watchlist
```

### 14.7 Search / Explore

```txt
GET /api/search?q=&type=
GET /api/explore/feed
GET /api/explore/discover
GET /api/recommendations
```

### 14.8 Profile

```txt
GET  /api/profile
POST /api/profile
GET  /api/profile/stats
GET  /api/profile/favorites
```

### 14.9 Lists

```txt
GET    /api/lists
POST   /api/lists
GET    /api/lists/:id
PUT    /api/lists/:id
DELETE /api/lists/:id
POST   /api/lists/:id/items
DELETE /api/lists/:id/items/:mediaId
POST   /api/lists/:id/reorder
```

### 14.10 Settings

```txt
GET  /api/settings
POST /api/settings
POST /api/cache/clear
POST /api/backup/export
POST /api/backup/import
GET  /api/notifications
POST /api/notifications/:id/read
```

---

## 15. Import ZIP TV Time

### 15.1 Objectif fonctionnel

L’utilisateur doit pouvoir importer son export `.zip` TV Time depuis :

- le navigateur desktop ;
- la PWA Android ;
- l’APK Android.

L’import doit récupérer :

```txt
séries suivies
séries en cours
séries pas commencées
séries abandonnées
séries pas regardées depuis un moment
films vus
films non vus
watchlist
favoris séries
favoris films
listes personnelles
épisodes vus
dates de visionnage
notes
commentaires privés si présents
statuts
identifiants externes si présents
```

### 15.2 Écran d’import

Route :

```txt
/settings/import-tvtime
```

Header :

```txt
<    Importer TV Time
```

Contenu :

```txt
Importez votre archive TV Time pour récupérer votre historique dans SerieTime.

[CHOISIR UN FICHIER .ZIP]
```

Après sélection :

```txt
Fichier sélectionné
nom-du-fichier.zip
XX Mo

[ANALYSER]
```

Pendant upload :

```txt
Import du fichier...
barre de progression
XX %
```

Pendant analyse :

```txt
Analyse de l’archive...
1. Lecture du ZIP
2. Détection des fichiers
3. Lecture des séries
4. Lecture des épisodes
5. Lecture des films
6. Matching des contenus
```

Rapport :

```txt
Archive analysée

Séries détectées : X
Films détectés : X
Épisodes vus détectés : X
Notes détectées : X
Favoris détectés : X
Listes détectées : X

Import automatique : X
À vérifier : X
Non reconnus : X
Doublons ignorés : X

[IMPORTER]
[VOIR LES ÉLÉMENTS À RÉSOUDRE]
```

### 15.3 Sécurité import

Règles obligatoires :

- taille max ZIP : 100 MB par défaut ;
- refuser non-ZIP ;
- calcul SHA-256 ;
- refuser un ZIP déjà importé, sauf confirmation explicite ;
- protection Zip Slip ;
- ne jamais exécuter un fichier du ZIP ;
- parser uniquement `.json`, `.csv`, `.txt` ;
- stocker archive dans `/data/imports/{importId}/original.zip` ;
- stocker parsing dans `/data/imports/{importId}/parsed-files.json` ;
- stocker rapport dans `/data/imports/{importId}/import-report.json`.

### 15.4 Détection tolérante

Ne jamais supposer un format unique.

Scanner tous les fichiers.

Mots-clés fichiers :

```txt
show
shows
series
serie
episode
episodes
movie
movies
film
films
watch
watched
watchlist
favorite
favorites
rating
ratings
history
list
lists
user
profile
```

Mots-clés colonnes/champs :

```txt
title
name
show_name
series_name
movie_title
episode_title
season
season_number
episode
episode_number
watched_at
watched_date
created_at
rating
status
favorite
list
tvdb_id
tmdb_id
imdb_id
url
```

### 15.5 Normalisation

Créer dans `packages/core` :

```txt
normalizeImportedMedia()
normalizeImportedEpisode()
normalizeTitle()
extractExternalIds()
detectMediaType()
```

Types :

```ts
type NormalizedImportedMedia = {
  source: "tvtime";
  sourceRawId?: string;
  sourceUrl?: string;
  mediaType: "show" | "movie" | "unknown";
  title: string;
  originalTitle?: string;
  year?: number;
  tvdbId?: string;
  tmdbId?: string;
  imdbId?: string;
  status?: string;
  rating?: number;
  isFavorite?: boolean;
  addedAt?: string;
  watchedAt?: string;
  raw: unknown;
};

type NormalizedImportedEpisode = {
  source: "tvtime";
  showTitle: string;
  episodeTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  absoluteNumber?: number;
  watchedAt?: string;
  rating?: number;
  tvdbShowId?: string;
  tvdbEpisodeId?: string;
  tmdbShowId?: string;
  tmdbEpisodeId?: string;
  raw: unknown;
};
```

### 15.6 Matching

Priorité :

```txt
1. ID TVDB exact
2. ID TMDb exact
3. ID IMDb exact
4. URL TV Time contenant ID exploitable
5. titre + année
6. titre localisé + année
7. titre original + année
8. titre seul
9. résolution manuelle
```

Score :

```txt
100 = ID externe exact
90 = titre exact + année exacte
80 = titre exact + année +/- 1
70 = titre proche + année exacte
50 = titre proche sans année
<50 = non importé automatiquement
```

Règles :

```txt
score >= 90 : import automatique
score 70-89 : import automatique avec flag à vérifier
score < 70 : résolution manuelle
```

### 15.7 Résolution manuelle

Route :

```txt
/settings/import-tvtime/:importId/unresolved
```

UI :

- header retour ;
- titre : `À résoudre` ;
- liste/table mobile ;
- chaque item affiche :
  - titre importé ;
  - type détecté ;
  - année ;
  - IDs trouvés ;
  - suggestions ;
  - score ;
  - boutons.

Actions :

```txt
CHOISIR
RECHERCHER
CRÉER MANUELLEMENT
IGNORER
```

---

## 16. Sources de données externes

### 16.1 TMDb

Utiliser TMDb pour :

```txt
recherche séries
recherche films
titres
synopsis
posters
backdrops
genres
casting
trailers
recommandations basiques
popularité
watch providers
```

### 16.2 TVmaze

Utiliser TVmaze comme fallback séries :

```txt
épisodes
saisons
calendrier
lookup IMDb/TVDB
air dates
runtime
```

### 16.3 TheTVDB optionnel

Intégration désactivée par défaut.

Utiliser si :

- export TV Time contient ID TheTVDB ;
- matching TMDb échoue ;
- utilisateur configure clé.

### 16.4 Cache obligatoire

Ne jamais appeler les APIs live à chaque affichage.

Créer un cache serveur `ApiCache`.

Fréquences :

```txt
Série en cours : refresh 3 jours
Série terminée : refresh 90 jours
Film : refresh 180 jours
Providers : refresh 7 jours
Épisodes futurs : refresh quotidien
Images : refresh uniquement si manquantes ou changement manuel
```

---

## 17. Écran Séries

Route :

```txt
/shows
```

Bottom nav active :

```txt
Séries
```

### 17.1 Header tabs

Deux onglets :

```txt
À VOIR
À VENIR
```

Style :

- fond blanc ;
- hauteur 58px ;
- chaque tab largeur 50 % ;
- texte uppercase ;
- actif noir ;
- inactif gris ;
- underline noir épais 4px sous actif ;
- sticky en haut.

### 17.2 Vue À voir

Fond général :

```txt
gris très clair #F2F2F2
```

En haut de contenu :

- pill gris centré `À VOIR` ;
- bouton grille/liste à droite.

Groupes :

```txt
À VOIR
PAS REGARDÉ DEPUIS UN MOMENT
PAS COMMENCÉ
ABANDONNÉ
```

Le groupe est un pill gris centré avec texte blanc uppercase.

### 17.3 Carte épisode à voir

Composant :

```txt
EpisodeQueueCard
```

Dimensions :

```txt
largeur : calc(100% - 24px)
hauteur : 116 à 128px
marge : 12px
fond : blanc
border-radius : 5px
shadow : oui
```

Structure :

- image gauche ;
- contenu centre ;
- check rond droite.

Image :

```txt
largeur : 96px
hauteur : 100 %
object-fit : cover
```

Contenu :

1. pill série :
   - texte uppercase ;
   - border noir 2px ;
   - fond blanc ;
   - chevron droit ;
   - ellipsis.
2. code épisode :
   - exemple `S01 | E13` ;
   - gros bold.
3. compteur :
   - exemple `+4`, `+8` ;
   - petit bold.
4. titre épisode :
   - une ou deux lignes ;
   - ellipsis.
5. badges :
   - `PREMIERE` noir ;
   - `NOUVEAU` jaune ;
   - `PLUS RÉCENT` noir.

Check :

```txt
diamètre : 52px
fond : #F7F7F7
coche : gris
```

Interactions :

```txt
tap carte -> fiche épisode
tap pill série -> fiche série
tap check -> marquer vu
long press -> menu rapide
```

Après check :

- animation scale ;
- coche jaune brièvement ;
- créer watch event ;
- recalculer prochain épisode ;
- carte disparaît ou affiche prochain épisode.

### 17.4 Mode grille Séries

Tap bouton grille :

- icône devient fond jaune ;
- cartes deviennent posters en grille 3 colonnes ;
- gap 4px ;
- posters aspect 2:3 ;
- groupes conservés.

---

## 18. Séries — À venir

Même route `/shows`, tab `À VENIR`.

Groupes par date :

```txt
AUJOURD'HUI
DEMAIN
SAMEDI
DIMANCHE
LUNDI
12 FÉVR. 2026
```

Carte :

- même style que `EpisodeQueueCard` ;
- affiche heure et chaîne/plateforme en haut droite ;
- check seulement si épisode disponible ou passé.

Exemple :

```txt
SILO
S03 | E01
Who Are You?

06:00
APPLE TV
```

Multi-épisodes :

- si plusieurs épisodes le même jour :
  - carte condensée ;
  - ligne basse `2 épisodes` ;
  - chevron bleu ;
  - tap déplie ;
  - chaque épisode apparaît ensuite séparément.

---

## 19. Écran Films principal

Route :

```txt
/movies
```

Bottom nav active :

```txt
Films
```

Header tabs :

```txt
À VOIR
À VENIR
```

### 19.1 Films À voir

Style :

- fond blanc ;
- pill gris centré `À VOIR` ;
- bouton grille jaune à droite ;
- grille posters 3 colonnes ;
- gap 4px ;
- pas de texte sous posters.

Tap poster :

```txt
ouvre fiche film
```

Long press :

```txt
menu rapide
```

### 19.2 Films À venir

- groupement par date ;
- pill gris date ;
- posters alignés à gauche ;
- grands espaces verticaux possibles ;
- pas de carte texte.

---

## 20. Explorer

Route :

```txt
/explore
```

Bottom nav active :

```txt
Explorer
```

### 20.1 Header recherche

En haut :

- icône loupe gauche ;
- placeholder `Rechercher` ;
- underline gris ;
- padding horizontal 24px ;
- hauteur environ 70px.

Tap :

- focus ;
- bouton `Annuler` bleu à droite ;
- icône clear grise si texte non vide.

### 20.2 Tabs Explorer

Pills horizontales :

```txt
FLUX
DÉCOUVRIR
LISTES
```

Ne pas afficher :

```txt
GROUPES
UTILISATEURS
```

Style :

- actif jaune ;
- inactif gris clair ;
- texte uppercase bold ;
- radius 999px ;
- height 54px ;
- scroll horizontal.

### 20.3 Flux

Le flux devient un flux personnel de recommandations.

Carte :

```txt
ExploreHeroCard
```

Style :

- grande image backdrop ;
- overlay sombre ;
- bouton plus jaune outline haut droite ;
- play au centre si trailer ;
- titre blanc ;
- type icône TV/clap ;
- infos sous titre ;
- synopsis dans bloc pastel clair en bas.

Tap plus :

```txt
ajoute à watchlist
```

Tap carte :

```txt
ouvre fiche série/film
```

### 20.4 Recherche active

Tabs recherche :

```txt
SÉRIES ET FILMS
LISTES
PERSONNES
```

`PERSONNES` = acteurs/réalisateurs.

État vide :

```txt
Toutes nos excuses
Nous n'avons trouvé aucun résultat pour « {query} »
```

Texte centré.

---

## 21. Profil

Route :

```txt
/profile
```

Bottom nav active :

```txt
Profil
```

### 21.1 Header profil

Grand header :

- image couverture ;
- hauteur environ 220px ;
- overlay sombre ;
- cloche jaune haut gauche ;
- trois points haut droite ;
- avatar rond bas gauche ;
- nom blanc ;
- bouton `MODIFIER` outline blanc.

Au scroll :

- header devient barre sticky sombre ;
- nom centré ;
- cloche et trois points restent visibles.

### 21.2 Compteurs

Remplacer les compteurs sociaux par :

```txt
Séries
Films
Notes
```

Trois colonnes :

- nombre bold ;
- label dessous ;
- bordures verticales grises.

### 21.3 Sections profil

Sections :

```txt
Statistiques
Listes
Séries
Séries préférées
Films
Films préférés
```

Chaque titre :

- gros bold ;
- chevron droite ;
- cœur rouge pour favoris.

### 21.4 Statistiques carousel

Cartes :

```txt
Temps passé devant des séries
Épisodes vus
Temps passé devant des films
Films regardés
```

Style :

- bordure ;
- titre avec icône ;
- séparateur ;
- valeur grande.

### 21.5 Listes profil

Carte large :

- collage posters ;
- overlay sombre ;
- titre blanc ;
- dots pagination sous carte.

### 21.6 Rows posters

- posters horizontaux ;
- 3 visibles environ ;
- aspect 2:3 ;
- gap 6px ;
- scroll horizontal.

---

## 22. Profil > Séries

Route :

```txt
/profile/shows
```

Header :

```txt
<    Séries    [œil jaune]
```

Sections :

```txt
EN COURS
PAS REGARDÉ DEPUIS UN MOMENT
ABANDONNÉ
PAS COMMENCÉ
```

Chaque section :

- pill gris centré ;
- grille 3 colonnes posters ;
- bouton filtre flottant jaune ;
- bouton œil affiche/masque éléments cachés.

---

## 23. Profil > Films

Route :

```txt
/profile/movies
```

Header :

```txt
<    Films    [œil jaune]
```

Sections :

```txt
VU
PAS VU
```

Grille posters 3 colonnes.

Bouton flottant :

```txt
FILTRES
```

Style :

- jaune ;
- arrondi 999px ;
- position bottom center ;
- au-dessus de la bottom nav/safe area.

### 23.1 Bottom sheet filtres

Overlay sombre.

Sheet bas :

```txt
Trier par
[Dernier visionnage] [Dernier ajout] [Ordre alphabétique]

Avancement
Tous
Vu
Non vu

[RÉINITIALISER] [APPLIQUER]
```

Chips :

- actif jaune ;
- inactif gris.

Radio :

- actif cercle jaune avec coche ;
- inactif contour gris.

Comportement :

- tap overlay ferme ;
- drag down ferme ;
- bouton retour Android ferme ;
- appliquer met à jour ;
- reset remet défaut.

---

## 24. Édition profil

Route :

```txt
/profile/edit
```

Header :

```txt
X    Modifier le profil    SAUVEGARDER
```

Sauvegarder gris si aucun changement.

Champs :

```txt
Choisir une photo de profil
Choisir une photo de couverture
Nom d'affichage
Informations personnelles
Année de naissance
Sexe
Pays
```

Style :

- liens bleus ;
- lignes séparées ;
- boutons x gris à droite.

---

## 25. Menu profil trois points

Action sheet :

```txt
Paramètres
Partager
Centre d'aide
```

Dans SerieTime :

- Paramètres -> `/settings` ;
- Partager -> export local ou message “Partage social désactivé” ;
- Centre d’aide -> aide locale.

---

## 26. Paramètres

Route :

```txt
/settings
```

Header :

```txt
<    Paramètres
```

Tabs :

```txt
COMPTE
APPLICATION
À VENIR
```

### 26.1 Compte

Sections :

```txt
Identification
Import & sauvegarde
Services d'abonnement
Vie privée locale
```

Identification :

```txt
Nom d'utilisateur
Adresse e-mail
Identifiant utilisateur
Modifier le mot de passe >
```

Import & sauvegarde :

```txt
Importer mes données TV Time >
Exporter mes données SerieTime >
Sauvegarde locale >
```

Services :

```txt
Modifier vos services d'abonnement >
```

Vie privée :

```txt
Lire la politique de confidentialité locale
Verrouiller l'application
```

Bas :

```txt
SE DÉCONNECTER
SUPPRIMER LE COMPTE
```

### 26.2 Application

Sections :

```txt
Titres
Commentaires privés
Notifications
Thème
Recommandations
Flux
Cache
Version
```

Titres :

```txt
Afficher dans votre langue
Les titres s'affichent par défaut en anglais
toggle
```

Commentaires privés :

```txt
Sélectionnez les langues des notes/commentaires privés >
```

Notifications :

```txt
Sélectionnez les alertes que vous souhaitez recevoir >
```

Thème :

```txt
Suivre le thème défini sur l'appareil
Thème clair
Thème sombre
```

Radio style identique captures.

Flux :

```txt
Lecture automatique des vidéos
Lire automatiquement les bandes annonces vidéo
toggle
```

Bouton :

```txt
VIDER LE CACHE
```

Version :

```txt
VERSION 1.0.0
```

### 26.3 À venir

```txt
Épisodes à afficher
Choix des chaînes >
Masquer les épisodes vus
```

---

## 27. Notifications

Route :

```txt
/settings/notifications
```

Header :

```txt
<    Notifications
```

Liste :

- image ronde gauche ;
- texte notification ;
- date dessous ;
- séparateur gris ;
- fond blanc.

Notifications locales :

```txt
Le dernier épisode de {série} est disponible
Vous avez débloqué le badge {badge}
Import terminé
Nouveau film disponible
```

---

## 28. Listes

### 28.1 Page listes

Route :

```txt
/lists
```

Header :

```txt
<    Listes
```

Bouton jaune :

```txt
CRÉER UNE LISTE
```

Cartes :

- collage posters ;
- overlay sombre ;
- titre blanc bas gauche ;
- trois points blancs haut droite ;
- cercle outline blanc bas droite ;
- height 150-160px ;
- margin 24px ;
- radius 5px.

### 28.2 Ajouter à une liste

Depuis menu série :

```txt
Ajouter à une liste
```

Ouvre page :

```txt
<    Listes
[CRÉER UNE LISTE]
cartes listes
```

Tap cercle :

- ajoute ou retire la série ;
- cercle devient jaune/check ;
- toast `Ajouté à {liste}` ;
- sauvegarde automatique.

---

## 29. Fiche série

Route :

```txt
/show/:id
```

### 29.1 Header

Grand header image :

- backdrop plein écran largeur ;
- hauteur 260px environ ;
- overlay sombre ;
- flèche bas/gauche haut gauche ;
- trois points haut droite ;
- titre blanc en bas ;
- infos sous titre.

Exemple :

```txt
Sentenced to Be a Hero
2 saisons · Tokyo MX
```

Scroll :

- header compact ;
- titre centré en top bar ;
- backdrop sombre en arrière-plan ;
- tabs sticky.

### 29.2 Tabs

```txt
À PROPOS
ÉPISODES
```

Style identique :

- uppercase ;
- actif noir ;
- inactif gris ;
- underline 4px.

### 29.3 Onglet À propos

#### Où regarder

```txt
Où regarder     [engrenage]
[play] AMAZON PRIME VIDEO
```

Si aucun provider :

```txt
Non disponible
```

#### Questionnaire local

```txt
QU'EST-CE QUI VOUS INTÉRESSE LE PLUS DANS CETTE SÉRIE ?

LES ACTEURS
LA PRÉMISSE
LES CRÉATEURS
LA CHAÎNE/LA PLATEFORME
LA FRANCHISE OU L'UNIVERS
AUTRE
```

Stocker comme préférences locales.

#### Informations sur la série

```txt
Informations sur la série
Présent · Fantastique, Animation, Aventure...
```

Synopsis en gros texte.

#### Bande-annonce

Thumbnail + play :

```txt
Regarder la bande annonce
00:00
```

#### Diffusion

```txt
jeu. | 22:30
28 min
```

#### Distribution

Carousel acteurs :

- cartes image ;
- overlay sombre ;
- nom acteur ;
- personnage uppercase.

#### Recommandations

Remplacer :

```txt
Les utilisateurs ont également regardé
```

par :

```txt
Vous pourriez aussi aimer
```

#### Notes

Remplacer communauté par local :

```txt
Mes notes
```

#### Commentaires

Remplacer par :

```txt
Notes privées
```

### 29.4 Onglet Épisodes

#### Démarrer le suivi

Carte horizontale du prochain épisode.

#### Tous les épisodes

Titre :

```txt
Tous les épisodes
```

Bouton check rond à droite pour tout marquer.

Saisons accordéon :

```txt
Saison 1     0/12     check
Saison 2     0/1      check
```

Ouverture saison :

- chevron bas -> haut ;
- bord jaune fin ;
- liste épisodes.

Épisode row :

```txt
image gauche
S01 | E01 (E01)
titre épisode
check rond droite
```

Tap row :

```txt
fiche épisode
```

Tap check :

```txt
marquer vu/non vu
```

---

## 30. Fiche épisode

Route :

```txt
/episode/:id
```

Ou modal full-screen.

Layout :

- fond gris clair ;
- flèche bas haut gauche ;
- handle gris haut centre ;
- carte centrale.

Carte :

- image backdrop ;
- overlay sombre ;
- pill série ;
- bouton share ;
- code épisode blanc ;
- titre blanc ;
- bande basse blanche.

Bande basse :

```txt
[calendrier] 3 janv. 2026
[œil] Pas vu
[check]
```

Si vu :

```txt
[calendrier] date visionnage
[œil/check] Vu
```

Comportements :

- check marque vu ;
- tap date ouvre date picker ;
- swipe down ferme ;
- bouton retour ferme.

---

## 31. Menu série trois points

Depuis fiche série.

Action sheet :

```txt
En cours
Personnaliser
Favoris
Ajouter à une liste
Regarder plus tard
Supprimer la série
Partager
```

Style :

- overlay sombre ;
- sheet blanche ;
- lignes hautes ;
- icône gauche ;
- texte bold ;
- séparateurs ;
- ligne jaune sous statut.

### 31.1 Personnaliser

Bottom sheet :

```txt
Personnaliser
Modifier l'affiche
Changer la bannière
```

### 31.2 Modifier l’affiche

Route :

```txt
/show/:id/posters
```

Header :

```txt
<    Modifier l'affiche
```

Grille :

- 2 colonnes ;
- posters ;
- sélectionnée = overlay sombre + étoile jaune + texte `Sélectionnée`.

### 31.3 Changer la bannière

Route :

```txt
/show/:id/banners
```

Header :

```txt
<    Changer la bannière
```

Liste :

- backdrops 16:9 ;
- full width avec marges ;
- radius ;
- tap sélectionne.

---

## 32. Comportements métier essentiels

### 32.1 Marquer épisode vu

Actions serveur :

```txt
upsert UserEpisodeStatus watched
set watchedAt
create WatchEvent watched
update UserMediaStatus lastWatchedAt
if first watched episode -> status watching
if all episodes watched and show ended -> completed
recalculate progress
```

Mobile :

- animation check ;
- update cache optimiste ;
- si erreur, rollback + toast.

### 32.2 Marquer épisode non vu

```txt
set status unwatched
remove/reverse watchedAt
create WatchEvent marked_unwatched
recalculate progress
```

### 32.3 Marquer film vu

```txt
status completed
lastWatchedAt now
create WatchEvent watched
```

### 32.4 Favoris

```txt
toggle isFavorite
appear in Séries préférées / Films préférés
```

### 32.5 Regarder plus tard

```txt
status watchlist
appear in pas commencé / watchlist
```

### 32.6 Abandonner série

```txt
status abandoned
hide from À voir
show in Profil > Séries > Abandonné
```

### 32.7 Supprimer série

Ne pas supprimer le média global.

Faire :

```txt
remove UserMediaStatus
remove user episode statuses après confirmation
```

Confirmation :

```txt
Supprimer cette série de votre suivi ?
[ANNULER] [SUPPRIMER]
```

---

## 33. Offline mobile

### 33.1 Cache

Utiliser :

```txt
TanStack Query persist
IndexedDB
Service Worker
```

### 33.2 Mutations offline

Créer localement une queue :

```ts
type OfflineMutation = {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
  syncStatus: "pending" | "synced" | "failed";
  retryCount: number;
  lastError?: string;
};
```

Actions offline autorisées :

```txt
marquer épisode vu
marquer épisode non vu
marquer film vu
favori
ajout liste
note personnelle
```

Quand le serveur revient :

- rejouer mutations ;
- si conflit, priorité dernière action utilisateur ;
- afficher toast discret.

---

## 34. Composants UI obligatoires

Créer au minimum :

```txt
AppShell
BottomNav
TopTabs
PillHeader
GridToggleButton
EpisodeQueueCard
UpcomingEpisodeCard
PosterGrid
PosterTile
FloatingFilterButton
FilterBottomSheet
ExploreSearchHeader
ExploreTabs
ExploreHeroCard
ProfileHeader
ProfileStatsStrip
StatsCarouselCard
PosterRowSection
ListCoverCard
SettingsTabs
SettingsSection
SettingsRow
ToggleSwitch
RadioOption
ActionSheet
SeriesHeroHeader
SeriesTabs
ProviderButton
InterestQuestionnaire
CastCarousel
SeasonAccordion
EpisodeRow
EpisodeDetailModal
PosterSelectionGrid
BannerSelectionList
ImportDropzone
ImportAnalysisReport
UnresolvedMappingTable
EmptyState
SkeletonBlock
Toast
```

---

## 35. Tests

### 35.1 Tests unitaires

```txt
normalizeTitle
extractExternalIds
CSV parser
JSON parser
matching score
next episode
show progress
watch time stats
movie filters
group shows by status
group upcoming by date
```

### 35.2 Tests intégration

```txt
import ZIP sample
resolve mapping
add show
mark episode watched
mark episode unwatched
mark movie watched
add favorite
add to list
change poster
change banner
export backup
```

### 35.3 Tests visuels Playwright

Viewports :

```txt
360x800
390x844
393x873
412x915
430x932
```

Screenshots à tester :

```txt
Séries À voir
Séries À venir
Films grille
Explorer flux
Recherche vide
Profil
Paramètres Compte
Paramètres Application
Paramètres À venir
Fiche série À propos
Fiche série Épisodes
Menu série
Modifier affiche
Changer bannière
Listes
Filtres films
Import TV Time
```

---

## 36. Docker

Créer :

```txt
Dockerfile.server
docker-compose.yml
```

Docker compose minimal :

```yaml
services:
  serietime-server:
    build:
      context: .
      dockerfile: Dockerfile.server
    ports:
      - "4000:4000"
    volumes:
      - ./apps/server/data:/app/apps/server/data
    env_file:
      - .env
```

Commandes README :

```bash
pnpm install
pnpm db:migrate
pnpm dev
pnpm build

docker compose up -d
```

---

## 37. Documentation attendue

Créer :

```txt
README.md
docs/README_ANDROID.md
docs/IMPORT_TVTIME.md
docs/API.md
docs/DEVELOPMENT_PLAN.md
```

README doit expliquer :

```txt
installation serveur
installation mobile
configuration TMDb
configuration optionnelle TheTVDB
import ZIP TV Time
build PWA
build APK Android
sauvegarde
restauration
limitations
```

---

## 38. Ordre d’exécution pour Claude Code

Claude Code doit procéder ainsi.

### Phase 0 — Analyse

Avant de coder :

```txt
Lire la spec
Lister les choix techniques
Proposer arborescence
Proposer modèles Prisma
Proposer endpoints
Proposer plan d’implémentation
Attendre validation utilisateur
```

### Phase 1 — Monorepo

Créer :

```txt
workspace pnpm
apps/mobile
apps/server
packages/core
packages/types
packages/ui
```

### Phase 2 — Serveur

Créer :

```txt
Fastify
Prisma
SQLite
auth locale
health route
settings
```

### Phase 3 — Modèle données

Créer :

```txt
schema Prisma
migrations
seed minimal
```

### Phase 4 — Import TV Time

Créer :

```txt
upload ZIP
analyse ZIP
parser JSON/CSV
normalisation
matching
rapport
résolution manuelle
```

### Phase 5 — Mobile UI shell

Créer :

```txt
PWA
Capacitor
navigation
bottom nav
routes
theme
safe areas
```

### Phase 6 — Écrans principaux

Créer :

```txt
Séries
Films
Explorer
Profil
```

### Phase 7 — Fiches

Créer :

```txt
Fiche série
Fiche épisode
Fiche film
menus
listes
posters/banners
```

### Phase 8 — Settings

Créer :

```txt
profil edit
paramètres
notifications
import
backup
```

### Phase 9 — Offline

Créer :

```txt
cache
service worker
queue mutations offline
```

### Phase 10 — Tests et polish

Créer :

```txt
unit tests
integration tests
visual tests
APK build
README
```

---

## 39. Critères d’acceptation finaux

SerieTime est validée seulement si :

```txt
L’app s’installe en PWA sur Android
L’APK Android se génère
L’APK s’ouvre sur Oppo/Android
L’app affiche SerieTime
La bottom nav fonctionne
Le bouton retour Android fonctionne
L’import ZIP TV Time fonctionne
Les mappings ambigus sont résolubles
Les séries à voir s’affichent comme les captures
Les épisodes à venir s’affichent comme les captures
Les films s’affichent en grille comme les captures
Explorer ressemble aux captures
Profil ressemble aux captures
Paramètres ressemble aux captures
Fiche série ressemble aux captures
Onglet épisodes ressemble aux captures
Fiche épisode ressemble aux captures
Menu série trois points ressemble aux captures
Modifier affiche fonctionne
Changer bannière fonctionne
Ajouter à une liste fonctionne
Les favoris fonctionnent
Les stats fonctionnent
Les filtres bottom sheet fonctionnent
Les safe areas Android sont respectées
Aucune action importante n’est cachée par la barre Android
Les données sont sauvegardables
L’app reste utilisable sans TV Time après import
```

---

## 40. Prompt final court pour Claude Code

À donner après avoir placé cette spec dans le repo :

```txt
Tu dois développer SerieTime en respectant strictement /docs/SPEC_SERIETIME.md.

Ne commence pas par coder l’UI.
Commence par lire la spec, puis propose :
1. l’arborescence finale,
2. le schéma Prisma,
3. les routes API,
4. les composants UI,
5. le plan d’implémentation en phases.

Objectif : PWA Android installable + APK Android via Capacitor + serveur personnel Node/Fastify/Prisma/SQLite.

L’interface doit être quasi pixel-perfect par rapport aux captures fournies.
Ne modernise pas le design.
Ne crée pas de fonctionnalités sociales.
Remplace toute mention de TV Time par SerieTime.
Ne réutilise pas le logo ou les assets propriétaires TV Time.
L’import ZIP TV Time est critique et doit être robuste, tolérant et vérifiable.
```

---

## 41. Recommandation pratique pour les captures

Ajouter les captures de référence dans :

```txt
/docs/screenshots/reference/
```

avec des noms explicites :

```txt
01-shows-a-voir-list.png
02-shows-a-voir-scroll.png
03-shows-a-venir.png
04-movies-grid.png
05-explore-feed.png
06-profile-top.png
07-settings-account.png
08-show-detail-about.png
09-show-detail-episodes.png
10-series-action-sheet.png
```

Claude Code doit s’y référer pour les tests visuels et l’implémentation pixel-perfect.

---

## 42. Notes finales pour Claude Code

- Ne pas improviser le design.
- Ne pas créer de réseau social.
- Ne pas faire dépendre l’app de TV Time après import.
- Ne pas exposer les clés API côté mobile.
- Ne pas appeler les APIs externes à chaque affichage.
- Prioriser robustesse import + modèle données avant polish UI.
- L’app doit fonctionner sur Android, pas seulement dans un navigateur desktop.
- Les captures sont la source de vérité UX/UI.
