import {
  getReadingActivity,
  getReadingStreak,
  getWeekActivity,
  getAnnualStats,
} from '../lib/utils/readingActivity';
import type { LibraryEntry } from '../lib/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function makeManga(id: string) {
  return {
    id,
    source: 'anilist' as const,
    title: { userPreferred: 'Test' },
    coverImage: '',
    type: 'MANGA' as const,
    genres: [],
    tags: [],
    status: 'ONGOING' as const,
    authors: [],
  };
}

function makeEntry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    mangaId: 'test-1',
    source: 'anilist',
    status: 'READING',
    progress: 0,
    updatedAt: new Date().toISOString(),
    manga: makeManga('test-1'),
    ...overrides,
  };
}

// ── getReadingActivity ─────────────────────────────────────────────────────────

describe('getReadingActivity', () => {
  it('returns empty record when no entries', () => {
    expect(getReadingActivity([])).toEqual({});
  });

  it('returns empty record when entries have no chapterData', () => {
    const entry = makeEntry();
    expect(getReadingActivity([entry])).toEqual({});
  });

  it('counts chapters read per day', () => {
    const today = daysAgo(0).slice(0, 10);
    const yesterday = daysAgo(1).slice(0, 10);
    const entry = makeEntry({
      chapterData: {
        'ch-1': { readAt: `${today}T10:00:00.000Z` },
        'ch-2': { readAt: `${today}T12:00:00.000Z` },
        'ch-3': { readAt: `${yesterday}T09:00:00.000Z` },
        'ch-4': {},            // no readAt → should be ignored
      },
    });
    const activity = getReadingActivity([entry]);
    expect(activity[today]).toBe(2);
    expect(activity[yesterday]).toBe(1);
    expect(Object.keys(activity)).toHaveLength(2);
  });

  it('aggregates chapters across multiple entries', () => {
    const today = daysAgo(0).slice(0, 10);
    const e1 = makeEntry({ mangaId: 'a', chapterData: { c1: { readAt: `${today}T10:00:00Z` } } });
    const e2 = makeEntry({ mangaId: 'b', chapterData: { c2: { readAt: `${today}T11:00:00Z` } } });
    expect(getReadingActivity([e1, e2])[today]).toBe(2);
  });
});

// ── getReadingStreak ───────────────────────────────────────────────────────────

describe('getReadingStreak', () => {
  it('returns 0 for empty activity', () => {
    expect(getReadingStreak({})).toBe(0);
  });

  it('returns 0 if last read was 2+ days ago', () => {
    const threeDaysAgo = daysAgo(3).slice(0, 10);
    expect(getReadingStreak({ [threeDaysAgo]: 5 })).toBe(0);
  });

  it('counts streak from today', () => {
    const activity: Record<string, number> = {};
    for (let i = 0; i < 5; i++) {
      activity[daysAgo(i).slice(0, 10)] = 3;
    }
    expect(getReadingStreak(activity)).toBe(5);
  });

  it('counts streak from yesterday (grace period)', () => {
    const activity: Record<string, number> = {};
    for (let i = 1; i <= 4; i++) {
      activity[daysAgo(i).slice(0, 10)] = 2;
    }
    expect(getReadingStreak(activity)).toBe(4);
  });

  it('stops at a gap in consecutive days', () => {
    const activity = {
      [daysAgo(0).slice(0, 10)]: 1,
      [daysAgo(1).slice(0, 10)]: 1,
      // gap on day -2
      [daysAgo(3).slice(0, 10)]: 1,
    };
    expect(getReadingStreak(activity)).toBe(2);
  });
});

// ── getWeekActivity ────────────────────────────────────────────────────────────

describe('getWeekActivity', () => {
  it('returns exactly 7 days', () => {
    expect(getWeekActivity({})).toHaveLength(7);
  });

  it('marks today correctly', () => {
    const result = getWeekActivity({});
    expect(result[result.length - 1].isToday).toBe(true);
    expect(result.slice(0, -1).every(d => !d.isToday)).toBe(true);
  });

  it('includes count from activity map', () => {
    const today = daysAgo(0).slice(0, 10);
    const result = getWeekActivity({ [today]: 7 });
    const todayEntry = result.find(d => d.isToday)!;
    expect(todayEntry.count).toBe(7);
  });

  it('uses 0 for days with no activity', () => {
    const result = getWeekActivity({});
    expect(result.every(d => d.count === 0)).toBe(true);
  });
});

// ── getAnnualStats ─────────────────────────────────────────────────────────────

describe('getAnnualStats', () => {
  const year = new Date().getFullYear().toString();

  it('returns zeros for empty library', () => {
    const result = getAnnualStats([]);
    expect(result.chaptersThisYear).toBe(0);
    expect(result.seriesStarted).toBe(0);
    expect(result.seriesCompleted).toBe(0);
    expect(result.averageScore).toBe(0);
  });

  it('counts only chapters read this year', () => {
    const entry = makeEntry({
      chapterData: {
        c1: { readAt: `${year}-03-15T10:00:00Z` },
        c2: { readAt: `${year}-06-20T10:00:00Z` },
        c3: { readAt: '2022-01-01T10:00:00Z' }, // previous year
      },
    });
    expect(getAnnualStats([entry]).chaptersThisYear).toBe(2);
  });

  it('counts series started and completed this year', () => {
    const entry = makeEntry({
      startDate: `${year}-01-10T00:00:00Z`,
      finishDate: `${year}-04-30T00:00:00Z`,
    });
    const stats = getAnnualStats([entry]);
    expect(stats.seriesStarted).toBe(1);
    expect(stats.seriesCompleted).toBe(1);
  });

  it('computes average score across entries', () => {
    const e1 = makeEntry({ mangaId: 'a', score: 80 });
    const e2 = makeEntry({ mangaId: 'b', score: 60 });
    const result = getAnnualStats([e1, e2]);
    expect(result.averageScore).toBe(70);
  });
});
