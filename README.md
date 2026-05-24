# MangaTrack

Application mobile de suivi de lectures — manga, manhwa, manhua, webtoon & BD.
Construite avec **Expo SDK 54 / React Native 0.81**, TypeScript strict, design glassmorphisme iOS.

Sources de données : **AniList** (GraphQL), **MangaDex** (REST), **Jikan / MyAnimeList**.

---

## Lancer en local (Expo Go)

Le moyen le plus rapide de voir l'app sur ton téléphone, en rendu natif réel.

### 1. Prérequis
- **Node.js LTS** (≥ 20) et **git** installés sur ton ordinateur.
- L'app **Expo Go** sur ton téléphone ([App Store](https://apps.apple.com/app/expo-go/id982107779) · [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)).
- Téléphone et ordinateur sur le **même réseau Wi-Fi**.

### 2. Récupérer le code
```bash
git clone https://github.com/Yggdrazzil/Manga.git
cd Manga
git checkout claude/code-best-practices-skills-nlEEM
```

### 3. Installer les dépendances
Le flag `--legacy-peer-deps` est nécessaire (conflits de peer deps connus) :
```bash
npm install --legacy-peer-deps
```

### 4. Démarrer le serveur de dev
```bash
npx expo start
```

### 5. Ouvrir sur le téléphone
- **iOS** : ouvre l'app **Appareil photo**, vise le QR code affiché dans le terminal, puis ouvre dans Expo Go.
- **Android** : ouvre **Expo Go** → « Scan QR code ».
- Si le QR ne charge pas (réseaux séparés, VPN, pare-feu d'entreprise) :
  ```bash
  npx expo start --tunnel
  ```
  (accepte l'installation de `@expo/ngrok` si demandé).

### 6. Dépannage
- **« Project is incompatible with this version of Expo Go »** : ta version d'Expo Go ne
  supporte pas le SDK 54 (trop ancienne, ou plus récente côté SDK). Aligne le projet sur
  ta version d'Expo Go :
  ```bash
  npx expo install expo@latest
  npx expo install --fix -- --legacy-peer-deps
  npx tsc --noEmit
  ```
- **Bundling bloqué / cache** : `npx expo start -c`.

---

## Vérifier que tout marche
1. `npx expo start` démarre sans erreur de bundling.
2. Les 4 onglets chargent : **Découvrir**, **Bibliothèque**, **Recherche**, **Profil**.
3. « Découvrir » affiche les rangées (données AniList/MangaDex réelles) → le réseau fonctionne.
4. « Recherche » : taper 2+ caractères renvoie des résultats.
5. Ouvrir un manga → l'écran détail s'affiche, l'ajout à la bibliothèque fonctionne.

---

## Scripts
| Commande | Description |
|----------|-------------|
| `npx expo start` | Serveur de dev (QR code Expo Go) |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run ios` / `npm run android` | Lancer sur simulateur/émulateur (setup natif requis) |

---

## Stack technique
- **Expo Router 6** — navigation par fichiers, routes typées
- **TanStack Query v5** — cache et gestion des requêtes réseau
- **Zustand v5 + AsyncStorage** — bibliothèque locale persistante (aucun compte requis)
- **Reanimated 4 + Moti** — animations spring (New Architecture)
- **expo-blur** — glassmorphisme (verre dépoli) sur iOS

---

## Déploiement sur les stores (plus tard)
Le projet est compatible **EAS Build** (bundle IDs iOS/Android dans `app.json`, New Architecture activée) :
```bash
npx eas build --platform ios       # App Store
npx eas build --platform android   # Google Play
```
