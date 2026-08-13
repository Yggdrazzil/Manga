# Mettre Akiya Radar en service

Guide pas-à-pas pour rendre le site opérationnel et le faire récupérer
automatiquement les annonces des banques d'akiya japonaises.

**Aucune connaissance en programmation n'est nécessaire.** Vous allez copier des
commandes et les coller dans un terminal. Comptez **45 minutes** la première fois.

---

## Ce que vous allez obtenir

- Un site accessible depuis votre navigateur, où que vous soyez.
- Une base de **2 159 banques d'akiya officielles** (les 47 préfectures), dans
  laquelle vous choisissez les communes à surveiller.
- Une collecte **automatique tous les matins** des nouvelles annonces.
- Pour chaque bien : prix en yens **et** en euros au taux du jour, surface,
  année, plan, gare la plus proche, zonage, risques naturels officiels
  (inondation, tsunami, glissement de terrain, séisme), red flags et score.

---

## Étape 0 — Comprendre le principe (2 minutes)

Il n'existe **aucune API publique** qui livrerait les akiya du Japon entier.
Chaque commune publie ses biens sur son propre site.

Akiya Radar fait donc ceci :

1. Il connaît l'adresse des 2 159 sites officiels (annuaire du ministère
   japonais MLIT + réseau At Home).
2. Vous choisissez les communes qui vous intéressent.
3. Chaque matin, il visite ces sites, lit les annonces, les traduit en données
   comparables, et les enrichit avec les données publiques japonaises.

> **Important** : parmi ces 2 159 sources, **842 sont « structurées »** — elles
> partagent un même gabarit de page, donc l'application en extrait une fiche
> complète automatiquement. Les autres sont des sites municipaux artisanaux :
> l'extraction y est partielle et il faut parfois compléter à la main.
> **Commencez par les sources structurées.**

---

## Étape 1 — Louer un petit serveur (15 minutes)

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

## Étape 2 — Installer les outils (5 minutes)

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

## Étape 3 — Installer Akiya Radar (5 minutes)

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

## Étape 4 — Ouvrir le site

Dans votre navigateur : **`http://VOTRE_IP:5173`**

Vous arrivez sur le tableau de bord, avec quelques annonces de démonstration.

> **Rien ne s'affiche ?** Vérifiez le pare-feu de votre hébergeur : les ports
> **5173** et **8000** doivent être ouverts. Chez Hetzner : *Firewalls* →
> autoriser TCP 5173 et 8000.

---

## Étape 5 — Choisir les communes à surveiller (10 minutes)

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

## Étape 6 — Lancer la collecte automatique (10 minutes)

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

## Étape 7 (optionnelle) — Les comparables de prix

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
