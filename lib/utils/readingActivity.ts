import type { LibraryEntry } from '@/lib/types';

const DAY_MS = 86_400_000;
const DAY_LABELS_FR = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'] as const;

/**
 * Jour CALENDAIRE LOCAL au format 'YYYY-MM-DD'.
 *
 * `toISOString()` donnait le jour UTC : un chapitre lu à 00h30 à Paris était
 * comptabilisé la veille, et le graphe hebdomadaire étiquetait ses barres avec
 * le jour local tout en les remplissant avec des clés UTC — le libellé pouvait
 * donc désigner un autre jour que les données affichées.
 */
function toDateStr(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Aggregates reading events from chapterData readAt timestamps.
 * Returns 'YYYY-MM-DD' (jour local) → chapters read count for that day.
 */
export function getReadingActivity(entries: LibraryEntry[]): Record<string, number> {
  const activity: Record<string, number> = {};
  for (const entry of entries) {
    if (!entry.chapterData) continue;
    for (const note of Object.values(entry.chapterData)) {
      if (!note.readAt) continue;
      // readAt est un instant ISO (UTC) : on le ramène au jour vécu par le lecteur.
      const at = new Date(note.readAt);
      if (Number.isNaN(at.getTime())) continue;
      const date = toDateStr(at);
      activity[date] = (activity[date] ?? 0) + 1;
    }
  }
  return activity;
}

export interface ReadingStreak {
  /** Série en cours, terminée aujourd'hui ou hier (jour de grâce). */
  current: number;
  /** Plus longue série jamais réalisée — la donnée qui rend le suivi motivant. */
  best: number;
}

/**
 * Série de jours consécutifs de lecture.
 * `now` est un paramètre explicite pour rester déterministe et testable.
 */
export function getReadingStreak(
  activity: Record<string, number>,
  now: Date = new Date(),
): ReadingStreak {
  const days = Object.keys(activity)
    .filter(d => activity[d] > 0)
    .sort();
  if (days.length === 0) return { current: 0, best: 0 };

  // Meilleure série historique : on parcourt les jours actifs dans l'ordre.
  const dayNumber = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, (m ?? 1) - 1, d ?? 1) / DAY_MS;
  };
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = dayNumber(days[i]) - dayNumber(days[i - 1]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  // Série courante : elle doit se terminer aujourd'hui ou hier.
  const todayStr = toDateStr(now);
  const yesterdayStr = toDateStr(new Date(now.getTime() - DAY_MS));
  let cursor: Date | null = null;
  if (activity[todayStr]) cursor = new Date(now);
  else if (activity[yesterdayStr]) cursor = new Date(now.getTime() - DAY_MS);

  let current = 0;
  while (cursor && activity[toDateStr(cursor)]) {
    current++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  return { current, best: Math.max(best, current) };
}

export interface DayActivity {
  dateStr: string;
  count: number;
  label: string;
  isToday: boolean;
}

/** Last `daysBack` days (oldest first) with per-day reading counts. */
export function getWeekActivity(
  activity: Record<string, number>,
  daysBack = 7,
  now: Date = new Date(),
): DayActivity[] {
  const today = now;
  const todayStr = toDateStr(today);
  const result: DayActivity[] = [];

  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * DAY_MS);
    const dateStr = toDateStr(date);
    result.push({
      dateStr,
      count: activity[dateStr] ?? 0,
      label: DAY_LABELS_FR[date.getDay()],
      isToday: dateStr === todayStr,
    });
  }
  return result;
}

export interface AnnualStats {
  chaptersThisYear: number;
  seriesStarted: number;
  seriesCompleted: number;
  averageScore: number;
}

/** Stats scoped to the current calendar year. */
export function getAnnualStats(entries: LibraryEntry[]): AnnualStats {
  const year = new Date().getFullYear().toString();
  let chaptersThisYear = 0;
  let seriesStarted = 0;
  let seriesCompleted = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const entry of entries) {
    if (entry.chapterData) {
      for (const note of Object.values(entry.chapterData)) {
        if (note.readAt?.startsWith(year)) chaptersThisYear++;
      }
    }
    if (entry.startDate?.startsWith(year)) seriesStarted++;
    if (entry.finishDate?.startsWith(year)) seriesCompleted++;
    if (entry.score) {
      scoreSum += entry.score;
      scoreCount++;
    }
  }

  return {
    chaptersThisYear,
    seriesStarted,
    seriesCompleted,
    averageScore: scoreCount > 0 ? scoreSum / scoreCount : 0,
  };
}
