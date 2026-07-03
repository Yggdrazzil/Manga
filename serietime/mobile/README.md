# SerieTime — App mobile (React Native + Expo)

Application mobile cross-platform (Android & iOS) construite avec **Expo SDK 54 /
React Native 0.81 / expo-router**, dans le même esprit que MangaTrack. Elle parle au
serveur personnel SerieTime via son API REST.

## Lancer avec Expo Go (le plus simple)

Le moyen le plus rapide de voir l'app sur ton téléphone, en rendu natif réel.

1. **Prérequis** : Node.js ≥ 20, et l'app **Expo Go** sur ton téléphone
   ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) ·
   [iOS](https://apps.apple.com/app/expo-go/id982107779)). Téléphone et ordinateur
   sur le **même Wi-Fi**.
2. **Démarrer le serveur SerieTime** (voir le README racine) : il doit tourner et être
   joignable depuis le téléphone (utilise l'IP locale de l'ordinateur, ex.
   `http://192.168.1.42:4000`, pas `localhost`).
3. **Installer et lancer l'app** :
   ```bash
   cd serietime/mobile
   npm install
   npx expo start
   ```
4. **Ouvrir sur le téléphone** : scanne le QR code affiché avec l'appareil photo (iOS)
   ou depuis Expo Go (Android).
5. Au premier lancement, saisis l'**URL de ton serveur**, teste la connexion, puis
   crée ton compte ou connecte-toi.

## Aperçu rapide sans téléphone (web)

```bash
npx expo start --web
```

Rendu approximatif (React Native Web) mais pratique pour un coup d'œil. Le vrai rendu
est sur Expo Go / build natif.

## Build APK / iOS

Via **EAS Build** (cloud, sans Android Studio) :

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview   # → APK téléchargeable
```

Ou en local avec Android Studio :

```bash
npx expo run:android
```

Package Android : `com.serietime.app` · Nom : `SerieTime`.

## Structure

```txt
mobile/
  app/
    _layout.tsx          # providers (React Query, SafeArea, Stack)
    index.tsx            # porte d'entrée (setup / login / app)
    setup.tsx            # config serveur + connexion
    (tabs)/
      _layout.tsx        # bottom nav (Séries, Films, Explorer, Profil)
      index.tsx          # Séries — À voir / À venir
      movies.tsx         # Films — grille
      explore.tsx        # Explorer — recherche + flux
      profile.tsx        # Profil — stats, listes, rangées
    show/[id].tsx        # fiche série (À propos / Épisodes) & fiche film
    settings.tsx         # paramètres (Compte / Application / À venir)
    import.tsx           # import TV Time
  components/            # TabBar, EpisodeQueueCard, PageHeader, ui.tsx
  lib/                   # api, store (zustand + AsyncStorage), theme, types, format
```

L'app est autonome (npm), elle n'est pas membre du workspace pnpm du serveur — elle
communique uniquement via HTTP, ce qui garde la config Metro simple.
