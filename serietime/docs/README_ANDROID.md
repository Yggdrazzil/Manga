# SerieTime sur Android — PWA & APK

SerieTime se déploie de deux façons sur Android : en **PWA installable** depuis Chrome, ou en
**APK natif** généré via Capacitor. Les deux ciblent l'Oppo Find X / ColorOS et respectent les
safe areas et le bouton retour Android.

## 1. PWA installable

### Build

```bash
cd apps/mobile
VITE_DEFAULT_SERVER_URL="https://serietime.mondomaine.fr" pnpm build
```

Le dossier `dist/` contient :

- `manifest.webmanifest` — nom `SerieTime`, mode `standalone`, orientation `portrait`,
  icônes 192/512 + maskable ;
- un **service worker** (Workbox) qui met en cache l'app shell, les images TMDb déjà vues et les
  appels API principaux (stratégie NetworkFirst avec fallback hors-ligne) ;
- les icônes générées (aucun asset TV Time).

### Installation sur l'Oppo Find X

1. Servez `dist/` en **HTTPS** (obligatoire pour l'installation PWA).
2. Ouvrez l'URL dans **Chrome Android**.
3. Menu ⋮ → **Ajouter à l'écran d'accueil** / **Installer l'application**.
4. SerieTime s'ouvre en mode standalone, sans barre navigateur, avec son icône.

Disponible hors-ligne : accueil, séries, films, profil, stats, listes et fiches déjà consultées.
Indisponibles hors-ligne : recherche externe, refresh des métadonnées, import ZIP.

## 2. APK Android via Capacitor

### Configuration (déjà en place)

`apps/mobile/capacitor.config.ts` :

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.serietime.app',
  appName: 'SerieTime',
  webDir: 'dist',
  server: { androidScheme: 'https' },
};

export default config;
```

### Première initialisation du projet Android

Le dossier `android/` n'est pas versionné (il est généré). Créez-le une fois :

```bash
cd apps/mobile
pnpm build
npx cap add android
```

### Build de l'APK

```bash
cd apps/mobile
pnpm build            # (re)génère dist/
npx cap sync android  # copie dist/ + plugins dans le projet Android
npx cap open android  # ouvre Android Studio (optionnel)

# APK debug en ligne de commande :
cd android
./gradlew assembleDebug
```

Livrable :

```txt
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Installez-le sur l'appareil (`adb install app-debug.apk` ou transfert direct).

### Comportements natifs implémentés

- **Bouton retour Android** (`@capacitor/app`) : ferme d'abord la bottom sheet / action sheet /
  modale ouverte, sinon revient à l'écran précédent, sinon revient à l'onglet Séries, et depuis
  Séries demande confirmation avant de quitter (« Quitter SerieTime ? »).
- **Safe areas** : `env(safe-area-inset-*)` appliqué à la bottom nav, aux pages, au bouton filtre
  flottant et aux bottom sheets.
- **Package** `com.serietime.app`, nom affiché `SerieTime`.

### Connexion au serveur

Au premier lancement, l'APK demande l'URL du serveur personnel et la teste via `GET /health`
avant de continuer. L'URL et le token de session sont stockés localement ; aucune clé API externe
n'est présente côté mobile.

### Icône adaptative

Les icônes PWA (`public/icons/`) sont générées par `scripts/generate-icons.mjs`. Pour l'icône
adaptative Android, importez `icon-maskable-512.png` via Android Studio
(**res → New → Image Asset**) ou remplacez les `mipmap` du projet `android/`.
