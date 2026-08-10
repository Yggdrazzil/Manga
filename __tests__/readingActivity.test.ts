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
  // Référence fixe : le calcul prend `now` en paramètre, donc plus de
  // dépendance à l'horloge de la machine de test.
  const NOW = new Date(2026, 1, 12, 10, 0, 0);
  const day = (back: number) => {
    const d = new Date(NOW);
    d.setDate(d.getDate() - back);
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${`${d.getDate()}`.padStart(2, '0')}`;
  };

  it('renvoie 0 pour une activité vide', () => {
    expect(getReadingStreak({}, NOW)).toEqual({ current: 0, best: 0 });
  });

  it('coupe la série courante si la dernière lecture date de 2 jours ou plus', () => {
    const s = getReadingStreak({ [day(3)]: 5 }, NOW);
    expect(s.current).toBe(0);
    // …mais le record historique, lui, reste acquis.
    expect(s.best).toBe(1);
  });

  it('compte la série en cours depuis aujourd’hui', () => {
    const activity: Record<string, number> = {};
    for (let i = 0; i < 5; i++) activity[day(i)] = 3;
    expect(getReadingStreak(activity, NOW).current).toBe(5);
  });

  it('accorde le jour de grâce de la veille', () => {
    const activity: Record<string, number> = {};
    for (let i = 1; i <= 4; i++) activity[day(i)] = 2;
    expect(getReadingStreak(activity, NOW).current).toBe(4);
  });

  it('s’arrête sur un trou dans les jours consécutifs', () => {
    const activity = { [day(0)]: 1, [day(1)]: 1, [day(3)]: 1 };
    expect(getReadingStreak(activity, NOW).current).toBe(2);
  });

  it('retient le meilleur record même s’il est plus ancien que la série en cours', () => {
    const activity: Record<string, number> = {};
    for (let i = 20; i <= 26; i++) activity[day(i)] = 1; // 7 jours d'affilée
    activity[day(0)] = 1;                                // série courante de 1
    const s = getReadingStreak(activity, NOW);
    expect(s.current).toBe(1);
    expect(s.best).toBe(7);
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

describe('fuseau horaire', () => {
  it('rattache une lecture au jour VÉCU par le lecteur, pas au jour UTC', () => {
    // Lu le 12 février à 00h30 heure locale. Avec l'ancien découpage UTC, ce
    // chapitre était comptabilisé le 11 dans les fuseaux à l'est de Greenwich.
    const local = new Date(2026, 1, 12, 0, 30, 0);
    const entries = [
      {
        mangaId: '1',
        source: 'anilist',
        status: 'READING',
        progress: 1,
        addedAt: local.toISOString(),
        updatedAt: local.toISOString(),
        manga: { id: '1', title: { userPreferred: 'X' }, coverImage: '', genres: [], tags: [], authors: [] },
        chapterData: { '1': { readAt: local.toISOString() } },
      },
    ] as unknown as Parameters<typeof getReadingActivity>[0];

    const activity = getReadingActivity(entries);
    expect(Object.keys(activity)).toEqual(['2026-02-12']);
  });
});
