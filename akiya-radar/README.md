# 空き家 Akiya Radar

Cockpit personnel pour **rechercher, centraliser, traduire, scorer et suivre**
des maisons vacantes (空き家 / akiya / kominka) au Japon — sans plateforme
payante, sans Supabase, sans LLM payant obligatoire.

> Outil privé d'aide à la recherche immobilière. Il ne republie pas d'annonces
> et ne prétend pas à l'exactitude des données sources.

**Mise en production pas-à-pas (sans savoir coder) : [MISE_EN_SERVICE.md](MISE_EN_SERVICE.md).**

Deux modes de fonctionnement :

- **Autonome (0 €)** — `VITE_DATA_MODE=static`. Aucun serveur, aucune base : la
  collecte tourne dans GitHub Actions, le résultat est un JSON servi par GitHub
  Pages, et les données personnelles vivent dans le navigateur. Possible parce
  que toutes les API publiques japonaises utilisées envoient
  `Access-Control-Allow-Origin: *` — seule la collecte, qu'un navigateur ne peut
  pas faire lui-même, a besoin de la CI.
- **Serveur** — FastAPI + PostgreSQL/PostGIS : import par URL, catalogue
  interactif, comparables MLIT, données partagées entre appareils.

## Stack

| Couche    | Technologies |
|-----------|--------------|
| Frontend  | React · TypeScript · Vite · Tailwind · TanStack Query · React Router · Leaflet · Vitest |
| Backend   | FastAPI · SQLAlchemy 2 · Alembic · Pydantic · pytest · Ruff |
| Base      | PostgreSQL + PostGIS |
| Worker    | Python · requests · BeautifulSoup (architecture par adapters) |
| Infra     | Docker Compose |

## Démarrage rapide (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Services :

- Frontend → http://localhost:5173
- Backend API → http://localhost:8000 (Swagger : http://localhost:8000/docs)
- Health → http://localhost:8000/health
- PostgreSQL+PostGIS → port 5432

Au premier démarrage, le backend applique les migrations puis injecte
**10 annonces japonaises fictives** réalistes (prix, surfaces, texte japonais,
red flags, score, coordonnées). Mettez `SEED_ON_START=false` pour désactiver.

## Développement local (sans Docker)

### Backend

```bash
cd backend
uv venv .venv && source .venv/bin/activate
uv pip install -e ".[dev]"
export DATABASE_URL="postgresql+psycopg://akiya:akiya_dev_password@localhost:5432/akiya_radar"
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

Tests :

```bash
# Logique pure (aucune base requise)
pytest tests/test_red_flags.py tests/test_scoring.py tests/test_parsing.py tests/test_dedupe.py
# Tests API (nécessitent une base PostGIS de test)
export TEST_DATABASE_URL="postgresql+psycopg://akiya:akiya_dev_password@localhost:5432/akiya_radar"
pytest
ruff check app tests
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxy /api → http://localhost:8000)
npm test             # Vitest
npm run build        # typecheck + build de production
```

### Worker

```bash
cd worker
uv venv .venv && source .venv/bin/activate
uv pip install -e ".[dev]"
pytest
python -m worker     # mode idle MVP (pas de crawl réel)
```

## Fonctionnalités (MVP / Livrable 1)

- **Dashboard** : stats, top opportunités, derniers ajoutés.
- **Annonces** : liste filtrable (préfecture, prix, surfaces, score, favoris,
  exclusion des red flags critiques), tri, pagination.
- **Fiche détail** : source officielle, texte japonais + traduction, prix
  (¥/€), surfaces, carte, **red flags expliqués**, **score détaillé et
  transparent**, notes, tâches, **checklist due diligence**, historique prix.
- **Carte** : marqueurs colorés par score, distinction
  exact / approximatif / ville seulement (jamais une position fausse comme
  exacte).
- **Import d'URL** : récupération réelle de la page si joignable (robots.txt
  respecté, timeout borné, user-agent clair) et extraction automatique
  (titre, prix, surfaces, plan, année, adresse → préfecture/ville) ; retombe
  toujours sur une fiche éditable si l'extraction échoue ; correction manuelle,
  red flags + score recalculés.
- **Détection de doublons** : à l'import et sur la fiche, « doublon possible »
  est signalé (URL, contenu, géo) avec lien vers le bien existant — **jamais**
  de fusion automatique.
- **Sources**, **Recherches sauvegardées**, **Réglages**.

## Données publiques réelles (enrichissement)

| Source | Accès | Ce qu'elle apporte |
|--------|-------|--------------------|
| [GSI 国土地理院](https://msearch.gsi.go.jp/address-search/AddressSearch) | Gratuit, sans clé | Géocodage des adresses japonaises (automatique à l'import, bouton sur la fiche). La précision est toujours affichée honnêtement (approximatif / ville). |
| [J-SHIS 防災科研](https://www.j-shis.bosai.go.jp/api-pshm-meshinfo) | Gratuit, sans clé | **Risque sismique officiel vérifié** par coordonnées (probabilité de secousse ≥ shindo 5強 sous 30 ans). Alimente le score « risques naturels ». |
| [MLIT 不動産情報ライブラリ](https://www.reinfolib.mlit.go.jp/help/apiManual/) | Clé gratuite ([demande](https://www.reinfolib.mlit.go.jp/api/request/)) | Prix de transaction réels (XIT001) → tableau de comparables + prix médian au m² sur la fiche. Sans clé, l'app explique comment l'obtenir. |
| [Hazard Map Portal 重ねるハザードマップ](https://disaportal.gsi.go.jp/) | Gratuit, sans clé | **Inondation, tsunami, submersion marine et glissement de terrain** au point exact, par échantillonnage des tuiles raster officielles. Distingue « hors zone cartographiée » de « non vérifié ». |
| [GSI élévation](https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php) | Gratuit, sans clé | Altitude du terrain (DEM 5 m) — signal décisif sur le risque de submersion. |
| [OpenStreetMap Overpass](https://overpass-api.de/) | Gratuit, sans clé | Gare ferroviaire la plus proche (nom, distance, opérateur) — à la demande, jamais en masse. Bascule automatiquement entre plusieurs miroirs. |
| Taux de change ([Frankfurter/BCE](https://api.frankfurter.dev/), [exchangerate-api](https://open.er-api.com/)) | Gratuit, sans clé | Taux JPY→EUR réel (cache 6 h, plusieurs fournisseurs en cascade, repli statique hors ligne). |

**Garde-fou géographique** : chaque géocodage est validé par le géocodeur
*inverse* GSI — un point qui ne résout pas vers une adresse japonaise (mer,
hors Japon) est rejeté. Plus de marqueurs dans l'eau.

## Catalogue de sources (2 174 banques d'akiya réelles)

Il n'existe **aucune API publique** listant les akiya du Japon. L'application
embarque donc un catalogue construit depuis deux annuaires officiels
(`backend/app/data/source_catalog.json`, régénérable via
`python scripts/build_source_catalog.py`) :

| Origine | Volume | Rôle |
|---------|--------|------|
| [Annuaire MLIT 空き家バンク リンク集](https://www.mlit.go.jp/totikensangyo/const/akiyabank_link.html) | ~1 300 | Sites municipaux officiels, une commune = une page, mise en forme libre |
| [Réseau アットホーム 空き家バンク](https://www.akiya-athome.jp/) | 842 | Un sous-domaine par commune, **gabarit identique** → extraction structurée fiable |
| [LIFULL HOME'S 空き家バンク](https://www.homes.co.jp/akiyabank/) | national | Consultation manuelle : le site répond 403 aux robots |
| Portails **préfectoraux** (ふくい空き家情報バンク, 北海道空き家情報バンク, Re:BARAKI…) | 10 | Un site, plusieurs communes — le meilleur rapport couverture/effort |
| [家いちば](https://www.ieichiba.com/) | national | Ventes entre particuliers, souvent absentes des banques municipales. Site en JavaScript → collecté via rendu navigateur |

Couverture : **47 préfectures**. La page **Catalogue** permet de filtrer par
préfecture, de ne garder que les sources structurées, et de les enregistrer en
un clic. Le crawl reste **opt-in par source**.

### Sites en JavaScript

Une part croissante des sources sert une coquille HTML vide dont le contenu
n'existe qu'après exécution du JavaScript (家いちば est une application Nuxt).
`services/dynamic_fetcher.py` les charge dans un vrai navigateur via
[Scrapling](https://github.com/D4Vinci/Scrapling), et le DOM rendu repart dans
le même pipeline d'extraction que les autres sources.

- **Escalade, jamais par défaut** : une requête HTTP simple d'abord ; le
  navigateur ne démarre que si la réponse est une coquille vide (détection par
  marqueur de framework *et* corps sans texte), ou si la source est connue comme
  telle (`requires_js`). Un lancement de navigateur coûte ~100× un GET.
- **Rendu uniquement, pas de contournement.** Scrapling embarque aussi des
  fetchers furtifs conçus pour passer pour un visiteur humain : ils restent
  inutilisés. Le référent Google factice qu'il envoie par défaut est désactivé,
  robots.txt est respecté à l'identique, et le user-agent reste identifiable.
  Un site qui répond 403 aux robots (LIFULL HOME'S) reste hors périmètre.
- Le mode retenu par fiche (`static` / `rendered`) est stocké et affiché.

Sur du markup de SPA, l'extraction ne peut plus compter sur des tableaux : elle
lit aussi le **JSON-LD schema.org** (souvent présent pour le référencement) et
les paires libellé/valeur en `<div>`/`<span>` adjacents.

### Données hétérogènes → une seule forme

Chaque source nomme et formate les mêmes faits différemment (`価格` /
`販売価格` / `譲渡価格`, `2,250万円` / `応相談`). `services/normalize.py` est le
point unique où cela devient exploitable :

- **Vocabulaire fermé** — `property_type` et `transaction_type` ne contiennent
  jamais de japonais brut.
- **Loyer séparé du prix** — un loyer mensuel n'atterrit jamais dans
  `price_yen`, où il écraserait tout classement par prix.
- **Provenance** — chaque champ normalisé conserve le libellé et le texte
  japonais d'origine, consultables sur la fiche.
- **Complétude 0-100** — l'interface distingue « pas cher » de « on ne sait
  presque rien », au lieu d'afficher des blancs convaincants.

Distinction importante : un **red flag** signifie « l'annonce *mentionne* ce
terme » (analyse du texte source) ; le bloc « risques vérifiés » de la fiche
provient de **données officielles** interrogées par coordonnées.

## Détection de red flags (extrait)

Critiques : `再建築不可` (reconstruction impossible), `借地権` (bail foncier),
`市街化調整区域` (zone contrôlée), `農地`, `未登記`, `越境`, `共有持分`,
`土砂災害警戒区域`, `津波浸水想定区域`, `洪水浸水想定区域`.
Travaux : `雨漏り`, `シロアリ`, `傾き`, `老朽化`, `要修繕`, `浄化槽`, …
Statuts : `商談中`, `成約済み`, `売買`, `賃貸`, `譲渡`.

Glossaire complet : [`shared/glossary.json`](shared/glossary.json).

## Scoring (sur 100)

Prix 20 · Localisation 20 · Risques naturels 20 · Risques juridiques 15 ·
Travaux 15 · Fit personnel 10, plus un **score de confiance** distinct (un bien
*incertain faute de données* ≠ un *mauvais* bien). Chaque score est expliqué
(points positifs / négatifs).

## Ingestion quotidienne (GitHub Actions)

Le workflow [`.github/workflows/akiya-daily-ingest.yml`](../.github/workflows/akiya-daily-ingest.yml)
(racine du dépôt) s'exécute chaque jour (06:00 JST) et peut être lancé à la
main (`workflow_dispatch`). Il installe le worker et exécute
`python -m worker.ingest`, qui :

1. récupère les pages *index* des sources `crawl_enabled` (via l'API backend)
   ou les listes fournies par secret ;
2. découvre les liens de fiches (robots.txt respecté) ;
3. appelle `POST /listings/import-url` pour chaque fiche — le backend
   télécharge, extrait (dont les **photos**), déduplique, score et stocke ;
4. **rafraîchit chaque annonce connue** (`POST /listings/{id}/refresh`) :
   une page 404/410 → statut `gone` (l'annonce est **marquée, jamais
   supprimée** — notes et historique restent) ; 成約済み → `sold` ;
   商談中 → `under_negotiation` ; changement de prix → historisé. Une erreur
   réseau ne change jamais le statut. Désactivable via `AKIYA_REFRESH=false`.

Secrets à définir (Settings → Secrets and variables → Actions) :

| Secret | Rôle |
|--------|------|
| `AKIYA_API_BASE` | URL du backend déployé (ex. `https://akiya.mondomaine.fr`). **Sans lui, le job ne fait rien.** |
| `AKIYA_ADMIN_TOKEN` | (option) JWT si `AUTH_ENABLED=true`. |
| `AKIYA_SOURCE_INDEX_URLS` | (option) pages index à crawler, séparées par virgules/sauts de ligne. |
| `AKIYA_WATCH_URLS` | (option) fiches précises à surveiller. |

En local : `cd worker && AKIYA_API_BASE=http://localhost:8000 \
AKIYA_SOURCE_INDEX_URLS=… python -m worker.ingest`.

## Sécurité

CORS strict, validation Pydantic, ORM (pas d'injection SQL), aucun secret côté
frontend, mot de passe admin hashé (bcrypt), auth JWT optionnelle
(`AUTH_ENABLED`). Le worker respecte robots.txt et les limites de fréquence ;
aucun contournement anti-bot. Voir [`CLAUDE.md`](CLAUDE.md).

## Sauvegarde PostgreSQL

```bash
docker compose exec postgres pg_dump -U akiya akiya_radar > backup_$(date +%F).sql
# Restauration
cat backup.sql | docker compose exec -T postgres psql -U akiya akiya_radar
```

## Roadmap

1. ✅ Squelette : API, base, frontend, données mock, red flags, scoring, carte.
2. ✅ Import réel (fetch + extraction, robots.txt), détection de doublons
   exposée, correction manuelle, filtres, notes/favoris/statuts, checklist.
3. Worker d'ingestion réel (adapters municipaux), historique prix, crawl admin.
4. Enrichissement public : MLIT (prix de transaction), hazard maps, OSM (gare),
   J-SHIS (sismique), recherches sauvegardées + alertes SMTP, export CSV.
