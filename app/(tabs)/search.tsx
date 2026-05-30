import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import * as jikan from '@/lib/api/jikan';
import { searchComics, type OLBook } from '@/lib/api/openlib';
import { useComicsStore } from '@/lib/store/comics';
import { Typography } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, TYPE_LABELS } from '@/constants/theme';
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

async function searchManga(query: string, filter: FilterType): Promise<Manga[]> {
  if (filter === 'BD') return [];

  if (filter === 'WEBTOON') {
    const r = await mangadex.searchManga(query, 1, 20, 'ko');
    return r.items.filter(m => m.type === 'WEBTOON');
  }
  if (filter === 'MANHWA') {
    const [al, md] = await Promise.allSettled([
      anilist.searchManga(query, 1, 10, 'KR'),
      mangadex.searchManga(query, 1, 10, 'ko'),
    ]);
    return [
      ...(al.status === 'fulfilled' ? al.value.items : []),
      ...(md.status === 'fulfilled' ? md.value.items.filter(m => m.type === 'MANHWA') : []),
    ];
  }
  if (filter === 'MANHUA') {
    const r = await anilist.searchManga(query, 1, 15, 'CN');
    return r.items;
  }
  if (filter === 'MANGA') {
    const r = await anilist.searchManga(query, 1, 20, 'JP');
    return r.items;
  }

  // ALL: hit all manga APIs
  const [al, md, jk] = await Promise.allSettled([
    anilist.searchManga(query, 1, 12),
    mangadex.searchManga(query, 1, 8),
    jikan.searchManga(query, 1),
  ]);
  const all = [
    ...(al.status === 'fulfilled' ? al.value.items : []),
    ...(md.status === 'fulfilled' ? md.value.items : []),
    ...(jk.status === 'fulfilled' ? jk.value.items : []),
  ];
  const seen = new Set<string>();
  return all.filter(item => {
    const key = item.title.userPreferred.toLowerCase().replace(/\s/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

// ── Series / volume helpers ───────────────────────────────────────────────────

function extractVolumeNumber(title: string): number | undefined {
  // Match: "tome 8", "t. 3", "vol. 2", "volume 12", "#5"
  const m = title.match(/\btome\s+(\d+)|\bt\.\s*(\d+)|\bvol(?:ume)?\.?\s*(\d+)|#(\d+)/i);
  if (!m) return undefined;
  const n = m[1] ?? m[2] ?? m[3] ?? m[4];
  return parseInt(n, 10);
}

function seriesKey(title: string): string {
  // Strip volume suffix to get the base series name, then normalize for comparison
  return title
    .replace(/[,\s]+tome\s+\d+\b.*/i, '')
    .replace(/[,\s]+t\.\s*\d+\b.*/i, '')
    .replace(/[,\s]+vol(?:ume)?\.?\s*\d+\b.*/i, '')
    .replace(/\s+#\d+\b.*/i, '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents for robust matching
    .replace(/[^a-z0-9]/g, '');
}

function getTitle(r: UnifiedResult): string {
  return r.kind === 'manga' ? r.data.title.userPreferred : r.data.title;
}

// Sort by series group (preserving API relevance order between groups) then
// by volume number within a group. Year is only a last-resort fallback.
// This is robust against unreliable Open Library publication dates.
function sortBySeriesAndVolume(results: UnifiedResult[]): UnifiedResult[] {
  const seriesFirstIndex = new Map<string, number>();
  results.forEach((r, i) => {
    const k = seriesKey(getTitle(r));
    if (!seriesFirstIndex.has(k)) seriesFirstIndex.set(k, i);
  });

  return [...results].sort((a, b) => {
    const titleA = getTitle(a);
    const titleB = getTitle(b);
    const keyA = seriesKey(titleA);
    const keyB = seriesKey(titleB);

    if (keyA === keyB) {
      const volA = extractVolumeNumber(titleA);
      const volB = extractVolumeNumber(titleB);
      if (volA !== undefined && volB !== undefined) return volA - volB;
      // No volume on one side: put the series overview (no vol) before volumes
      if (volA !== undefined) return 1;
      if (volB !== undefined) return -1;
      // Both have no volume indicator: fall back to year
      return (a.year ?? 9999) - (b.year ?? 9999);
    }

    // Different series: preserve the order the API returned them (relevance)
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

  // Deduplicate by normalized full title
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
  inBDLibrary,
  onAddBD,
}: {
  result: UnifiedResult;
  index: number;
  inBDLibrary: boolean;
  onAddBD: () => void;
}) {
  const router = useRouter();

  const coverUri = result.kind === 'manga' ? result.data.coverImage : result.data.coverImage;
  const title = result.kind === 'manga' ? result.data.title.userPreferred : result.data.title;
  const authors = result.kind === 'manga'
    ? result.data.authors
    : result.data.authors;
  const publisher = result.kind === 'bd' ? result.data.publisher : undefined;
  const year = result.year;

  const typeLabel = result.kind === 'bd'
    ? 'BD'
    : (TYPE_LABELS[result.data.type] ?? 'MANGA');

  const typeBg = result.kind === 'bd' ? '#1F6F8B' : COLORS.accentRed;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (result.kind === 'manga') {
      router.push(`/manga/${result.data.id}?source=${result.data.source}` as never);
    } else {
      router.push(`/comic/${result.data.id}` as never);
    }
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(index * 30, 360) }}
    >
      <Pressable style={styles.card} onPress={handlePress}>
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
            <Typography variant="caption" color={COLORS.textInkFaint} numberOfLines={1}>
              {publisher}
            </Typography>
          )}
        </View>

        {result.kind === 'bd' ? (
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              inBDLibrary && styles.addBtnDone,
              pressed && { opacity: 0.8 },
            ]}
            onPress={e => {
              e.stopPropagation();
              if (!inBDLibrary) onAddBD();
              else handlePress();
            }}
            hitSlop={8}
            accessibilityLabel={inBDLibrary ? 'Déjà dans la bibliothèque' : 'Ajouter'}
          >
            <Ionicons name={inBDLibrary ? 'checkmark' : 'add'} size={18} color={COLORS.onInk} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={COLORS.textInkFaint} />
        )}
      </Pressable>
    </MotiView>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');
  const inputRef = useRef<TextInput>(null);

  const addComicEntry = useComicsStore(s => s.addEntry);
  const comicEntries = useComicsStore(s => s.entries);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 450);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ['unified-search', debouncedQuery, filter],
    queryFn: () => searchAll(debouncedQuery, filter),
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 2,
  });

  const handleAddBD = useCallback((book: OLBook) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addComicEntry({
      id: book.id,
      title: book.title,
      authors: book.authors,
      coverImage: book.coverImage,
      description: book.description,
      publisher: book.publisher,
      publishedDate: book.publishedDate,
      categories: book.categories,
      type: 'COMIC',
    }, 'PLAN_TO_READ');
    router.push(`/comic/${book.id}` as never);
  }, [addComicEntry, router]);

  const renderItem = useCallback(({ item, index }: { item: UnifiedResult; index: number }) => {
    const isBDInLib = item.kind === 'bd'
      ? !!comicEntries.find(e => e.comicId === item.data.id)
      : false;

    return (
      <ResultCard
        result={item}
        index={index}
        inBDLibrary={isBDInLib}
        onAddBD={() => item.kind === 'bd' && handleAddBD(item.data)}
      />
    );
  }, [comicEntries, handleAddBD]);

  const showEmpty = debouncedQuery.length >= 2 && !isLoading && (!results || results.length === 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Typography variant="kicker" color={COLORS.accentRed}>DÉCOUVERTE</Typography>
        <Typography variant="hero" color={COLORS.textInk} style={styles.title}>Rechercher</Typography>

        {/* Unified search bar */}
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
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setDebouncedQuery(''); }} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={COLORS.textInkMuted} />
            </Pressable>
          )}
          {isFetching && <ActivityIndicator size="small" color={COLORS.accentRed} style={styles.spinner} />}
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={styles.filtersScroll}
        >
          {FILTERS.map(f => (
            <Pressable
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
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

      {/* States */}
      {debouncedQuery.length < 2 && (
        <EmptyState
          icon="🔍"
          title="Cherchez votre prochaine lecture"
          subtitle="Manga, manhwa, webtoon, BD, comics… tout est dans une seule recherche, trié par ordre de parution."
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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

  // Result card
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
  typeBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  typeBadgeText: { fontSize: 8, letterSpacing: 0.8, color: COLORS.onInk, fontFamily: FONTS.bodyBold },
  cardTitle: { fontSize: 14, lineHeight: 18 },
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
  addBtnDone: { backgroundColor: COLORS.statusCompleted, borderColor: COLORS.statusCompleted },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
});
