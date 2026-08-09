/**
 * Regroupement et formatage de dates en français.
 *
 * Porté de PlotTime (packages/core/src/dates/groups.ts), adapté au suivi de
 * lecture. Le point clé est de raisonner en JOURS CALENDAIRES et non en écart
 * d'heures : un chapitre publié hier à 23h ne doit pas s'afficher
 * « AUJOURD'HUI » parce qu'il date de moins de 24 h.
 *
 * `now` est toujours un paramètre explicite pour rester testable.
 */

const DAY_NAMES = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];

const MONTH_SHORT = [
  'JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN',
  'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.',
];

const MONTH_LOWER = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Libellé de section pour une sortie passée :
 * AUJOURD'HUI · HIER · AVANT-HIER · jour de la semaine (< 7 j) · "12 FÉVR. 2026".
 *
 * Une date future (horloge décalée, publication programmée) retombe sur
 * AUJOURD'HUI plutôt que d'inventer une section « demain » dans un fil de
 * sorties déjà parues.
 */
export function releaseGroupLabel(iso: string, now: Date = new Date()): string {
  const date = parseDate(iso);
  if (!date) return 'DATE INCONNUE';

  const target = startOfDay(date);
  const today = startOfDay(now);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (diffDays <= 0) return "AUJOURD'HUI";
  if (diffDays === 1) return 'HIER';
  if (diffDays === 2) return 'AVANT-HIER';
  if (diffDays < 7) return DAY_NAMES[target.getDay()] ?? '';
  return `${target.getDate()} ${MONTH_SHORT[target.getMonth()]} ${target.getFullYear()}`;
}

/** Clé de tri décroissant des sections produites par releaseGroupLabel. */
export function releaseGroupRank(iso: string, now: Date = new Date()): number {
  const date = parseDate(iso);
  if (!date) return Number.MAX_SAFE_INTEGER;
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );
  return Math.max(0, diffDays);
}

/** "12 févr. 2026" — vide si la date est invalide. */
export function formatShortDateFr(iso: string): string {
  const d = parseDate(iso);
  if (!d) return '';
  return `${d.getDate()} ${MONTH_LOWER[d.getMonth()]} ${d.getFullYear()}`;
}

/** "17:00" — vide si la date est invalide. */
export function formatTimeHHMM(iso: string): string {
  const d = parseDate(iso);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Vrai si la date tombe sur le jour calendaire courant. */
export function isToday(iso: string, now: Date = new Date()): boolean {
  const d = parseDate(iso);
  if (!d) return false;
  return startOfDay(d).getTime() === startOfDay(now).getTime();
}

/**
 * Vrai pour une sortie du jour ou de la veille — sert au badge « NOUVEAU ».
 * Calendaire, donc stable dans la journée : un chapitre ne perd pas son badge
 * en plein milieu de l'après-midi.
 */
export function isRecentRelease(iso: string, now: Date = new Date()): boolean {
  const d = parseDate(iso);
  if (!d) return false;
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000,
  );
  return diffDays <= 1;
}
