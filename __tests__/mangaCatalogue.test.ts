import {
  findLocalManga,
  findLocalWebtoon,
  searchLocalManga,
  searchLocalWebtoons,
} from '@/lib/catalogue/manga';

// Runs against the real bundled catalogues — doubles as a regression check on
// the weekly CI refresh: canonical titles must never drop out of the build.

describe('searchLocalManga', () => {
  it('finds canonical titles instantly', () => {
    const onePiece = searchLocalManga('one piece');
    expect(onePiece[0]?.title.userPreferred.toLowerCase()).toContain('one piece');
    expect(onePiece[0]?.source).toBe('anilist');
    expect(onePiece[0]?.coverImage).toMatch(/^https:/);
  });

  it('ranks exact matches above substring matches', () => {
    const results = searchLocalManga('berserk');
    expect(results[0]?.title.userPreferred.toLowerCase()).toBe('berserk');
  });

  it('carries authors extracted from annotated staff roles', () => {
    const berserk = searchLocalManga('berserk')[0];
    expect(berserk?.authors).toContain('Kentarou Miura');
  });

  it('filters by country of origin', () => {
    const kr = searchLocalManga('solo leveling', 12, { country: 'KR' });
    expect(kr.length).toBeGreaterThan(0);
    expect(kr.every(m => m.countryOfOrigin === 'KR')).toBe(true);

    const jp = searchLocalManga('solo leveling', 12, { country: 'JP' });
    expect(jp.some(m => m.title.userPreferred === 'Solo Leveling')).toBe(false);
  });

  it('matches accent-insensitively', () => {
    expect(searchLocalManga('shingeki no kyojin').length).toBeGreaterThan(0);
  });

  it('returns nothing for sub-2-char queries', () => {
    expect(searchLocalManga('o')).toEqual([]);
  });
});

describe('findLocalManga', () => {
  it('resolves an AniList id to a full Manga object', () => {
    const id = searchLocalManga('one piece')[0]?.id;
    const manga = findLocalManga(id!);
    expect(manga?.id).toBe(id);
    expect(manga?.description).toBeTruthy();
    expect(manga?.genres.length).toBeGreaterThan(0);
  });

  it('returns null for unknown or malformed ids', () => {
    expect(findLocalManga('999999999')).toBeNull();
    expect(findLocalManga('not-a-number')).toBeNull();
  });
});

describe('searchLocalWebtoons', () => {
  it('finds Originals with compound webtoon ids', () => {
    const results = searchLocalWebtoons('tower of god');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toMatch(/^\d+:[a-z0-9-]+\/[a-z0-9-]+$/);
    expect(results[0].source).toBe('webtoon');
    expect(results[0].type).toBe('WEBTOON');
  });

  it('never returns Canvas entries (catalogue only contains Originals)', () => {
    for (const m of searchLocalWebtoons('solo leveling')) {
      expect(m.id.includes(':canvas/')).toBe(false);
    }
  });
});

describe('findLocalWebtoon', () => {
  it('resolves a compound id back to its entry', () => {
    const first = searchLocalWebtoons('tower of god')[0];
    const found = findLocalWebtoon(first.id);
    expect(found?.title.userPreferred).toBe(first.title.userPreferred);
  });

  it('returns null for unknown ids', () => {
    expect(findLocalWebtoon('0:nope/nope')).toBeNull();
  });
});
