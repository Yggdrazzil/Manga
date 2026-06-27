# Akiya Radar — Instructions projet (Claude)

## Vision produit
Cockpit **personnel** de recherche immobilière au Japon : importer, traduire,
détecter les pièges (red flags), scorer, cartographier, annoter et suivre des
akiya. Pas de plateforme payante, pas de Supabase, pas de LLM payant
obligatoire. D'abord un cockpit robuste sur données mock ; le scraping réel vient
ensuite.

## Architecture
Monorepo :

```
akiya-radar/
  frontend/   React + TS + Vite + Tailwind + TanStack Query + Leaflet
  backend/    FastAPI + SQLAlchemy 2 + Alembic + Pydantic (+ PostGIS)
  worker/     Python + requests + BeautifulSoup (adapters d'ingestion)
  shared/     glossaire japonais partagé
  docker-compose.yml
```

- **backend/app/services/** : `red_flags.py`, `scoring.py`, `parsing.py`,
  `dedupe.py`, `providers.py`, `listing_ops.py` — logique pure, testée.
- **backend/app/routers/** : un router par domaine (listings, sources, notes,
  tasks, saved_searches, dashboard, auth, health).
- **worker/worker/adapters/** : `SourceAdapter` + adapters (generic municipal,
  manual fallback, placeholders par source).

## Commandes
- Tout lancer : `docker compose up --build`
- Backend tests : `cd backend && pytest` (API tests requièrent
  `TEST_DATABASE_URL`)
- Frontend : `cd frontend && npm test && npm run build`
- Worker tests : `cd worker && pytest`
- Lint : `ruff check` (Python), `tsc -b` (front)

## Règles de scraping (worker)
1. Respecter robots.txt et les CGU.
2. Limiter la fréquence ; user-agent clair (`AkiyaRadarBot/0.1`).
3. Gérer les erreurs **par source** : une source qui échoue ne bloque pas le job.
4. Jamais de contournement anti-bot, captcha, proxy rotation.
5. Pas de scraping de plateformes payantes.
6. Historiser prix et statuts ; dédupliquer sans fusion automatique incertaine.
7. MVP : fixtures HTML + import manuel uniquement, pas de crawl massif.

## Règles de scoring
- 100 points : Prix 20 · Localisation 20 · Risques naturels 20 · Juridique 15 ·
  Travaux 15 · Fit 10.
- Toujours **explicable** (points positifs / négatifs), jamais une note brute.
- `confidence_score` séparé : distinguer *incertain* de *mauvais*.

## Glossaire japonais
Source de vérité du code : `backend/app/services/red_flags.py`. Copie partagée :
`shared/glossary.json`. Ne jamais ignorer : `再建築不可`, `借地権`,
`市街化調整区域`, risques naturels, statuts vendu/négociation.

## Règles de sécurité
- Aucun secret côté frontend ; variables d'environnement uniquement.
- CORS strict ; validation Pydantic ; ORM (pas de SQL brut concaténé).
- Mot de passe admin **hashé** (bcrypt) ; JWT optionnel (`AUTH_ENABLED`).
- Pas de stockage de credentials tiers ; logs sans données sensibles.
- Sauvegarde PostgreSQL documentée (README).

## Conventions de code
- Python : type hints, fonctions pures testables, Ruff (E,F,I,UP,B).
- TypeScript strict ; ES modules ; imports destructurés ; composants à
  responsabilité unique ; états loading/empty/error/success gérés.
- UI : esthétique « encre sur papier » (manga), jamais Inter/Roboto/system-ui ;
  `prefers-reduced-motion` respecté ; cibles tactiles ≥ 44px ; contraste AA.

## Règles métier à ne jamais violer
1. Toujours conserver l'URL source et le **texte japonais original**.
2. Ne pas afficher une localisation approximative comme exacte.
3. Ne pas fusionner automatiquement un doublon incertain → afficher « possible
   duplicate ».
4. Un import ne doit **jamais** échouer complètement : au minimum une fiche
   éditable avec l'URL.
5. Un prix bas ne suffit pas : exposer les red flags et la confiance.

## Étapes MVP
1. ✅ Squelette complet (ce livrable) : API + base PostGIS + frontend + 10 mocks
   + red flags + scoring + carte + tests.
2. Import/correction, filtres, notes/favoris/statuts, checklist due diligence.
3. Worker d'ingestion réel + dédup + historique + crawl manuel admin.
4. Enrichissement MLIT / hazard maps / OSM / J-SHIS, recherches + alertes,
   export CSV, comparaison côte à côte.
