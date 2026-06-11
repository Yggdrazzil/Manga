import { chapterNumber, compareChapters, fillChapterGaps, maxChapterProgress } from '../lib/utils/chapter';
import type { MangaChapter } from '../lib/types';

function makeChapter(chapter: string, overrides: Partial<MangaChapter> = {}): MangaChapter {
  return {
    id: `ch-${chapter}`,
    mangaId: 'manga-1',
    chapter,
    pages: 10,
    publishAt: '2024-01-01T00:00:00Z',
    translatedLanguage: 'fr',
    isReadable: true,
    ...overrides,
  };
}

describe('chapterNumber', () => {
  it('parses numeric labels', () => {
    expect(chapterNumber('12')).toBe(12);
    expect(chapterNumber('56.5')).toBe(56.5);
  });

  it('returns NaN for non-numeric labels', () => {
    expect(chapterNumber('Oneshot')).toBeNaN();
    expect(chapterNumber(null)).toBeNaN();
    expect(chapterNumber(undefined)).toBeNaN();
  });
});

describe('maxChapterProgress', () => {
  it('keeps current when label is not numeric', () => {
    expect(maxChapterProgress(10, 'Extra')).toBe(10);
  });

  it('floors decimals and takes the max', () => {
    expect(maxChapterProgress(10, '56.5')).toBe(56);
    expect(maxChapterProgress(100, '56.5')).toBe(100);
  });
});

describe('fillChapterGaps', () => {
  it('returns the input unchanged when no numeric chapters exist', () => {
    const chapters = [makeChapter('Oneshot')];
    expect(fillChapterGaps(chapters, 'manga-1')).toHaveLength(1);
  });

  it('fills integer holes between min and max (One Piece licensing gap)', () => {
    const chapters = [makeChapter('1'), makeChapter('2'), makeChapter('56'), makeChapter('371')];
    const filled = fillChapterGaps(chapters, 'manga-1');
    const nums = filled.map(c => parseFloat(c.chapter));
    // contiguous 1..371
    expect(nums).toHaveLength(371);
    expect(nums[0]).toBe(1);
    expect(nums[370]).toBe(371);
  });

  it('marks synthetic fillers as not readable with empty language', () => {
    const chapters = [makeChapter('1'), makeChapter('3')];
    const filled = fillChapterGaps(chapters, 'manga-1');
    const synthetic = filled.find(c => c.chapter === '2')!;
    expect(synthetic.isReadable).toBe(false);
    expect(synthetic.translatedLanguage).toBe('');
    expect(synthetic.id).toBe('manga-1-syn-2');
  });

  it('keeps original readable chapters intact', () => {
    const chapters = [makeChapter('1'), makeChapter('3')];
    const filled = fillChapterGaps(chapters, 'manga-1');
    const original = filled.find(c => c.chapter === '1')!;
    expect(original.isReadable).toBe(true);
    expect(original.id).toBe('ch-1');
  });

  it('does not extrapolate below min or above max', () => {
    const chapters = [makeChapter('451'), makeChapter('453')];
    const filled = fillChapterGaps(chapters, 'manga-1');
    const nums = filled.map(c => parseFloat(c.chapter)).sort((a, b) => a - b);
    expect(nums).toEqual([451, 452, 453]);
  });

  it('preserves decimal extras without duplicating their integer slot', () => {
    const chapters = [makeChapter('1'), makeChapter('1.5'), makeChapter('3')];
    const filled = fillChapterGaps(chapters, 'manga-1');
    const labels = filled.map(c => c.chapter);
    expect(labels).toContain('1.5');
    expect(labels).toContain('2');
    expect(labels.filter(l => l === '1')).toHaveLength(1);
  });

  it('returns chapters sorted numerically', () => {
    const chapters = [makeChapter('5'), makeChapter('1')];
    const filled = fillChapterGaps(chapters, 'manga-1');
    expect(filled.map(c => c.chapter)).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('compareChapters', () => {
  it('sorts numerically ascending with non-numeric last', () => {
    const list = [makeChapter('Extra'), makeChapter('2'), makeChapter('1')];
    const sorted = [...list].sort(compareChapters);
    expect(sorted.map(c => c.chapter)).toEqual(['1', '2', 'Extra']);
  });
});
