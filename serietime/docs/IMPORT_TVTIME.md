# Import ZIP TV Time

L'import est **critique** : il doit être robuste, tolérant et vérifiable. Il fonctionne depuis le
navigateur desktop, la PWA Android et l'APK.

## Ce qui est récupéré

Séries suivies / en cours / pas commencées / abandonnées, films vus et non vus, watchlist,
favoris (séries et films), listes personnelles, épisodes vus avec dates de visionnage, notes et
statuts, ainsi que les identifiants externes présents (TVDB / TMDb / IMDb).

## Sécurité (serveur)

- Taille max configurable (`MAX_IMPORT_ZIP_SIZE_MB`, défaut 100 Mo) ; upload en streaming.
- Refus des fichiers non-ZIP (vérification de la signature `PK`).
- Calcul **SHA-256** ; un ZIP déjà importé est refusé sauf réimport explicite (`?force=true`).
- **Protection Zip Slip** : les entrées à chemin absolu ou contenant `..` sont ignorées ; aucun
  fichier n'est jamais extrait sur le disque ni exécuté.
- Seuls les fichiers `.json`, `.csv`, `.txt` sont parsés.
- Archive conservée dans `data/imports/{importId}/original.zip`, parsing dans `parsed-files.json`,
  rapport dans `import-report.json`.

## Détection tolérante

Aucun format unique n'est supposé. Tous les fichiers sont scannés et classés par mots-clés de
nom **et** de colonnes (`detectFileKind`) : séries, épisodes vus, films, watchlist, favoris,
notes, listes, profil. Les colonnes sont reconnues via un large jeu d'alias
(`title`/`name`/`show_name`/`movie_title`, `season_number`, `episode_number`, `watched_at`,
`rating`, `tvdb_id`/`tmdb_id`/`imdb_id`, `url`…). Les codes `S01E13` inline sont tolérés, et les
identifiants sont aussi extraits des URLs TV Time (`/show/…`, `/movie/…`).

Fonctions de normalisation (dans `packages/core`, testées unitairement) :
`normalizeImportedMedia`, `normalizeImportedEpisode`, `normalizeTitle`, `extractExternalIds`,
`detectMediaType`.

## Matching et score

Priorité : ID TVDB > ID TMDb > ID IMDb > URL TV Time exploitable > titre + année > titre localisé
> titre original > titre seul > résolution manuelle.

| Score | Signification                    | Décision                        |
|-------|----------------------------------|---------------------------------|
| 100   | ID externe exact                 | import automatique              |
| 90    | titre exact + année exacte       | import automatique              |
| 80    | titre exact + année ± 1          | import automatique (à vérifier) |
| 70    | titre proche + année exacte      | import automatique (à vérifier) |
| 50    | titre proche sans année          | résolution manuelle             |
| < 50  | insuffisant                      | résolution manuelle             |

`score ≥ 90` → auto ; `70–89` → auto avec drapeau « à vérifier » ; `< 70` → résolution manuelle.
Quand une clé TMDb est configurée, des suggestions TMDb enrichissent le matching. Sans clé, un
média est créé localement à partir des données importées (l'app reste utilisable sans TV Time ni
TMDb après import).

## Parcours utilisateur

1. **Choisir un fichier .zip** puis **Analyser**.
2. Barre de progression d'upload, puis étapes d'analyse (lecture ZIP → détection → séries →
   épisodes → films → matching).
3. **Rapport** : séries / films / épisodes / notes / favoris / listes détectés, et compteurs
   *import automatique*, *à vérifier*, *non reconnus*, *doublons ignorés*.
4. **Importer** applique les mappings résolus. **Voir les éléments à résoudre** ouvre la
   résolution manuelle.

## Résolution manuelle

Pour chaque élément non reconnu : titre importé, type, année, IDs, score et suggestions (posters).
Actions : **Choisir** une suggestion, **Rechercher** (recherche locale + TMDb), **Créer
manuellement** (média créé depuis les données importées) ou **Ignorer**. Résoudre après un import
déjà confirmé applique immédiatement l'élément.

## Endpoints

```txt
POST /api/import/tvtime/upload                 (multipart, ?force=true pour réimporter)
POST /api/import/tvtime/:id/analyze
POST /api/import/tvtime/:id/confirm
GET  /api/import/tvtime/:id
GET  /api/import/tvtime/:id/unresolved
POST /api/import/tvtime/:id/resolve            { mappingId, mediaId | tmdbId | create }
POST /api/import/tvtime/:id/ignore             { mappingId }
GET  /api/import/tvtime/:id/report
```

## Tests

`apps/server/src/__tests__/api.test.ts` couvre un ZIP TV Time synthétique de bout en bout : refus
non-ZIP, refus de doublon, détection (séries/films/épisodes/doublons/favoris/listes), non-résolus,
confirmation, résolution manuelle, puis vérification que séries, films, listes et progression
apparaissent correctement.
