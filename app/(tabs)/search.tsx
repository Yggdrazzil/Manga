import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as anilist from '@/lib/api/anilist';
import * as mangadex from '@/lib/api/mangadex';
import * as comick from '@/lib/api/comick';
import * as mangaplus from '@/lib/api/mangaplus';
import * as webtoon from '@/lib/api/webtoon';
import * as jikan from '@/lib/api/jikan';
import {
  searchComics,
  extractVolumeNumber,
  seriesKeyFromTitle,
  seriesTitleFromFull,
  type OLBook,
} from '@/lib/api/openlib';
import { consolidateBDSeries } from '@/lib/api/bdconsolidate';
import { useComicsStore } from '@/lib/store/comics';
import { useSearchStore } from '@/lib/store/search';
import { Typography } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, TYPE_LABELS, themedStyles } from '@/constants/theme';
import type { Manga, MediaType } from '@/lib/types';

const TAB_BAR_HEIGHT = 88;

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterType = 'ALL' | MediaType | 'BD';
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'ALL', label: 'Tout' },
  { key: 'MANGA', label: TYPE_LABELS.MANGA },
  { key: 'MANHWA', label: TYPE_LABELS.MANHWA },
  { key: 'WEBTOON', label: TYPE_LABELS.WEBTOON },
  { key: 'MANHUA', label: TYPE_LABELS.MANHUA },
  { key: 'BD', label: 'BD & Comics' },
];

type UnifiedResult =
  | { kind: 'manga'; data: Manga; year?: number }
  | { kind: 'bd'; data: OLBook; year?: number };

function resultId(r: UnifiedResult): string {
  return r.kind === 'manga' ? `manga-${r.data.source}-${r.data.id}` : `bd-${r.data.id}`;
}

// ── Search logic ──────────────────────────────────────────────────────────────

function dedupeByTitle(items: Manga[]): Manga[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.title.userPreferred.toLowerCase().replace(/\s/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchManga(query: string, filter: FilterType): Promise<Manga[]> {
  if (filter === 'BD') return [];

  if (filter === 'WEBTOON') {
    // Webtoon ORIGINALS first (official + directly readable), then other sources
    const [wt, md, ck] = await Promise.allSettled([
      webtoon.searchManga(query, 1, 10),
      mangadex.searchManga(query, 1, 10, 'ko'),
      comick.searchManga(query, 1, 10),
    ]);
    return dedupeByTitle([
      ...(wt.status === 'fulfilled' ? wt.value.items : []),
      ...(md.status === 'fulfilled' ? md.value.items.filter(m => m.type === 'WEBTOON') : []),
      ...(ck.status === 'fulfilled' ? ck.value.items.filter(m => m.type === 'WEBTOON') : []),
    ]);
  }
  if (filter === 'MANHWA') {
    const [al, md, ck] = await Promise.allSettled([
      anilist.searchManga(query, 1, 8, 'KR'),
      mangadex.searchManga(query, 1, 8, 'ko'),
      comick.searchManga(query, 1, 8),
    ]);
    return [
      ...(al.status === 'fulfilled' ? al.value.items : []),
      ...(md.status === 'fulfilled' ? md.value.items.filter(m => m.type === 'MANHWA') : []),
      ...(ck.status === 'fulfilled' ? ck.value.items.filter(m => m.type === 'MANHWA') : []),
    ];
  }
  if (filter === 'MANHUA') {
    const r = await anilist.searchManga(query, 1, 15, 'CN');
    return r.items;
  }
  if (filter === 'MANGA') {
    // MangaPlus first so its directly-readable official version wins de-dup
    // (One Piece, Jujutsu Kaisen, …) over the AniList catalogue entry.
    const [mp, al] = await Promise.allSettled([
      mangaplus.searchManga(query, 1, 8),
      anilist.searchManga(query, 1, 16, 'JP'),
    ]);
    return dedupeByTitle([
      ...(mp.status === 'fulfilled' ? mp.value.items : []),
      ...(al.status === 'fulfilled' ? al.value.items : []),
    ]);
  }

  // ALL: Webtoon + MangaPlus + AniList + MangaDex + Jikan + Comick (de-duped by title).
  // Official sources lead so directly-readable chapters win over catalogue-only hits.
  const [wt, mp, al, md, jk, ck] = await Promise.allSettled([
    webtoon.searchManga(query, 1, 6),
    mangaplus.searchManga(query, 1, 6),
    anilist.searchManga(query, 1, 10),
    mangadex.searchManga(query, 1, 6),
    jikan.searchManga(query, 1),
    comick.searchManga(query, 1, 6),
  ]);
  return dedupeByTitle([
    ...(wt.status === 'fulfilled' ? wt.value.items : []),
    ...(mp.status === 'fulfilled' ? mp.value.items : []),
    ...(al.status === 'fulfilled' ? al.value.items : []),
    ...(md.status === 'fulfilled' ? md.value.items : []),
    ...(jk.status === 'fulfilled' ? jk.value.items : []),
    ...(ck.status === 'fulfilled' ? ck.value.items : []),
  ]);
}

async function searchBD(query: string, filter: FilterType): Promise<OLBook[]> {
  if (filter !== 'ALL' && filter !== 'BD') return [];
  const result = await searchComics(query);
  return result.items;
}

function parseYear(value?: string | number): number | undefined {
  if (value == null) return undefined;
  const y = parseInt(String(value).slice(0, 4), 10);
  return isNaN(y) ? undefined : y;
}

function getTitle(r: UnifiedResult): string {
  return r.kind === 'manga' ? r.data.title.userPreferred : r.data.title;
}

function sortBySeriesAndVolume(results: UnifiedResult[]): UnifiedResult[] {
  const seriesFirstIndex = new Map<string, number>();
  results.forEach((r, i) => {
    const k = seriesKeyFromTitle(getTitle(r));
    if (!seriesFirstIndex.has(k)) seriesFirstIndex.set(k, i);
  });

  return [...results].sort((a, b) => {
    const titleA = getTitle(a);
    const titleB = getTitle(b);
    const keyA = seriesKeyFromTitle(titleA);
    const keyB = seriesKeyFromTitle(titleB);

    if (keyA === keyB) {
      const volA = extractVolumeNumber(titleA);
      const volB = extractVolumeNumber(titleB);
      if (volA !== undefined && volB !== undefined) return volA - volB;
      if (volA !== undefined) return 1;
      if (volB !== undefined) return -1;
      return (a.year ?? 9999) - (b.year ?? 9999);
    }
    return (seriesFirstIndex.get(keyA) ?? 0) - (seriesFirstIndex.get(keyB) ?? 0);
  });
}

async function searchAll(query: string, filter: FilterType): Promise<UnifiedResult[]> {
  if (!query.trim()) return [];

  const [mangaSettled, bdSettled] = await Promise.allSettled([
    searchManga(query, filter),
    searchBD(query, filter),
  ]);

  const manga: UnifiedResult[] = (mangaSettled.status === 'fulfilled' ? mangaSettled.value : [])
    .map(m => ({ kind: 'manga' as const, data: m, year: m.year }));

  const bd: UnifiedResult[] = (bdSettled.status === 'fulfilled' ? bdSettled.value : [])
    .map(b => ({ kind: 'bd' as const, data: b, year: parseYear(b.publishedDate) }));

  const all = [...manga, ...bd];
  const seen = new Set<string>();
  const deduped = all.filter(r => {
    const key = getTitle(r).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return sortBySeriesAndVolume(deduped);
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({
  result,
  index,
  isRead,
  isTracked,
  onAddBD,
}: {
  result: UnifiedResult;
  index: number;
  isRead: boolean;
  isTracked: boolean;
  onAddBD: () => Promise<void>;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [addFailed, setAddFailed] = useState(false);

  const title = getTitle(result);
  const coverUri = result.kind === 'manga' ? result.data.coverImage : result.data.coverImage;
  const authors = result.data.authors;
  const publisher = result.kind === 'bd' ? result.data.publisher : undefined;
  const year = result.year;

  const typeLabel = result.kind === 'bd' ? 'BD' : (TYPE_LABELS[result.data.type] ?? 'MANGA');
  const typeBg = result.kind === 'bd' ? COLORS.cyan : COLORS.accentRed;

  const handleCardPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (result.kind === 'manga') {
      router.push(`/manga/${result.data.id}?source=${result.data.source}` as never);
    } else {
      const sid = seriesKeyFromTitle(title);
      const seriesTitle = seriesTitleFromFull(title);
      router.push(`/comic/${sid}?title=${encodeURIComponent(seriesTitle)}` as never);
    }
  };

  const handleAdd = async () => {
    if (adding) return;
    setAdding(true);
    setAddFailed(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onAddBD();
    } catch {
      setAddFailed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setAddFailed(false), 3000);
    } finally {
      setAdding(false);
    }
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(index * 30, 360) }}
    >
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={handleCardPress}
      >
        <View style={styles.coverFrame}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}>
              <Ionicons name="book" size={22} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <View style={styles.metaRow}>
            <View style={[styles.typeBadge, { backgroundColor: typeBg }]}>
              <Typography variant="caption" style={styles.typeBadgeText}>{typeLabel}</Typography>
            </View>
            {year != null && (
              <Typography variant="caption" color={COLORS.textInkFaint}>{year}</Typography>
            )}
          </View>

          <Typography variant="subheading" color={COLORS.textInk} numberOfLines={2} style={styles.cardTitle}>
            {title}
          </Typography>

          {authors.length > 0 && (
            <Typography variant="label" color={COLORS.textInkMuted} numberOfLines={1}>
              {authors.join(', ')}
            </Typography>
          )}

          {publisher && (
            <Typography variant="caption" color={COLORS.textInkFaint} numberOfLines={1} style={styles.publisher}>
              {publisher.toUpperCase()}
            </Typography>
          )}
        </View>

        {result.kind === 'bd' ? (
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              isRead && styles.addBtnRead,
              isTracked && !isRead && styles.addBtnTracked,
              pressed && { opacity: 0.75 },
            ]}
            onPress={e => { e.stopPropagation(); void handleAdd(); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              addFailed ? 'Échec — réessayer'
              : isRead ? 'Lu'
              : isTracked ? 'Suivi — marquer comme lu'
              : 'Ajouter à la bibliothèque'
            }
            accessibilityState={{ busy: adding }}
          >
            {adding ? (
              <ActivityIndicator size="small" color={COLORS.onInk} />
            ) : (
              <Ionicons
                name={addFailed ? 'alert' : isRead ? 'checkmark' : isTracked ? 'bookmark' : 'add'}
                size={18}
                color={COLORS.onInk}
              />
            )}
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={COLORS.textInkFaint} />
        )}
      </Pressable>
    </MotiView>
  );
}

// ── Discovery (empty state): recent searches + trending ──────────────────────

function SearchDiscovery({ onPickQuery }: { onPickQuery: (q: string) => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recentSearches = useSearchStore(s => s.recentSearches);
  const removeRecentSearch = useSearchStore(s => s.removeRecentSearch);
  const clearRecentSearches = useSearchStore(s => s.clearRecentSearches);

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['search-trending'],
    queryFn: () => anilist.getTrending(1, 12),
    staleTime: 1000 * 60 * 30,
  });

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.discovery, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      {recentSearches.length > 0 && (
        <View style={styles.discoverySection}>
          <View style={styles.discoveryHeader}>
            <View style={styles.discoveryHeaderLeft}>
              <Ionicons name="time-outline" size={15} color={COLORS.accentRed} />
              <Typography variant="kicker" color={COLORS.textInk} style={styles.discoveryTitle}>
                RECHERCHES RÉCENTES
              </Typography>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                clearRecentSearches();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Effacer l'historique de recherche"
            >
              <Typography variant="caption" color={COLORS.textInkMuted}>EFFACER</Typography>
            </Pressable>
          </View>
          <View style={styles.recentWrap}>
            {recentSearches.map(q => (
              <Pressable
                key={q}
                style={({ pressed }) => [styles.recentChip, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onPickQuery(q);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Rechercher ${q}`}
              >
                <Typography variant="label" color={COLORS.textInk} numberOfLines={1} style={styles.recentChipText}>
                  {q}
                </Typography>
                <Pressable
                  onPress={e => {
                    e.stopPropagation();
                    removeRecentSearch(q);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer ${q} de l'historique`}
                >
                  <Ionicons name="close" size={13} color={COLORS.textInkFaint} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.discoverySection}>
        <View style={styles.discoveryHeader}>
          <View style={styles.discoveryHeaderLeft}>
            <Ionicons name="flame" size={15} color={COLORS.accentRed} />
            <Typography variant="kicker" color={COLORS.textInk} style={styles.discoveryTitle}>
              TENDANCES DU MOMENT
            </Typography>
          </View>
        </View>

        {trendingLoading ? (
          <View style={styles.trendingLoading}>
            <ActivityIndicator color={COLORS.accentRed} />
          </View>
        ) : trending && trending.items.length > 0 ? (
          <View style={styles.trendingGrid}>
            {trending.items.map((m, i) => (
              <MotiView
                key={`${m.source}-${m.id}`}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(i * 40, 400) }}
                style={styles.trendingItem}
              >
                <Pressable
                  style={({ pressed }) => pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/manga/${m.id}?source=${m.source}` as never);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={m.title.userPreferred}
                >
                  <View style={styles.trendingCoverFrame}>
                    <Image
                      source={{ uri: m.coverImage }}
                      style={styles.trendingCover}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                    <View style={styles.trendingRank}>
                      <Typography variant="display" style={styles.trendingRankText}>{i + 1}</Typography>
                    </View>
                  </View>
                  <Typography variant="label" color={COLORS.textInk} numberOfLines={2} style={styles.trendingTitle}>
                    {m.title.userPreferred}
                  </Typography>
                </Pressable>
              </MotiView>
            ))}
          </View>
        ) : (
          <Typography variant="label" color={COLORS.textInkMuted}>
            Tendances indisponibles pour le moment.
          </Typography>
        )}
      </View>
    </ScrollView>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');
  const inputRef = useRef<TextInput>(null);

  const addOrUpdateSeries = useComicsStore(s => s.addOrUpdateSeries);
  // Subscribe to the entries array itself (not the stable getter functions),
  // so result cards re-render when the library changes — fixes the "+" button
  // never turning into a checkmark after an add.
  const comicsEntries = useComicsStore(s => s.entries);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 450);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isLoading, isFetching, isError } = useQuery({
    queryKey: ['unified-search', debouncedQuery, filter],
    queryFn: () => searchAll(debouncedQuery, filter),
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 2,
  });

  // Record searches that actually returned something
  const addRecentSearch = useSearchStore(s => s.addRecentSearch);
  useEffect(() => {
    if (results && results.length > 0 && debouncedQuery.length >= 2) {
      addRecentSearch(debouncedQuery);
    }
  }, [results, debouncedQuery, addRecentSearch]);

  const handlePickQuery = useCallback((q: string) => {
    setQuery(q);
    setDebouncedQuery(q);
  }, []);

  const handleAddBD = useCallback(async (book: OLBook) => {
    // Specific tome in the result → mark it read; series-level result → just track
    const volNum = extractVolumeNumber(book.title);
    const seriesTitle = seriesTitleFromFull(book.title);

    const series = await consolidateBDSeries(seriesTitle, book.authors[0]);
    if (!series) throw new Error('Aucune donnée trouvée pour cette série');

    addOrUpdateSeries(series, volNum ?? undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [addOrUpdateSeries]);

  const renderItem = useCallback(({ item, index }: { item: UnifiedResult; index: number }) => {
    if (item.kind !== 'bd') {
      return (
        <ResultCard
          result={item}
          index={index}
          isRead={false}
          isTracked={false}
          onAddBD={async () => {}}
        />
      );
    }

    const volNum = extractVolumeNumber(item.data.title);
    const sid = seriesKeyFromTitle(item.data.title);
    const entry = comicsEntries.find(e => e.seriesId === sid);
    const tracked = !!entry;
    const read = volNum != null ? (entry?.readVolumes.includes(volNum) ?? false) : false;

    return (
      <ResultCard
        result={item}
        index={index}
        isRead={read}
        isTracked={tracked}
        onAddBD={() => handleAddBD(item.data)}
      />
    );
  }, [comicsEntries, handleAddBD]);

  const showNetworkError = debouncedQuery.length >= 2 && !isLoading && isError;
  const showEmpty =
    debouncedQuery.length >= 2 && !isLoading && !isError && (!results || results.length === 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Typography variant="kicker" color={COLORS.accentRed}>DÉCOUVERTE</Typography>
        <Typography variant="hero" color={COLORS.textInk} style={styles.title}>Rechercher</Typography>

        <View style={styles.inputWrap}>
          <Ionicons name="search" size={20} color={COLORS.textInkMuted} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Tintin, Naruto, Lanfeust, One Piece…"
            placeholderTextColor={COLORS.textInkMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Rechercher des mangas ou BD"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setDebouncedQuery(''); }} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={COLORS.textInkMuted} />
            </Pressable>
          )}
          {isFetching && <ActivityIndicator size="small" color={COLORS.accentRed} style={styles.spinner} />}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={styles.filtersScroll}
        >
          {FILTERS.map(f => (
            <Pressable
              key={f.key}
              style={({ pressed }) => [
                styles.filterChip,
                filter === f.key && styles.filterChipActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f.key);
              }}
            >
              <Typography
                variant="label"
                style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}
              >
                {f.label}
              </Typography>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {debouncedQuery.length < 2 && <SearchDiscovery onPickQuery={handlePickQuery} />}

      {showNetworkError && (
        <EmptyState
          icon="📡"
          title="Erreur réseau"
          subtitle="Impossible de contacter les serveurs. Vérifiez votre connexion puis réessayez."
        />
      )}

      {showEmpty && (
        <EmptyState
          icon="😔"
          title="Aucun résultat"
          subtitle={`Aucun résultat pour "${debouncedQuery}". Essayez un autre terme.`}
        />
      )}

      {isLoading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.accentRed} size="large" />
          <Typography variant="body" color={COLORS.textInkMuted}>Recherche en cours…</Typography>
        </View>
      )}

      {results && results.length > 0 && (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={resultId}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        />
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },

  header: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: BORDERS.hair,
    borderBottomColor: COLORS.line,
    paddingBottom: SPACING.md,
  },
  title: { fontSize: 38, lineHeight: 40 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperRaised,
    borderRadius: RADIUS.lg,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    paddingHorizontal: SPACING.md,
    height: 52,
  },
  searchIcon: { marginRight: SPACING.sm },
  input: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textInk,
    height: '100%',
  },
  clearBtn: { padding: SPACING.xs },
  spinner: { marginLeft: SPACING.xs },

  filtersScroll: { flexGrow: 0 },
  filters: { gap: SPACING.sm, paddingBottom: SPACING.xs },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.line,
  },
  filterChipActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accentRed },
  filterLabel: { color: COLORS.textInkMuted },
  filterLabelActive: { color: COLORS.accentRed },

  list: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, gap: SPACING.sm },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.paperRaised,
    borderRadius: RADIUS.lg,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    padding: SPACING.md,
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  coverFrame: {
    borderRadius: RADIUS.sm,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
    flexShrink: 0,
  },
  cover: { width: 56, height: 80 },
  coverEmpty: { backgroundColor: COLORS.paperSunken, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: SPACING.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  typeBadge: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  typeBadgeText: { fontSize: 8, letterSpacing: 0.8, color: COLORS.onInk, fontFamily: FONTS.bodyBold },
  cardTitle: { fontSize: 14, lineHeight: 18 },
  publisher: { fontSize: 9, letterSpacing: 0.6 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentRed,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addBtnRead: { backgroundColor: COLORS.statusCompleted, borderColor: COLORS.statusCompleted },
  addBtnTracked: { backgroundColor: COLORS.ink, borderColor: COLORS.lineOnInk },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },

  // ── Discovery (empty state) ──
  discovery: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.lg,
    gap: SPACING.xl,
  },
  discoverySection: { gap: SPACING.md },
  discoveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discoveryHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  discoveryTitle: { fontSize: 13, letterSpacing: 1.5 },

  recentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.paperRaised,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
    maxWidth: '100%',
  },
  recentChipText: { maxWidth: 200 },

  trendingLoading: { paddingVertical: SPACING.xl, alignItems: 'center' },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  trendingItem: { width: '30.5%' },
  trendingCoverFrame: {
    borderRadius: RADIUS.md,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
  },
  trendingCover: { width: '100%', aspectRatio: 0.7, backgroundColor: COLORS.paperSunken },
  trendingRank: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: COLORS.accentRed,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderBottomRightRadius: RADIUS.md,
  },
  trendingRankText: { fontSize: 14, lineHeight: 18, color: COLORS.onInk },
  trendingTitle: { marginTop: SPACING.xs, fontSize: 11, lineHeight: 14 },
}));
