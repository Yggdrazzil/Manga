# Mettre Akiya Radar en service

Guide pas-à-pas pour rendre le site opérationnel et le faire récupérer
automatiquement les annonces des banques d'akiya japonaises.

**Aucune connaissance en programmation n'est nécessaire.** Vous allez copier des
commandes et les coller dans un terminal.

---

## Deux façons de faire tourner l'application

| | **Mode autonome** (sans serveur) | **Mode serveur** |
|---|---|---|
| **Coût** | **0 €** | ~4,50 €/mois |
| **Installation** | 15 min, tout sur GitHub | 45 min, un VPS à louer |
| **Collecte automatique** | ✅ tous les matins | ✅ tous les matins |
| **Risques naturels, altitude, géocodage** | ✅ | ✅ |
| **Taux de change du jour** | ✅ | ✅ |
| **Notes, favoris, statuts** | dans **votre navigateur** (un seul appareil) | en base, accessible partout |
| **Importer une URL trouvée ailleurs** | ❌ | ✅ |
| **Choisir les communes depuis l'interface** | ❌ (fichier de config) | ✅ page Catalogue |
| **Comparables de prix MLIT** | ❌ | ✅ |

**Lequel choisir ?** Commencez par le **mode autonome** : c'est gratuit,
réversible, et suffisant pour consulter un catalogue et suivre des biens. Passez
au mode serveur le jour où vous voulez importer des annonces trouvées ailleurs
ou retrouver vos notes sur plusieurs appareils.

- Mode autonome → **[section A](#a--mode-autonome-sans-serveur-0)**, 15 minutes.
- Mode serveur → **[section B](#b--mode-serveur)**, 45 minutes.

---

# A · Mode autonome (sans serveur, 0 €)

Le principe : **GitHub fait tout le travail**. Chaque matin, il visite les
banques d'akiya que vous avez choisies, en extrait les annonces, les enrichit,
et publie un site web statique. Votre navigateur télécharge ce site et n'a
besoin d'aucun serveur derrière.

> Vos données personnelles (favoris, notes, statuts, tâches) restent **dans
> votre navigateur**. Elles ne partent nulle part — mais elles sont liées à cet
> appareil et à ce navigateur. Pensez à les exporter de temps en temps.

## A1 — Activer les pages GitHub

1. Sur votre dépôt GitHub : **Settings** → **Pages**.
2. **Source** : choisissez **GitHub Actions**.

## A2 — Choisir les communes

1. **Settings** → **Secrets and variables** → **Actions** → onglet **Variables**.
2. **New repository variable** :
   - **Name** : `AKIYA_STATIC_SOURCES`
   - **Value** : les clés du catalogue, séparées par des virgules.
     Par exemple : `athome-18202,athome-32528,athome-44206`

**Où trouver ces clés ?** Elles suivent toutes le même format :
`athome-` + le code à 5 chiffres de la commune. Quelques exemples :

| Commune | Clé |
|---|---|
| 敦賀市 (Tsuruga, Fukui) | `athome-18202` |
| 福井市 (Fukui) | `athome-18201` |
| 隠岐の島町 (Oki, Shimane) | `athome-32528` |
| 由布市 (Yufu, Ōita) | `athome-44213` |
| 函館市 (Hakodate) | `athome-01202` |

Pour trouver une autre commune, ouvrez le fichier
`akiya-radar/backend/app/data/source_catalog.json` sur GitHub et utilisez la
recherche du navigateur (Ctrl+F) avec le nom japonais de la commune.

> **Variante plus simple** : au lieu de `AKIYA_STATIC_SOURCES`, créez la
> variable `AKIYA_STATIC_PREFECTURE` avec une préfecture entière (par exemple
> `福井県`). Toutes ses communes structurées seront collectées.

## A3 — Lancer la première publication

Onglet **Actions** → **« Akiya — site autonome (sans serveur) »** →
**Run workflow**.

Comptez 5 à 15 minutes selon le nombre de communes (l'application attend 1,5 s
entre deux requêtes vers un même site, par correction). À la fin, votre site est
en ligne à l'adresse indiquée dans l'onglet **Pages** — typiquement :

```
https://VOTRE-NOM.github.io/manga/
```

Ensuite, la collecte se relance **toute seule chaque matin**.

## A4 — Sauvegarder vos notes

Vos annotations vivent dans le navigateur. Pour les mettre à l'abri, ouvrez la
console du navigateur (F12 → *Console*) et tapez :

```js
copy(localStorage.getItem("akiya.local-state.v1"))
```

Collez le résultat dans un fichier texte que vous conservez. Pour restaurer sur
un autre appareil :

```js
localStorage.setItem("akiya.local-state.v1", `COLLEZ_ICI_LE_CONTENU`)
```

## A5 — Tester en local (facultatif)

```bash
cd akiya-radar/backend && pip install .
python scripts/build_static_dataset.py --sources athome-32528 --limit-per-source 10
cd ../frontend && npm ci && VITE_DATA_MODE=static npm run dev
```

---

# B · Mode serveur

Comptez **45 minutes** la première fois.

---

## Ce que vous allez obtenir

- Un site accessible depuis votre navigateur, où que vous soyez.
- Une base de **2 174 banques d'akiya officielles** (les 47 préfectures), dans
  laquelle vous choisissez les communes à surveiller.
- Une collecte **automatique tous les matins** des nouvelles annonces.
- Pour chaque bien : prix en yens **et** en euros au taux du jour, surface,
  année, plan, gare la plus proche, zonage, risques naturels officiels
  (inondation, tsunami, glissement de terrain, séisme), red flags et score.

---

## B0 — Comprendre le principe (2 minutes)

Il n'existe **aucune API publique** qui livrerait les akiya du Japon entier.
Chaque commune publie ses biens sur son propre site.

Akiya Radar fait donc ceci :

1. Il connaît l'adresse des 2 174 sites officiels (annuaire du ministère
   japonais MLIT + réseau At Home).
2. Vous choisissez les communes qui vous intéressent.
3. Chaque matin, il visite ces sites, lit les annonces, les traduit en données
   comparables, et les enrichit avec les données publiques japonaises.

> **Important** : parmi ces 2 174 sources, **842 sont « structurées »** — elles
> partagent un même gabarit de page, donc l'application en extrait une fiche
> complète automatiquement. Les autres sont des sites municipaux artisanaux :
> l'extraction y est partielle et il faut parfois compléter à la main.
> **Commencez par les sources structurées.**

---

## B1 — Louer un petit serveur (15 minutes)

Le site doit tourner sur une machine allumée en permanence. Un serveur
d'entrée de gamme suffit largement.

**Recommandation : [Hetzner Cloud](https://www.hetzner.com/cloud)**, environ
**4,50 €/mois** pour le modèle CX22 (2 vCPU, 4 Go de RAM).
(Alternatives équivalentes : Scaleway, OVH, DigitalOcean.)

1. Créez un compte, puis **New Project** → **Add Server**.
2. Choisissez :
   - **Location** : Nuremberg ou Helsinki (peu importe).
   - **Image** : **Ubuntu 24.04**.
   - **Type** : **CX22**.
   - **SSH Key** : si vous n'y connaissez rien, choisissez plutôt
     **Root password** et notez le mot de passe affiché.
3. Cliquez **Create & Buy now**.
4. Notez l'**adresse IP** affichée (par exemple `91.99.12.34`).
   Dans la suite du guide, remplacez `VOTRE_IP` par cette adresse.

### Se connecter au serveur

Ouvrez le **Terminal** (macOS : Applications → Utilitaires → Terminal ;
Windows : menu Démarrer → **PowerShell**), puis tapez :

```bash
ssh root@VOTRE_IP
```

Répondez `yes` à la question, puis saisissez le mot de passe.
Vous êtes maintenant « dans » le serveur : tout ce que vous taperez s'y exécute.

---

## B2 — Installer les outils (5 minutes)

Copiez-collez ce bloc entier, puis appuyez sur Entrée :

```bash
apt update && apt install -y docker.io docker-compose-plugin git
systemctl enable --now docker
```

Attendez la fin (environ 2 minutes). Vérifiez :

```bash
docker --version
```

Vous devez voir une ligne du type `Docker version 27.x`.

---

## B3 — Installer Akiya Radar (5 minutes)

```bash
git clone https://github.com/Yggdrazzil/manga.git
cd manga/akiya-radar
cp .env.example .env
```

### Régler la configuration

Un seul réglage est **obligatoire** : autoriser votre navigateur à parler au
serveur. Ouvrez le fichier de configuration :

```bash
nano .env
```

Utilisez les flèches du clavier pour trouver la ligne :

```
CORS_ORIGINS=http://localhost:5173
```

Remplacez-la par (avec votre vraie IP) :

```
CORS_ORIGINS=http://VOTRE_IP:5173
```

Pendant que vous y êtes, changez aussi ces deux lignes par des valeurs à vous :

```
POSTGRES_PASSWORD=choisissez-un-mot-de-passe-solide
JWT_SECRET=une-longue-phrase-aleatoire-quelconque
```

> Si vous changez `POSTGRES_PASSWORD`, reportez la même valeur dans la ligne
> `DATABASE_URL=` juste en dessous (entre `akiya:` et `@postgres`).

Enregistrez et quittez : **Ctrl+O**, **Entrée**, puis **Ctrl+X**.

### Démarrer

```bash
docker compose up -d --build
```

La première fois, comptez 3 à 5 minutes. Vérifiez que tout tourne :

```bash
docker compose ps
```

Les trois services (`postgres`, `backend`, `frontend`) doivent être `running`.

---

## B4 — Ouvrir le site

Dans votre navigateur : **`http://VOTRE_IP:5173`**

Vous arrivez sur le tableau de bord, avec quelques annonces de démonstration.

> **Rien ne s'affiche ?** Vérifiez le pare-feu de votre hébergeur : les ports
> **5173** et **8000** doivent être ouverts. Chez Hetzner : *Firewalls* →
> autoriser TCP 5173 et 8000.

---

## B5 — Choisir les communes à surveiller (10 minutes)

C'est l'étape qui transforme la démo en vrai catalogue.

1. Dans le menu, cliquez sur **Catalogue**.
2. Cochez **« Sources structurées uniquement »** — ce sont celles qui
   remplissent une fiche complète toute seule.
3. Filtrez par **préfecture** (par exemple `福井県` pour Fukui), ou tapez le nom
   d'une commune dans la recherche.
4. Cochez les communes qui vous intéressent.
5. Cliquez sur **« Ajouter + activer la collecte »**.

> **Combien en prendre ?** Commencez par **10 à 30 communes**. Vous pourrez en
> ajouter à tout moment. Trop de sources d'un coup rend la collecte longue et
> peu polie envers de petits sites municipaux.

Le bouton **« Ajouter (sans crawl) »** enregistre la source sans la visiter :
utile pour garder un site sous la main sans le collecter automatiquement.

Dans l'onglet **Sources**, vous pouvez activer ou désactiver la collecte
d'une source à tout moment en cliquant sur la pastille « activé / désactivé ».

---

## B6 — Lancer la collecte automatique (10 minutes)

La collecte tourne sur GitHub, gratuitement, tous les matins à 6 h heure du
Japon.

1. Allez sur votre dépôt GitHub → **Settings** → **Secrets and variables** →
   **Actions**.
2. Cliquez **New repository secret** et créez :
   - **Name** : `AKIYA_API_BASE`
   - **Secret** : `http://VOTRE_IP:8000`
3. Cliquez **Add secret**.

### Tester tout de suite

Onglet **Actions** → **« Akiya — ingestion quotidienne »** → bouton
**Run workflow**. Après quelques minutes, retournez sur votre site, onglet
**Annonces** : les vraies annonces apparaissent.

### Si vous préférez ne pas passer par GitHub

Vous pouvez faire tourner la collecte sur le serveur lui-même :

```bash
cd /root/manga/akiya-radar
(crontab -l 2>/dev/null; echo "0 21 * * * cd /root/manga/akiya-radar/worker && AKIYA_API_BASE=http://localhost:8000 python3 -m worker.ingest >> /var/log/akiya-ingest.log 2>&1") | crontab -
```

---

## B7 (optionnelle) — Les comparables de prix

Pour afficher les prix de transactions réelles à côté de chaque bien, il faut
une clé API **gratuite** du ministère japonais :

1. Demandez-la sur <https://www.reinfolib.mlit.go.jp/api/request/>
   (réponse sous environ 5 jours ouvrés).
2. Une fois reçue, sur le serveur :

```bash
cd /root/manga/akiya-radar
nano .env
```

Renseignez `MLIT_API_KEY=votre_cle`, enregistrez (Ctrl+O, Entrée, Ctrl+X), puis :

```bash
docker compose restart backend
```

Tout le reste (géocodage, altitude, risques naturels, taux de change)
fonctionne **sans aucune clé**.

---

## Utilisation au quotidien

| Ce que vous voulez faire | Où |
|---|---|
| Voir les nouveautés | **Tableau de bord** |
| Filtrer, trier, exporter en CSV | **Annonces** |
| Ajouter une annonce trouvée ailleurs | **Importer** (collez l'URL) |
| Vérifier les risques naturels d'un bien | Fiche du bien → **« Vérifier les risques »** |
| Ajouter des communes | **Catalogue** |
| Sauvegarder une recherche | **Recherches** |

### Les prix en euros

Les yens sont la seule valeur publiée par les sources, donc la seule stockée.
La conversion est faite **au moment de l'affichage**, au taux du jour récupéré
automatiquement (BCE via Frankfurter, avec un second fournisseur en secours).
Un bien collecté il y a six mois affiche donc le prix d'aujourd'hui, pas celui
du jour de sa découverte.

Vous pouvez changer la devise dans **Réglages** (EUR, USD, ou yens seuls) : tous
les prix de l'application suivent immédiatement. Si aucun fournisseur n'est
joignable, l'application le signale par la mention « taux indicatif » plutôt que
de faire passer un taux figé pour le taux du jour.

### Comprendre la « complétude »

Chaque fiche affiche un pourcentage de complétude. Les sources sont inégales :
certaines publient un tableau complet, d'autres trois lignes de texte.

- **Fiche complète (≥ 80 %)** : comparable en confiance.
- **Fiche partielle (50-79 %)** : il manque des informations clés.
- **Fiche très incomplète (< 50 %)** : à vérifier sur le site d'origine avant
  toute conclusion. Un prix bas sur une fiche vide ne veut rien dire.

### Comprendre les risques naturels

- **« Hors zone »** : la carte officielle couvre ce point et n'y cartographie
  aucun aléa.
- **« Non vérifié »** : la donnée n'a pas pu être consultée. **Ce n'est pas une
  absence de risque.**

---

## Entretien

**Mettre à jour l'application :**

```bash
cd /root/manga && git pull && cd akiya-radar && docker compose up -d --build
```

**Sauvegarder la base (à faire de temps en temps) :**

```bash
cd /root/manga/akiya-radar
docker compose exec -T postgres pg_dump -U akiya akiya_radar > ~/akiya-sauvegarde-$(date +%F).sql
```

Récupérez ensuite le fichier sur votre ordinateur (depuis **votre** machine, pas
depuis le serveur) :

```bash
scp root@VOTRE_IP:~/akiya-sauvegarde-*.sql .
```

**Voir ce qui se passe / diagnostiquer :**

```bash
cd /root/manga/akiya-radar
docker compose logs -f backend
```

(Ctrl+C pour quitter l'affichage.)

---

## Aller plus loin : un vrai nom de domaine en HTTPS

Tant que vous utilisez `http://VOTRE_IP:5173`, la connexion n'est pas chiffrée
et le navigateur affiche « Non sécurisé ». Pour un usage personnel derrière une
IP connue de vous seul, c'est acceptable. Pour faire mieux :

1. Achetez un domaine (~10 €/an chez OVH, Gandi, Namecheap).
2. Créez un enregistrement **A** pointant vers `VOTRE_IP`.
3. Installez Caddy, qui obtient et renouvelle le certificat tout seul :

```bash
apt install -y caddy
echo "votre-domaine.fr {
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy localhost:8000
    }
    reverse_proxy localhost:5173
}" > /etc/caddy/Caddyfile
systemctl restart caddy
```

4. Dans `.env`, remplacez `CORS_ORIGINS` par `https://votre-domaine.fr`, puis
   `docker compose restart backend`.

---

## Les sites en JavaScript

Certaines sources (家いちば notamment) ne fonctionnent qu'avec JavaScript : la
page reçue est vide, le contenu n'apparaît qu'une fois le code exécuté par un
navigateur. L'application sait le faire, mais c'est **beaucoup plus lent**
(quelques secondes par annonce au lieu de quelques dizaines de millisecondes).

- Dans le **Catalogue**, ces sources portent l'étiquette « navigateur requis ».
- Sur une fiche, la mention « page reconstituée dans un navigateur » indique que
  l'annonce vient d'un site de ce type. Ces sites changent souvent de structure :
  en cas de doute sur un chiffre, ouvrez la fiche d'origine.
- En mode serveur, installez le navigateur une fois : `python -m playwright
  install chromium` dans le conteneur backend (ou `docker compose exec backend
  python -m playwright install chromium`). Sans lui, ces sources sont simplement
  ignorées, rien d'autre ne change.

**Ce que l'application ne fait pas** : contourner une protection anti-robot.
Un site qui refuse explicitement les robots (LIFULL HOME'S répond 403) reste
consultable à la main, jamais collecté automatiquement.

---

## Règles de bonne conduite

L'application respecte `robots.txt`, s'identifie clairement, espace ses
requêtes (1,5 s entre deux visites d'un même site) et plafonne le nombre
d'annonces prises par source et par passage. Ne réduisez pas ces marges : les
banques d'akiya sont souvent hébergées par de petites mairies, et un usage
personnel raisonnable est la condition pour que cela reste possible.

Ne collectez pas de plateformes payantes, et n'essayez jamais de contourner une
protection anti-robot.

---

## En cas de problème

| Symptôme | Solution |
|---|---|
| Le site ne s'affiche pas | Ouvrez les ports 5173 et 8000 chez l'hébergeur |
| Page blanche / « Failed to fetch » | `CORS_ORIGINS` ne correspond pas à l'adresse tapée dans le navigateur |
| Aucune annonce après la collecte | Vérifiez qu'au moins une source a le crawl **activé** (onglet Sources) |
| Le workflow GitHub ne fait rien | Le secret `AKIYA_API_BASE` est absent ou mal orthographié |
| Un site affiche une erreur dans Sources | Ce site a changé de structure ou bloque les robots — désactivez-le |
| Tout redémarrer | `docker compose down && docker compose up -d` |

Les sources principales de ce catalogue, si vous voulez les consulter
directement :

- Annuaire officiel MLIT : <https://www.mlit.go.jp/totikensangyo/const/akiyabank_link.html>
- At Home 空き家バンク : <https://www.akiya-athome.jp/>
- LIFULL HOME'S 空き家バンク : <https://www.homes.co.jp/akiyabank/>
