import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { searchComics, type GoogleBook } from '@/lib/api/googlebooks';
import { useComicsStore } from '@/lib/store/comics';
import { Panel } from '@/components/ui/Panel';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, STATUS_LABELS } from '@/constants/theme';
import type { ComicEntry, ReadingStatus } from '@/lib/types';

const TAB_BAR_HEIGHT = 88;
const GUTTER = SPACING.md;

// ── SEARCH TAB ────────────────────────────────────────────────────────────────

function SearchResultCard({
  book,
  inLibrary,
  onAdd,
  onOpen,
  index,
}: {
  book: GoogleBook;
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
      <Pressable style={styles.resultCard} onPress={onOpen}>
        <View style={styles.resultCoverFrame}>
          {book.coverImage ? (
            <Image source={{ uri: book.coverImage }} style={styles.resultCover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.resultCover, styles.resultCoverEmpty]}>
              <Ionicons name="book" size={24} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>
        <View style={styles.resultInfo}>
          <Typography variant="subheading" color={COLORS.textInk} numberOfLines={2} style={styles.resultTitle}>
            {book.title}
          </Typography>
          {book.authors.length > 0 && (
            <Typography variant="label" color={COLORS.textInkMuted} numberOfLines={1}>
              {book.authors.join(', ')}
            </Typography>
          )}
          {book.publisher && (
            <Typography variant="caption" color={COLORS.textInkFaint} numberOfLines={1}>
              {book.publisher}
              {book.publishedDate ? ` · ${book.publishedDate.slice(0, 4)}` : ''}
            </Typography>
          )}
          {book.categories.length > 0 && (
            <View style={styles.resultCategories}>
              {book.categories.slice(0, 2).map(c => (
                <View key={c} style={styles.categoryChip}>
                  <Typography variant="caption" color={COLORS.accentRed} style={styles.categoryChipText}>{c}</Typography>
                </View>
              ))}
            </View>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, inLibrary && styles.addBtnDone, pressed && styles.addBtnPressed]}
          onPress={inLibrary ? onOpen : onAdd}
          hitSlop={8}
          accessibilityLabel={inLibrary ? 'Déjà dans la bibliothèque' : 'Ajouter'}
        >
          <Ionicons
            name={inLibrary ? 'checkmark' : 'add'}
            size={18}
            color={COLORS.onInk}
          />
        </Pressable>
      </Pressable>
    </MotiView>
  );
}

function SearchTab({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const addEntry = useComicsStore(s => s.addEntry);
  const entries = useComicsStore(s => s.entries);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['comics-search', submitted],
    queryFn: () => searchComics(submitted),
    enabled: submitted.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const handleSubmit = () => {
    setSubmitted(query.trim());
  };

  const handleAdd = (book: GoogleBook) => {
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
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.searchScroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.searchBarRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textInkMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une BD ou un comic…"
            placeholderTextColor={COLORS.textInkMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setSubmitted(''); }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.textInkMuted} />
            </Pressable>
          )}
        </View>
        <Pressable style={styles.searchBtn} onPress={handleSubmit}>
          <Typography variant="kicker" color={COLORS.onInk} style={styles.searchBtnText}>GO</Typography>
        </Pressable>
      </View>

      {!submitted && (
        <View style={styles.searchHint}>
          <Ionicons name="library-outline" size={40} color={COLORS.textInkMuted} />
          <Typography variant="body" color={COLORS.textInkMuted} style={styles.searchHintText}>
            Recherchez une bande dessinée, un comic ou un roman graphique à ajouter à votre bibliothèque.
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
          <Typography variant="body" color={COLORS.textInkMuted} style={styles.stateText}>
            Impossible de contacter Google Books. Vérifiez votre connexion.
          </Typography>
        </View>
      )}

      {data && data.items.length === 0 && (
        <View style={styles.stateBox}>
          <Ionicons name="search-outline" size={40} color={COLORS.textInkMuted} />
          <Typography variant="body" color={COLORS.textInkMuted} style={styles.stateText}>
            Aucun résultat pour « {submitted} »
          </Typography>
        </View>
      )}

      {data && data.items.length > 0 && (
        <View style={styles.resultsList}>
          {data.items.map((book, i) => (
            <SearchResultCard
              key={book.id}
              book={book}
              inLibrary={!!entries.find(e => e.comicId === book.id)}
              onAdd={() => handleAdd(book)}
              onOpen={() => router.push(`/comic/${book.id}` as never)}
              index={i}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── LIBRARY TAB ───────────────────────────────────────────────────────────────

const STATUSES: ReadingStatus[] = ['READING', 'PLAN_TO_READ', 'COMPLETED', 'PAUSED', 'DROPPED'];
type LibFilter = 'ALL' | ReadingStatus;

const LIB_FILTERS: { key: LibFilter; label: string }[] = [
  { key: 'ALL', label: 'Tout' },
  { key: 'READING', label: STATUS_LABELS.READING },
  { key: 'COMPLETED', label: STATUS_LABELS.COMPLETED },
  { key: 'PLAN_TO_READ', label: STATUS_LABELS.PLAN_TO_READ },
];

function LibraryCard({ entry, index }: { entry: ComicEntry; index: number }) {
  const router = useRouter();
  const readCount = entry.readVolumes.length;
  const total = entry.totalVolumes ?? 0;
  const pct = total > 0 ? Math.min(readCount / total, 1) : 0;
  const title = entry.comic.title;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: Math.min(index * 40, 360) }}
    >
      <Pressable onPress={() => router.push(`/comic/${entry.comicId}` as never)}>
        <Panel variant="paper" bordered style={styles.libCard}>
          <View style={styles.libCardInner}>
            <View style={styles.libCoverFrame}>
              {entry.comic.coverImage ? (
                <Image source={{ uri: entry.comic.coverImage }} style={styles.libCover} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.libCover, styles.libCoverEmpty]}>
                  <Ionicons name="book" size={20} color={COLORS.textInkMuted} />
                </View>
              )}
            </View>
            <View style={styles.libInfo}>
              <Typography variant="subheading" color={COLORS.textInk} numberOfLines={2} style={styles.libTitle}>
                {title}
              </Typography>
              {entry.comic.authors.length > 0 && (
                <Typography variant="label" color={COLORS.textInkMuted} numberOfLines={1}>
                  {entry.comic.authors[0]}
                </Typography>
              )}
              <View style={styles.libProgressRow}>
                <View style={styles.libProgressTrack}>
                  <View style={[styles.libProgressFill, { width: `${pct * 100}%` as `${number}%` }]} />
                </View>
                <Typography variant="caption" color={COLORS.textInkMuted} style={styles.libProgressText}>
                  {readCount}{total > 0 ? `/${total}` : ''} tome{readCount !== 1 ? 's' : ''}
                </Typography>
              </View>
              <View style={styles.libStatusRow}>
                <View style={[styles.statusDot, {
                  backgroundColor: entry.status === 'READING' ? COLORS.statusReading
                    : entry.status === 'COMPLETED' ? COLORS.statusCompleted
                    : entry.status === 'PLAN_TO_READ' ? COLORS.statusPlan
                    : COLORS.textInkMuted,
                }]} />
                <Typography variant="caption" color={COLORS.textInkMuted}>{STATUS_LABELS[entry.status]}</Typography>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textInkMuted} />
          </View>
        </Panel>
      </Pressable>
    </MotiView>
  );
}

function LibraryTab({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const entries = useComicsStore(s => s.entries);
  const [filter, setFilter] = useState<LibFilter>('ALL');

  const visible = entries
    .filter(e => filter === 'ALL' ? true : e.status === filter)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.libScroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabs}
        style={styles.filterScroll}
      >
        {LIB_FILTERS.map(({ key, label }) => (
          <Pressable
            key={key}
            style={[styles.filterTab, filter === key && styles.filterTabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilter(key);
            }}
          >
            <Typography variant="label" color={filter === key ? COLORS.accentRed : COLORS.textInkMuted}>
              {label}
            </Typography>
          </Pressable>
        ))}
      </ScrollView>

      {visible.length === 0 ? (
        <View style={styles.emptyState}>
          <Typography style={styles.emptyEmoji}>📚</Typography>
          <Typography variant="heading" color={COLORS.textInk} style={styles.emptyTitle}>
            {entries.length === 0 ? 'Bibliothèque vide' : 'Aucune œuvre ici'}
          </Typography>
          <Typography variant="body" color={COLORS.textInkMuted} style={styles.emptyText}>
            {entries.length === 0
              ? 'Utilisez l\'onglet "Rechercher" pour ajouter des BD et comics.'
              : 'Aucune œuvre ne correspond à ce filtre.'}
          </Typography>
        </View>
      ) : (
        <View style={styles.libList}>
          {visible.map((entry, index) => (
            <LibraryCard key={entry.comicId} entry={entry} index={index} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── SCREEN ────────────────────────────────────────────────────────────────────

export default function ComicsScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'library' | 'search'>('library');
  const entries = useComicsStore(s => s.entries);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Typography variant="kicker" color={COLORS.accentRed}>BIBLIOTHÈQUE</Typography>
        <View style={styles.headerTitleRow}>
          <Typography variant="hero" color={COLORS.textInk} style={styles.title}>BD & Comics</Typography>
          <View style={styles.countBadge}>
            <Typography variant="label" color={COLORS.textInkMuted}>{entries.length}</Typography>
          </View>
        </View>

        <View style={styles.subTabs}>
          {(['library', 'search'] as const).map(tab => (
            <Pressable
              key={tab}
              style={styles.subTabBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab }}
            >
              <View style={styles.subTabContent}>
                <Ionicons
                  name={tab === 'library' ? 'library-outline' : 'search-outline'}
                  size={14}
                  color={activeTab === tab ? COLORS.textInk : COLORS.textInkMuted}
                />
                <Typography
                  variant="subheading"
                  style={[styles.subTabLabel, activeTab === tab && styles.subTabLabelActive]}
                >
                  {tab === 'library' ? 'Ma bibliothèque' : 'Rechercher'}
                </Typography>
              </View>
              {activeTab === tab && <View style={styles.subTabLine} />}
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === 'library' ? (
        <LibraryTab insets={insets} />
      ) : (
        <SearchTab insets={insets} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  header: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: 0, gap: 4 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  title: { fontSize: 38, lineHeight: 40 },
  countBadge: {
    backgroundColor: COLORS.paperSunken,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full, borderWidth: BORDERS.hair, borderColor: COLORS.line,
  },
  subTabs: { flexDirection: 'row', borderBottomWidth: BORDERS.hair, borderBottomColor: COLORS.line },
  subTabBtn: { paddingBottom: SPACING.md, paddingRight: SPACING.xl, position: 'relative' },
  subTabContent: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  subTabLabel: { color: COLORS.textInkMuted, fontSize: 14 },
  subTabLabelActive: { color: COLORS.textInk },
  subTabLine: {
    position: 'absolute', bottom: -1, left: 0, right: SPACING.xl,
    height: 2, backgroundColor: COLORS.accentRed, borderRadius: 1,
  },

  // ── SEARCH ──
  searchScroll: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, gap: SPACING.md },
  searchBarRow: { flexDirection: 'row', gap: SPACING.sm },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.paperSunken, borderRadius: RADIUS.lg,
    borderWidth: BORDERS.bold, borderColor: COLORS.ink,
    paddingHorizontal: SPACING.md, height: 48,
  },
  searchInput: {
    flex: 1, fontFamily: FONTS.body, fontSize: 15,
    color: COLORS.textInk, height: '100%',
  },
  searchBtn: {
    height: 48, paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.ink, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { letterSpacing: 1.5, fontSize: 11 },
  searchHint: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.xxl, paddingHorizontal: SPACING.lg },
  searchHintText: { textAlign: 'center', lineHeight: 22 },
  stateBox: { paddingVertical: SPACING.xxl, alignItems: 'center', gap: SPACING.md },
  stateText: { textAlign: 'center' },
  resultsList: { gap: SPACING.sm },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.paperRaised, borderRadius: RADIUS.lg,
    borderWidth: BORDERS.bold, borderColor: COLORS.ink,
    padding: SPACING.md,
  },
  resultCoverFrame: {
    borderRadius: RADIUS.sm, borderWidth: BORDERS.bold, borderColor: COLORS.ink, overflow: 'hidden',
  },
  resultCover: { width: 52, height: 74 },
  resultCoverEmpty: { backgroundColor: COLORS.paperSunken, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1, gap: SPACING.xs },
  resultTitle: { fontSize: 14, lineHeight: 18 },
  resultCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: 2 },
  categoryChip: {
    backgroundColor: COLORS.accentSoft, paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderRadius: RADIUS.full, borderWidth: BORDERS.hair, borderColor: `${COLORS.accentRed}44`,
  },
  categoryChipText: { fontSize: 9, letterSpacing: 0.3 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.accentRed, borderWidth: BORDERS.bold, borderColor: COLORS.accentDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnDone: { backgroundColor: COLORS.statusCompleted, borderColor: COLORS.statusCompleted },
  addBtnPressed: { opacity: 0.8 },

  // ── LIBRARY ──
  libScroll: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, gap: SPACING.md },
  filterScroll: { flexGrow: 0, marginHorizontal: -SPACING.base },
  filterTabs: { paddingHorizontal: SPACING.base, gap: SPACING.sm },
  filterTab: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold, borderColor: COLORS.line,
  },
  filterTabActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accentRed },
  libList: { gap: SPACING.md },
  libCard: { borderRadius: RADIUS.lg },
  libCardInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  libCoverFrame: { borderRadius: RADIUS.sm, borderWidth: BORDERS.bold, borderColor: COLORS.ink, overflow: 'hidden' },
  libCover: { width: 52, height: 74 },
  libCoverEmpty: { backgroundColor: COLORS.paperSunken, alignItems: 'center', justifyContent: 'center' },
  libInfo: { flex: 1, gap: SPACING.xs },
  libTitle: { fontSize: 14, lineHeight: 18 },
  libProgressRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  libProgressTrack: { flex: 1, height: 4, backgroundColor: COLORS.paperSunken, borderRadius: 2, overflow: 'hidden', borderWidth: BORDERS.hair, borderColor: COLORS.line },
  libProgressFill: { height: '100%', backgroundColor: COLORS.accentRed, borderRadius: 2 },
  libProgressText: { minWidth: 52, textAlign: 'right', fontSize: 10 },
  libStatusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  emptyState: { paddingTop: SPACING.xxl, alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 48, lineHeight: 56 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center', lineHeight: 22 },
});
