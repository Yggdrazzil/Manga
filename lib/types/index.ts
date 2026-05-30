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

// ── BD / Comics series model ──────────────────────────────────────────────────

export interface BDVolume {
  num: number;            // tome number (1, 2, 3 …)
  workId: string;         // Open Library work ID, e.g. "OL24228254W"
  title: string;          // full title with tome suffix
  subtitle?: string;      // episode name, e.g. "L'Ivoire du Magohamoth" (lazy-loaded)
  coverImage?: string;
  description?: string;   // per-tome synopsis (lazy-loaded)
  publisher?: string;
  publishedDate?: string;
  authors: string[];
}

export interface BDSeries {
  id: string;             // kebab-case series key, e.g. "lanfeust-de-troy"
  title: string;          // series name without tome suffix, e.g. "Lanfeust de Troy"
  authors: string[];
  coverImage?: string;    // cover of the first available tome
  totalVolumes: number;   // max tome number detected from Open Library search
  volumes: BDVolume[];    // sorted by num; may not cover every num if OL gaps exist
  type: 'BD' | 'COMIC';
}

export interface BDSeriesEntry {
  seriesId: string;
  status: ReadingStatus;  // auto-computed on toggle; manual override via updateStatus
  readVolumes: number[];  // sorted list of tome numbers the user has read
  addedAt: string;
  updatedAt: string;
  series: BDSeries;
}

export interface ReadingStats {
  totalEntries: number;
  chaptersRead: number;
  volumesRead: number;
  byStatus: Record<ReadingStatus, number>;
  topGenres: Array<{ genre: string; count: number }>;
  averageScore: number;
}
