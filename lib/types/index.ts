export type MediaType = 'MANGA' | 'MANHWA' | 'MANHUA' | 'WEBTOON' | 'BD';
export type MediaSource = 'anilist' | 'mangadex' | 'jikan';
export type ReadingStatus = 'READING' | 'COMPLETED' | 'PLAN_TO_READ' | 'DROPPED' | 'PAUSED';
export type OngoingStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED' | 'NOT_YET_RELEASED';
export type SortOrder = 'TRENDING_DESC' | 'POPULARITY_DESC' | 'SCORE_DESC' | 'UPDATED_AT_DESC';

export interface MediaTitle {
  romaji?: string;
  english?: string;
  native?: string;
  userPreferred: string;
}

export interface Manga {
  id: string;
  source: MediaSource;
  title: MediaTitle;
  coverImage: string;
  bannerImage?: string;
  description?: string;
  type: MediaType;
  genres: string[];
  tags: string[];
  status: OngoingStatus;
  chapters?: number;
  volumes?: number;
  averageScore?: number;
  popularity?: number;
  year?: number;
  authors: string[];
  countryOfOrigin?: string;
  accentColor?: string;
  mangadexId?: string;
}

export interface LibraryEntry {
  mangaId: string;
  source: MediaSource;
  status: ReadingStatus;
  progress: number;
  progressVolumes?: number;
  score?: number;
  startDate?: string;
  finishDate?: string;
  notes?: string;
  updatedAt: string;
  manga: Manga;
  readChapterIds?: string[];
  chapterData?: Record<string, ChapterNote>;
}

export interface MangaChapter {
  id: string;
  mangaId: string;
  chapter: string;
  volume?: string;
  title?: string;
  pages: number;
  publishAt: string;
  translatedLanguage: string;
  externalUrl?: string;
  isReadable: boolean;
}

export interface ChapterNote {
  rating?: 1 | 2 | 3 | 4 | 5;
  reaction?: string;
  platform?: string;
  readAt?: string;
}

export interface SearchFilters {
  query: string;
  type?: MediaType | 'ALL';
  year?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  hasNextPage: boolean;
  total?: number;
  currentPage: number;
}

export interface Comic {
  id: string;           // Google Books volume ID
  title: string;
  authors: string[];
  coverImage?: string;
  description?: string;
  publisher?: string;
  publishedDate?: string;
  categories: string[];
  totalVolumes?: number;
  type: 'BD' | 'COMIC';
}

export interface ComicEntry {
  comicId: string;
  status: ReadingStatus;
  readVolumes: number[];   // volume numbers the user has marked as read
  totalVolumes?: number;   // user-defined (may differ from comic.totalVolumes)
  addedAt: string;
  updatedAt: string;
  comic: Comic;
}

export interface ReadingStats {
  totalEntries: number;
  chaptersRead: number;
  volumesRead: number;
  byStatus: Record<ReadingStatus, number>;
  topGenres: Array<{ genre: string; count: number }>;
  averageScore: number;
}
