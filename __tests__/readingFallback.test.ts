import { normalizeTitle, resolveFallbackFeed } from '@/lib/api/readingFallback';
import * as webtoon from '@/lib/api/webtoon';
import * as mangaplus from '@/lib/api/mangaplus';
import type { Manga } from '@/lib/types';

jest.mock('@/lib/api/webtoon');
jest.mock('@/lib/api/mangaplus');

describe('normalizeTitle', () => {
  it('lowercases and strips non-alphanumerics', () => {
    expect(normalizeTitle('One Piece')).toBe('onepiece');
    expect(normalizeTitle('ONE PIECE!')).toBe('onepiece');
    expect(normalizeTitle('Solo Leveling')).toBe('sololeveling');
  });

  it('strips diacritics via NFKD', () => {
    expect(normalizeTitle('Café Détective')).toBe('cafedetective');
  });

  it('keeps spin-offs distinct from the main series', () => {
    expect(normalizeTitle('One Piece: Ace Story')).not.toBe(normalizeTitle('One Piece'));
    expect(normalizeTitle('Solo Leveling: Ragnarok')).not.toBe(normalizeTitle('Solo Leveling'));
  });

  it('handles empty and undefined input', () => {
    expect(normalizeTitle('')).toBe('');
    expect(normalizeTitle(undefined)).toBe('');
  });
});

describe('resolveFallbackFeed', () => {
  const wtManga = (id: string, title: string): Manga => ({
    id,
    source: 'webtoon',
    title: { userPreferred: title, english: title },
    coverImage: '',
    type: 'WEBTOON',
    genres: [],
    tags: [],
    status: 'ONGOING',
    authors: [],
  });

  const soloLeveling: Manga = {
    id: '1',
    source: 'anilist',
    title: { userPreferred: 'Solo Leveling', english: 'Solo Leveling' },
    coverImage: '',
    type: 'MANHWA',
    genres: [],
    tags: [],
    status: 'COMPLETED',
    authors: [],
    countryOfOrigin: 'KR',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(mangaplus.searchManga).mockResolvedValue({
      items: [],
      hasNextPage: false,
      currentPage: 1,
    });
  });

  it('never matches a Canvas fan upload, even on exact title', async () => {
    // A real case: canvas/solo-leveling- is a user upload containing AoT pages
    jest.mocked(webtoon.searchManga).mockResolvedValue({
      items: [wtManga('1111238:canvas/solo-leveling-', 'Solo leveling ')],
      hasNextPage: false,
      currentPage: 1,
    });

    const feed = await resolveFallbackFeed(soloLeveling);
    expect(feed).toBeNull();
    expect(webtoon.getTrackingChapters).not.toHaveBeenCalled();
  });

  it('accepts an exact-title Originals match', async () => {
    jest.mocked(webtoon.searchManga).mockResolvedValue({
      items: [wtManga('95:action/solo-leveling', 'Solo Leveling')],
      hasNextPage: false,
      currentPage: 1,
    });
    jest.mocked(webtoon.getTrackingChapters).mockResolvedValue([
      {
        id: '/en/action/solo-leveling/ep-1/viewer?title_no=95&episode_no=1',
        mangaId: '95:action/solo-leveling',
        chapter: '1',
        pages: 0,
        publishAt: '',
        translatedLanguage: 'en',
        isReadable: true,
      },
    ]);

    const feed = await resolveFallbackFeed(soloLeveling);
    expect(feed?.source).toBe('webtoon');
    expect(feed?.mangaId).toBe('95:action/solo-leveling');
  });
});
