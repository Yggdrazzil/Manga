/**
 * Plafonnement du cache de planches téléchargées.
 *
 * Les pages lues sont écrites sur disque par les lecteurs Webtoon et MANGA
 * Plus (téléchargement + déchiffrement XOR), hors du cache d'expo-image.
 * Rien ne les effaçait : ~20 tranches de ~300 Ko par épisode, soit plus d'un
 * gigaoctet après quelques centaines d'épisodes, sans que l'utilisateur ne
 * puisse le relier à l'app.
 *
 * On garde donc les N chapitres consultés le plus récemment et on supprime le
 * reste — les planches sont retéléchargeables, contrairement aux
 * téléchargements hors-ligne explicites, qui vivent ailleurs et ne sont jamais
 * touchés ici.
 */

import { Directory, Paths } from 'expo-file-system';
import { logger } from './logger';

/** Nombre de chapitres conservés par source. */
export const MAX_CACHED_CHAPTERS = 40;

/**
 * Supprime les répertoires de chapitres les plus anciens au-delà de la limite.
 * Best-effort : une erreur de système de fichiers ne doit jamais empêcher la
 * lecture en cours.
 */
export function pruneChapterCache(cacheDirName: string, keep = MAX_CACHED_CHAPTERS): void {
  try {
    const root = new Directory(Paths.cache, cacheDirName);
    if (!root.exists) return;

    const chapters = root
      .list()
      .filter((item): item is Directory => item instanceof Directory);
    if (chapters.length <= keep) return;

    // `modificationTime` est exposé par info(), pas par l'instance, et peut
    // manquer selon la plateforme : ces répertoires passent en dernier, donc
    // seront supprimés en premier — acceptable, leur contenu se retélécharge.
    const withTime = chapters.map(dir => {
      let at = 0;
      try {
        at = dir.info().modificationTime ?? 0;
      } catch {
        at = 0;
      }
      return { dir, at };
    });
    withTime.sort((a, b) => b.at - a.at);

    for (const { dir } of withTime.slice(keep)) {
      try {
        dir.delete();
      } catch {
        // un répertoire verrouillé ne doit pas interrompre le nettoyage
      }
    }
  } catch (e) {
    logger.warn('Page cache prune failed', { dir: cacheDirName, error: String(e) });
  }
}

/** Répertoires de cache de planches, pour le nettoyage manuel des réglages. */
export const PAGE_CACHE_DIRS = ['webtoon-pages-v2', 'webtoon-pages', 'mangaplus-pages'];
