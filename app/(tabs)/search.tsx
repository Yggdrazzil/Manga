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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as anilist from '@/lib/api/anilist';
import * as mangadex from '@/lib/api/mangadex';
import * as jikan from '@/lib/api/jikan';
import { searchComics, type OLBook } from '@/lib/api/openlib';
import { useComicsStore } from '@/lib/store/comics';
import { MangaCard } from '@/components/manga/MangaCard';
import { Typography } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, TYPE_LABELS } from '@/constants/theme';
import type { Manga, MediaType } from '@/lib/types';

const TAB_BAR_HEIGHT = 88;
const MIN_CARD_WIDTH = 104;

// ── Manga search ──────────────────────────────────────────────────────────────

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
    return [
      ...(al.status === 'fulfilled' ? al.value.items : []),
      ...(md.status === 'fulfilled' ? md.value.items.filter(m => m.type === 'MANHWA') : []),
    ];
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

function MangaSearchTab({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const inputRef = useRef<TextInput>(null);

  const GAP = SPACING.md;
  const available = width - SPACING.base * 2;
  const numColumns = Math.max(3, Math.floor((available + GAP) / (MIN_CARD_WIDTH + GAP)));
  const cardWidth = Math.floor((available - GAP * (numColumns - 1)) / numColumns);

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
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: Math.min(index, 12) * 40 }}
      style={{ width: cardWidth }}
    >
      <MangaCard manga={item} width={cardWidth} />
    </MotiView>
  ), [cardWidth]);

  const showEmpty = debouncedQuery.length >= 2 && !isLoading && (!results || results.length === 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBarArea}>
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

      {debouncedQuery.length < 2 && (
        <EmptyState icon="🔍" title="Cherchez votre prochaine lecture" subtitle="Tapez au moins 2 caractères pour lancer la recherche sur AniList, MangaDex et Jikan." />
      )}
      {showEmpty && (
        <EmptyState icon="😔" title="Aucun résultat" subtitle={`Aucun résultat pour "${debouncedQuery}". Essayez un autre terme.`} />
      )}
      {results && results.length > 0 && (
        <FlatList
          key={numColumns}
          data={results}
          renderItem={renderItem}
          keyExtractor={item => `${item.source}-${item.id}`}
          numColumns={numColumns}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ── BD & Comics search ────────────────────────────────────────────────────────

function BDResultCard({
  book,
  inLibrary,
  onAdd,
  onOpen,
  index,
}: {
  book: OLBook;
  inLibrary: boolean;
  onAdd: () => void;
  onOpen: () => void;
  index: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: Math.min(index * 35, 350) }}
    >
      <Pressable style={styles.bdCard} onPress={onOpen}>
        <View style={styles.bdCoverFrame}>
          {book.coverImage ? (
            <Image source={{ uri: book.coverImage }} style={styles.bdCover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.bdCover, styles.bdCoverEmpty]}>
              <Ionicons name="book" size={24} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>
        <View style={styles.bdInfo}>
          <Typography variant="subheading" color={COLORS.textInk} numberOfLines={2} style={styles.bdTitle}>
            {book.title}
          </Typography>
          {book.authors.length > 0 && (
            <Typography variant="label" color={COLORS.textInkMuted} numberOfLines={1}>
              {book.authors.join(', ')}
            </Typography>
          )}
          {book.publisher && (
            <Typography variant="caption" color={COLORS.textInkFaint} numberOfLines={1}>
              {book.publisher}{book.publishedDate ? ` · ${book.publishedDate.slice(0, 4)}` : ''}
            </Typography>
          )}
          {book.categories.length > 0 && (
            <View style={styles.bdCategories}>
              {book.categories.slice(0, 2).map(c => (
                <View key={c} style={styles.catChip}>
                  <Typography variant="caption" color={COLORS.accentRed} style={{ fontSize: 9 }}>{c}</Typography>
                </View>
              ))}
            </View>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, inLibrary && styles.addBtnDone, pressed && { opacity: 0.8 }]}
          onPress={inLibrary ? onOpen : onAdd}
          hitSlop={8}
          accessibilityLabel={inLibrary ? 'Déjà dans la bibliothèque' : 'Ajouter'}
        >
          <Ionicons name={inLibrary ? 'checkmark' : 'add'} size={18} color={COLORS.onInk} />
        </Pressable>
      </Pressable>
    </MotiView>
  );
}

function BDSearchTab({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const addEntry = useComicsStore(s => s.addEntry);
  const comicEntries = useComicsStore(s => s.entries);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['comics-search', submitted],
    queryFn: () => searchComics(submitted),
    enabled: submitted.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const handleAdd = (book: OLBook) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addEntry({
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
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBarArea}>
        <View style={styles.bdSearchRow}>
          <View style={[styles.inputWrap, { flex: 1 }]}>
            <Ionicons name="search" size={20} color={COLORS.textInkMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="Tintin, Lanfeust, Asterix…"
              placeholderTextColor={COLORS.textInkMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => setSubmitted(query.trim())}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(''); setSubmitted(''); }} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={COLORS.textInkMuted} />
              </Pressable>
            )}
          </View>
          <Pressable style={styles.goBtn} onPress={() => setSubmitted(query.trim())}>
            <Typography variant="kicker" color={COLORS.onInk} style={{ letterSpacing: 1.5, fontSize: 11 }}>GO</Typography>
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.bdScroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {!submitted && (
          <View style={styles.hintBox}>
            <Ionicons name="library-outline" size={40} color={COLORS.textInkMuted} />
            <Typography variant="body" color={COLORS.textInkMuted} style={{ textAlign: 'center', lineHeight: 22 }}>
              Recherchez une bande dessinée ou un comic à ajouter à votre bibliothèque.
            </Typography>
          </View>
        )}

        {isLoading && (
          <View style={styles.stateBox}>
            <ActivityIndicator color={COLORS.accentRed} size="large" />
            <Typography variant="label" color={COLORS.textInkMuted}>Recherche en cours…</Typography>
          </View>
        )}

        {isError && (
          <View style={styles.stateBox}>
            <Ionicons name="cloud-offline-outline" size={40} color={COLORS.textInkMuted} />
            <Typography variant="body" color={COLORS.textInkMuted} style={{ textAlign: 'center' }}>
              Impossible de contacter Open Library. Vérifiez votre connexion.
            </Typography>
          </View>
        )}

        {data && data.items.length === 0 && (
          <View style={styles.stateBox}>
            <Ionicons name="search-outline" size={40} color={COLORS.textInkMuted} />
            <Typography variant="body" color={COLORS.textInkMuted} style={{ textAlign: 'center' }}>
              Aucun résultat pour «&nbsp;{submitted}&nbsp;»
            </Typography>
          </View>
        )}

        {data && data.items.length > 0 && (
          <View style={styles.bdResults}>
            {data.items.map((book, i) => (
              <BDResultCard
                key={book.id}
                book={book}
                inLibrary={!!comicEntries.find(e => e.comicId === book.id)}
                onAdd={() => handleAdd(book)}
                onOpen={() => router.push(`/comic/${book.id}` as never)}
                index={i}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── SCREEN ────────────────────────────────────────────────────────────────────

type SearchDomain = 'manga' | 'bd';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [domain, setDomain] = useState<SearchDomain>('manga');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Typography variant="kicker" color={COLORS.accentRed}>DÉCOUVERTE</Typography>
        <Typography variant="hero" color={COLORS.textInk} style={styles.title}>Rechercher</Typography>

        {/* Domain tabs */}
        <View style={styles.domainTabs}>
          {(['manga', 'bd'] as SearchDomain[]).map(d => (
            <Pressable
              key={d}
              style={[styles.domainTab, domain === d && styles.domainTabActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDomain(d);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: domain === d }}
            >
              <Ionicons
                name={d === 'manga' ? 'book-outline' : 'library-outline'}
                size={14}
                color={domain === d ? COLORS.accentRed : COLORS.textInkMuted}
              />
              <Typography
                variant="label"
                style={[styles.domainTabLabel, domain === d && styles.domainTabLabelActive]}
              >
                {d === 'manga' ? 'Manga & Webtoon' : 'BD & Comics'}
              </Typography>
            </Pressable>
          ))}
        </View>
      </View>

      {domain === 'manga' ? (
        <MangaSearchTab insets={insets} />
      ) : (
        <BDSearchTab insets={insets} />
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

  // Domain tabs
  domainTabs: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  domainTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.line,
  },
  domainTabActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentRed,
  },
  domainTabLabel: { color: COLORS.textInkMuted },
  domainTabLabelActive: { color: COLORS.accentRed },

  // Shared search bar area
  searchBarArea: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
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

  // Manga search
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
  grid: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md },
  row: { gap: SPACING.md, marginBottom: SPACING.md },

  // BD search
  bdSearchRow: { flexDirection: 'row', gap: SPACING.sm },
  goBtn: {
    height: 52,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bdScroll: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, gap: SPACING.md },
  hintBox: { alignItems: 'center', gap: SPACING.md, paddingVertical: 60, paddingHorizontal: SPACING.lg },
  stateBox: { paddingVertical: 60, alignItems: 'center', gap: SPACING.md },
  bdResults: { gap: SPACING.sm },
  bdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.paperRaised,
    borderRadius: RADIUS.lg,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    padding: SPACING.md,
  },
  bdCoverFrame: {
    borderRadius: RADIUS.sm,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
  },
  bdCover: { width: 52, height: 74 },
  bdCoverEmpty: { backgroundColor: COLORS.paperSunken, alignItems: 'center', justifyContent: 'center' },
  bdInfo: { flex: 1, gap: SPACING.xs },
  bdTitle: { fontSize: 14, lineHeight: 18 },
  bdCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: 2 },
  catChip: {
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: BORDERS.hair,
    borderColor: `${COLORS.accentRed}44`,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentRed,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDone: { backgroundColor: COLORS.statusCompleted, borderColor: COLORS.statusCompleted },
});
