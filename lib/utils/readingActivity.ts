import type { LibraryEntry } from '@/lib/types';

const DAY_MS = 86_400_000;
const DAY_LABELS_FR = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'] as const;

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Aggregates reading events from chapterData readAt timestamps.
 * Returns 'YYYY-MM-DD' → chapters read count for that day.
 */
export function getReadingActivity(entries: LibraryEntry[]): Record<string, number> {
  const activity: Record<string, number> = {};
  for (const entry of entries) {
    if (!entry.chapterData) continue;
    for (const note of Object.values(entry.chapterData)) {
      if (!note.readAt) continue;
      const date = note.readAt.slice(0, 10);
      activity[date] = (activity[date] ?? 0) + 1;
    }
  }
  return activity;
}

/**
 * Consecutive-day reading streak ending today (or yesterday as grace period).
 * Returns 0 if no recent activity.
 */
export function getReadingStreak(activity: Record<string, number>): number {
  const today = new Date();
  const todayStr = toDateStr(today);
  const yesterdayStr = toDateStr(new Date(today.getTime() - DAY_MS));

  let cursor: Date | null = null;
  if (activity[todayStr]) cursor = today;
  else if (activity[yesterdayStr]) cursor = new Date(today.getTime() - DAY_MS);
  if (!cursor) return 0;

  let streak = 0;
  while (activity[toDateStr(cursor)]) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
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
): DayActivity[] {
  const today = new Date();
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
