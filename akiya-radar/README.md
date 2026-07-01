# 空き家 Akiya Radar

Cockpit personnel pour **rechercher, centraliser, traduire, scorer et suivre**
des maisons vacantes (空き家 / akiya / kominka) au Japon — sans plateforme
payante, sans Supabase, sans LLM payant obligatoire.

> Outil privé d'aide à la recherche immobilière. Il ne republie pas d'annonces
> et ne prétend pas à l'exactitude des données sources.

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
   télécharge, extrait, déduplique, score et stocke.

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
