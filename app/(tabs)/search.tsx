import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
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
import { MangaCard } from '@/components/manga/MangaCard';
import { Typography } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, TYPE_LABELS } from '@/constants/theme';
import type { Manga, MediaType } from '@/lib/types';

const TAB_BAR_HEIGHT = 88;

type FilterType = 'ALL' | MediaType;
const FILTER_TYPES: FilterType[] = ['ALL', 'MANGA', 'MANHWA', 'MANHUA', 'WEBTOON'];

async function searchAll(query: string, type: FilterType): Promise<Manga[]> {
  if (!query.trim()) return [];

  if (type === 'WEBTOON') {
    const r = await mangadex.searchManga(query, 1, 30, 'ko');
    return r.items.filter(m => m.type === 'WEBTOON');
  }

  if (type === 'MANHWA') {
    const [al, md] = await Promise.allSettled([
      anilist.searchManga(query, 1, 10, 'KR'),
      mangadex.searchManga(query, 1, 10, 'ko'),
    ]);
    const alItems = al.status === 'fulfilled' ? al.value.items : [];
    const mdItems = md.status === 'fulfilled' ? md.value.items.filter(m => m.type === 'MANHWA') : [];
    return [...alItems, ...mdItems];
  }

  if (type === 'MANHUA') {
    const r = await anilist.searchManga(query, 1, 20, 'CN');
    return r.items;
  }

  if (type === 'MANGA') {
    const r = await anilist.searchManga(query, 1, 30, 'JP');
    return r.items;
  }

  const [al, md, jk] = await Promise.allSettled([
    anilist.searchManga(query, 1, 15),
    mangadex.searchManga(query, 1, 10),
    jikan.searchManga(query, 1),
  ]);

  const alItems = al.status === 'fulfilled' ? al.value.items : [];
  const mdItems = md.status === 'fulfilled' ? md.value.items : [];
  const jkItems = jk.status === 'fulfilled' ? jk.value.items : [];

  const seen = new Set<string>();
  const results: Manga[] = [];
  for (const item of [...alItems, ...mdItems, ...jkItems]) {
    const key = item.title.userPreferred.toLowerCase().replace(/\s/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      results.push(item);
    }
  }
  return results;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 450);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery, activeFilter],
    queryFn: () => searchAll(debouncedQuery, activeFilter),
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 2,
  });

  const renderItem = useCallback(({ item, index }: { item: Manga; index: number }) => (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: index * 40 }}
      style={styles.gridItem}
    >
      <MangaCard manga={item} width={styles.gridItem.width as number} />
    </MotiView>
  ), []);

  const showEmpty = debouncedQuery.length >= 2 && !isLoading && (!results || results.length === 0);
  const showInitial = debouncedQuery.length < 2;

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
            placeholder="Manga, manhwa, webtoon…"
            placeholderTextColor={COLORS.textInkMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
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
          {FILTER_TYPES.map(filter => (
            <Pressable
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Typography
                variant="label"
                style={[styles.filterLabel, activeFilter === filter && styles.filterLabelActive]}
              >
                {TYPE_LABELS[filter] ?? filter}
              </Typography>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {showInitial && (
        <EmptyState
          icon="🔍"
          title="Cherchez votre prochaine lecture"
          subtitle="Tapez au moins 2 caractères pour lancer la recherche sur AniList, MangaDex et Jikan."
        />
      )}

      {showEmpty && (
        <EmptyState
          icon="😔"
          title="Aucun résultat"
          subtitle={`Aucun résultat pour "${debouncedQuery}". Essayez un autre terme.`}
        />
      )}

      {results && results.length > 0 && (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={item => `${item.source}-${item.id}`}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: TAB_BAR_HEIGHT + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const CARD_WIDTH = 108;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  header: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, gap: SPACING.sm },
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
    marginTop: SPACING.sm,
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
  filterChipActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentRed,
  },
  filterLabel: { color: COLORS.textInkMuted },
  filterLabelActive: { color: COLORS.accentRed },
  grid: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md },
  row: { gap: SPACING.md, marginBottom: SPACING.md },
  gridItem: { width: CARD_WIDTH },
});
