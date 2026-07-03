# SerieTime sur Android — Expo Go & APK

L'app mobile SerieTime est une app **React Native + Expo** unique, cross-platform (Android & iOS).
On la visualise avec **Expo Go** pendant le développement, et on produit un **APK** via EAS Build.
Elle cible l'Oppo Find X / ColorOS et respecte les safe areas et le bouton retour Android.

## 1. Visualiser avec Expo Go (développement)

Le moyen le plus rapide de voir l'app en rendu natif réel, sans rien compiler.

1. **Prérequis** : Node.js ≥ 20 et l'app **Expo Go**
   ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) ·
   [iOS](https://apps.apple.com/app/expo-go/id982107779)). Téléphone et ordinateur sur le
   **même Wi-Fi**.
2. **Serveur joignable** : démarre le serveur SerieTime et note l'**IP locale** de l'ordinateur
   (ex. `192.168.1.42`) — le téléphone doit pouvoir atteindre `http://192.168.1.42:4000`,
   pas `localhost`.
3. **Lancer l'app** :
   ```bash
   cd serietime/mobile
   npm install
   npx expo start
   ```
4. Scanne le QR code (appareil photo iOS, ou Expo Go sur Android).
5. Saisis l'URL du serveur, teste la connexion, crée ton compte ou connecte-toi.

## 2. Générer un APK

### Via EAS Build (recommandé, cloud, sans Android Studio)

```bash
cd serietime/mobile
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

EAS compile dans le cloud et fournit un lien de téléchargement de l'**APK**. Tu peux l'installer
directement sur le téléphone.

Pour un premier build, EAS crée un `eas.json` ; le profil `preview` produit un APK installable
(le profil `production` produit un AAB pour le Play Store).

### En local avec Android Studio

```bash
cd serietime/mobile
npx expo run:android      # nécessite Android SDK + JDK 17
```

Package Android : `com.serietime.app` · Nom affiché : `SerieTime` · Icône adaptive jaune générée
par `scripts/icons.mjs`.

## 3. Comportements natifs

- **Safe areas** : gérées via `react-native-safe-area-context` (headers, bottom nav, écrans).
- **Bottom navigation** : Séries / Films / Explorer / Profil, avec point rouge sur Explorer quand
  de nouvelles recommandations sont disponibles.
- **Bouton retour Android** : géré par la navigation `expo-router` (ferme les modales/sheets, puis
  remonte la pile d'écrans).
- **Connexion au serveur** : au premier lancement, l'app demande l'URL du serveur et la teste via
  `GET /health`. L'URL et le token de session sont stockés localement (AsyncStorage) ; aucune clé
  API externe n'est présente côté mobile.

## 4. iOS

Le même code tourne sur iOS via Expo Go (scan du QR code) et se build avec
`eas build --platform ios` (compte Apple Developer requis pour un IPA signé).
