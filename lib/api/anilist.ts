import { GraphQLClient } from 'graphql-request';
import type { Manga, PaginatedResult, MediaType, OngoingStatus } from '../types';

const client = new GraphQLClient('https://graphql.anilist.co');

const MEDIA_FIELDS = `
  id
  title { romaji english native userPreferred }
  coverImage { large extraLarge color }
  bannerImage
  description(asHtml: false)
  format
  status
  chapters
  volumes
  averageScore
  popularity
  startDate { year }
  genres
  countryOfOrigin
  externalLinks { id url site }
  staff(sort: RELEVANCE, page: 1, perPage: 4) {
    edges { node { name { full } } role }
  }
`;

interface AniListMedia {
  id: number;
  title: { romaji?: string; english?: string; native?: string; userPreferred: string };
  coverImage: { large?: string; extraLarge?: string; color?: string };
  bannerImage?: string;
  description?: string;
  format: string;
  status: string;
  chapters?: number | null;
  volumes?: number | null;
  averageScore?: number | null;
  popularity?: number | null;
  startDate?: { year?: number | null } | null;
  genres: string[];
  countryOfOrigin?: string | null;
  externalLinks?: Array<{ id: number; url: string; site: string }> | null;
  staff: { edges: Array<{ node: { name: { full: string } }; role: string }> };
}

interface PageResponse {
  Page: {
    pageInfo: { hasNextPage: boolean; total: number };
    media: AniListMedia[];
  };
}

interface MediaResponse {
  Media: AniListMedia;
}

function inferType(media: AniListMedia): MediaType {
  const country = media.countryOfOrigin;
  if (country === 'KR') return 'MANHWA';
  if (country === 'CN' || country === 'TW' || country === 'HK') return 'MANHUA';
  return 'MANGA';
}

function mapStatus(status: string): OngoingStatus {
  const map: Record<string, OngoingStatus> = {
    FINISHED: 'COMPLETED',
    RELEASING: 'ONGOING',
    NOT_YET_RELEASED: 'NOT_YET_RELEASED',
    CANCELLED: 'CANCELLED',
    HIATUS: 'HIATUS',
  };
  return map[status] ?? 'ONGOING';
}

function normalize(media: AniListMedia): Manga {
  const authors = media.staff.edges
    .filter(e => ['Story', 'Story & Art', 'Original Story'].includes(e.role))
    .map(e => e.node.name.full);

  const mangadexLink = (media.externalLinks ?? []).find(
    l => l.site === 'MangaDex' || (l.url && l.url.includes('mangadex.org/title/'))
  );
  const mangadexId = mangadexLink?.url?.match(/mangadex\.org\/title\/([0-9a-f-]+)/)?.[1];

  return {
    id: String(media.id),
    source: 'anilist',
    title: {
      romaji: media.title.romaji ?? undefined,
      english: media.title.english ?? undefined,
      native: media.title.native ?? undefined,
      userPreferred: media.title.userPreferred,
    },
    coverImage: media.coverImage.extraLarge ?? media.coverImage.large ?? '',
    bannerImage: media.bannerImage ?? undefined,
    description: media.description?.replace(/<[^>]*>/g, '') ?? undefined,
    type: inferType(media),
    genres: media.genres,
    tags: [],
    status: mapStatus(media.status),
    chapters: media.chapters ?? undefined,
    volumes: media.volumes ?? undefined,
    averageScore: media.averageScore ?? undefined,
    popularity: media.popularity ?? undefined,
    year: media.startDate?.year ?? undefined,
    authors,
    countryOfOrigin: media.countryOfOrigin ?? undefined,
    accentColor: media.coverImage.color ?? undefined,
    mangadexId,
  };
}

async function request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  return client.request<T>(query, variables ?? {});
}

export async function getTrending(page = 1, perPage = 20): Promise<PaginatedResult<Manga>> {
  const data = await request<PageResponse>(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage total }
        media(sort: TRENDING_DESC, type: MANGA, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage });

  return {
    items: data.Page.media.map(normalize),
    hasNextPage: data.Page.pageInfo.hasNextPage,
    total: data.Page.pageInfo.total,
    currentPage: page,
  };
}

export async function getPopular(page = 1, perPage = 20): Promise<PaginatedResult<Manga>> {
  const data = await request<PageResponse>(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage total }
        media(sort: POPULARITY_DESC, type: MANGA, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage });

  return {
    items: data.Page.media.map(normalize),
    hasNextPage: data.Page.pageInfo.hasNextPage,
    total: data.Page.pageInfo.total,
    currentPage: page,
  };
}

export async function getManhwa(page = 1, perPage = 20): Promise<PaginatedResult<Manga>> {
  const data = await request<PageResponse>(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage total }
        media(sort: POPULARITY_DESC, type: MANGA, countryOfOrigin: KR, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage });

  return {
    items: data.Page.media.map(normalize),
    hasNextPage: data.Page.pageInfo.hasNextPage,
    total: data.Page.pageInfo.total,
    currentPage: page,
  };
}

export async function getManhua(page = 1, perPage = 20): Promise<PaginatedResult<Manga>> {
  const data = await request<PageResponse>(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage total }
        media(sort: POPULARITY_DESC, type: MANGA, countryOfOrigin: CN, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage });

  return {
    items: data.Page.media.map(normalize),
    hasNextPage: data.Page.pageInfo.hasNextPage,
    total: data.Page.pageInfo.total,
    currentPage: page,
  };
}

export async function searchManga(
  query: string,
  page = 1,
  perPage = 20,
  countryOfOrigin?: string,
): Promise<PaginatedResult<Manga>> {
  const variables: Record<string, unknown> = { query, page, perPage };
  const countryFilter = countryOfOrigin ? `countryOfOrigin: ${countryOfOrigin}` : '';

  const data = await request<PageResponse>(`
    query ($query: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage total }
        media(search: $query, type: MANGA, isAdult: false, sort: SEARCH_MATCH ${countryFilter}) { ${MEDIA_FIELDS} }
      }
    }
  `, variables);

  return {
    items: data.Page.media.map(normalize),
    hasNextPage: data.Page.pageInfo.hasNextPage,
    total: data.Page.pageInfo.total,
    currentPage: page,
  };
}

interface CharacterPageResponse {
  Page: {
    characters: Array<{
      id: number;
      name: { full?: string | null };
      image: { large?: string | null; medium?: string | null };
    }>;
  };
}

export interface CharacterAvatar {
  id: number;
  name: string;
  image: string;
}

// Most-favourited characters across AniList — these are the iconic faces
// (Luffy, Levi, Gojo, …) with stable CDN images, used as profile avatars.
export async function getPopularCharacters(perPage = 48): Promise<CharacterAvatar[]> {
  const data = await request<CharacterPageResponse>(`
    query ($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        characters(sort: FAVOURITES_DESC) {
          id
          name { full }
          image { large medium }
        }
      }
    }
  `, { perPage });

  return data.Page.characters
    .map(c => ({
      id: c.id,
      name: c.name.full ?? 'Personnage',
      image: c.image.large ?? c.image.medium ?? '',
    }))
    .filter(c => c.image);
}

export interface BannerBackground {
  id: number;
  title: string;
  uri: string;
}

interface BannerPageResponse {
  Page: {
    media: Array<{
      id: number;
      title: { english?: string | null; romaji?: string | null; userPreferred: string };
      bannerImage?: string | null;
      coverImage: { extraLarge?: string | null };
    }>;
  };
}

export async function getPopularBanners(perPage = 40): Promise<BannerBackground[]> {
  const data = await request<BannerPageResponse>(`
    query ($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: MANGA, isAdult: false) {
          id
          title { english romaji userPreferred }
          bannerImage
          coverImage { extraLarge }
        }
      }
    }
  `, { perPage });

  return data.Page.media
    .filter(m => m.bannerImage)
    .map(m => ({
      id: m.id,
      title: m.title.english ?? m.title.romaji ?? m.title.userPreferred,
      uri: m.bannerImage!,
    }));
}

export async function getMangaById(id: string): Promise<Manga> {
  const data = await request<MediaResponse>(`
    query ($id: Int) {
      Media(id: $id, type: MANGA) { ${MEDIA_FIELDS} }
    }
  `, { id: parseInt(id, 10) });

  return normalize(data.Media);
}
