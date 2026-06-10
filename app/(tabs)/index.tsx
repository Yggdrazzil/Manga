import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getChaptersForLibrary } from '@/lib/api/mangadex';
import { useLibraryStore } from '@/lib/store/library';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, themedStyles } from '@/constants/theme';
import type { LibraryEntry, MangaChapter } from '@/lib/types';

const TAB_BAR_HEIGHT = 88;

// ── Date helpers ──────────────────────────────────────────────────────────────

function relativeGroup(dateStr: string): string {
  if (!dateStr) return 'PLUS ANCIEN';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 24) return "AUJOURD'HUI";
  if (diffH < 48) return 'HIER';
  if (diffH < 7 * 24) return 'CETTE SEMAINE';
  const d = date.getDate().toString().padStart(2, '0');
  const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
  return `${d} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function isNew(dateStr: string): boolean {
  if (!dateStr) return false;
  const diffH = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  return diffH < 48;
}

// ── À LIRE card ───────────────────────────────────────────────────────────────

function TrackerCard({ entry, index }: { entry: LibraryEntry; index: number }) {
  const router = useRouter();
  const updateProgress = useLibraryStore(s => s.updateProgress);
  const progress = entry.progress;
  const total = entry.manga.chapters;
  // Single source of truth for display: the progress watermark
  const remaining = total != null ? Math.max(total - progress, 0) : null;
  const isNew0 = progress === 0;
  const isCaughtUp = total != null && progress >= total;

  const handleQuickCheckIn = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (isCaughtUp) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateProgress(entry.mangaId, entry.source, progress + 1);
  };

  return (
    <MotiView
      from={{ opacity: 0, translateX: -12 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(index * 45, 400) }}
    >
      <Pressable
        style={styles.tvCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/manga/${entry.mangaId}?source=${entry.source}` as never);
        }}
        accessibilityRole="button"
        accessibilityLabel={entry.manga.title.userPreferred}
      >
        <View style={styles.tvCoverWrap}>
          {entry.manga.coverImage ? (
            <Image source={{ uri: entry.manga.coverImage }} style={styles.tvCover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.tvCover, styles.tvCoverEmpty]}>
              <Ionicons name="book" size={22} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>

        <View style={styles.tvBody}>
          <Pressable
            style={styles.tvTitlePill}
            onPress={() => router.push(`/manga/${entry.mangaId}?source=${entry.source}` as never)}
            hitSlop={4}
          >
            <Typography variant="caption" style={styles.tvTitlePillText} numberOfLines={1}>
              {entry.manga.title.userPreferred.toUpperCase()}
            </Typography>
            <Ionicons name="chevron-forward" size={10} color={COLORS.textInk} />
          </Pressable>

          <Typography style={styles.tvChapter}>
            {isCaughtUp
              ? (entry.manga.status === 'COMPLETED' ? 'Série terminée' : 'À jour ✓')
              : isNew0 ? 'Ch. 1' : `Ch. ${progress + 1}`}
          </Typography>

          <View style={styles.tvMeta}>
            {remaining !== null && remaining > 0 && (
              <View style={styles.tvBadge}>
                <Typography variant="caption" style={styles.tvBadgeText}>
                  +{remaining}
                </Typography>
              </View>
            )}
            <Typography variant="caption" color={COLORS.textInkMuted}>
              {isNew0 ? 'À commencer' : `${progress} lus`}
              {total != null ? ` / ${total}` : ''}
            </Typography>
          </View>
        </View>

        {isCaughtUp ? (
          <Ionicons name="checkmark-circle" size={28} color={COLORS.statusCompleted} />
        ) : (
          <Pressable
            onPress={handleQuickCheckIn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Marquer le chapitre ${progress + 1} comme lu`}
            style={({ pressed }) => [styles.quickCheckIn, pressed && { transform: [{ scale: 0.92 }] }]}
          >
            <Ionicons name="add-circle" size={30} color={COLORS.accentRed} />
          </Pressable>
        )}
      </Pressable>
    </MotiView>
  );
}

// ── À VENIR card ──────────────────────────────────────────────────────────────

function ChapterCard({
  chapter,
  entry,
  index,
}: {
  chapter: MangaChapter;
  entry: LibraryEntry;
  index: number;
}) {
  const router = useRouter();
  const nouveau = isNew(chapter.publishAt);

  return (
    <MotiView
      from={{ opacity: 0, translateX: -12 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(index * 40, 400) }}
    >
      <Pressable
        style={styles.tvCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/manga/${entry.mangaId}?source=${entry.source}` as never);
        }}
      >
        <View style={styles.tvCoverWrap}>
          {entry.manga.coverImage ? (
            <Image source={{ uri: entry.manga.coverImage }} style={styles.tvCover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.tvCover, styles.tvCoverEmpty]}>
              <Ionicons name="book" size={22} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>

        <View style={styles.tvBody}>
          <Pressable
            style={styles.tvTitlePill}
            onPress={() => router.push(`/manga/${entry.mangaId}?source=${entry.source}` as never)}
            hitSlop={4}
          >
            <Typography variant="caption" style={styles.tvTitlePillText} numberOfLines={1}>
              {entry.manga.title.userPreferred.toUpperCase()}
            </Typography>
            <Ionicons name="chevron-forward" size={10} color={COLORS.textInk} />
          </Pressable>

          <Typography style={styles.tvChapter}>
            Ch. {chapter.chapter}
          </Typography>

          {chapter.title && (
            <Typography variant="label" color={COLORS.textInkMuted} numberOfLines={1} style={styles.tvChapterTitle}>
              {chapter.title}
            </Typography>
          )}

          <View style={styles.tvMeta}>
            {nouveau && (
              <View style={[styles.tvBadge, styles.tvBadgeNew]}>
                <Typography variant="caption" style={[styles.tvBadgeText, styles.tvBadgeNewText]}>NOUVEAU</Typography>
              </View>
            )}
            {chapter.isReadable && (
              <View style={[styles.tvBadge, styles.tvBadgeReadable]}>
                <Typography variant="caption" style={[styles.tvBadgeText, { color: COLORS.onInk }]}>LISIBLE</Typography>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </MotiView>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeaderWrap}>
      <View style={styles.sectionPill}>
        <Typography variant="caption" style={styles.sectionPillText}>{title}</Typography>
      </View>
    </View>
  );
}

// ── SCREEN ────────────────────────────────────────────────────────────────────

export default function MangaTrackerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'voir' | 'venir'>('voir');
  const [refreshing, setRefreshing] = useState(false);

  const entries = useLibraryStore(s => s.entries);
  const readingEntries = useMemo(
    () => entries.filter(e => e.status === 'READING').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [entries],
  );

  // Build MangaDex ID lookup for À venir
  const mangadexIdMap = useMemo(() => {
    const map = new Map<string, LibraryEntry>();
    for (const e of entries) {
      if (e.source === 'mangadex') map.set(e.mangaId, e);
      else if (e.manga.mangadexId) map.set(e.manga.mangadexId, e);
    }
    return map;
  }, [entries]);

  const mangadexIds = useMemo(() => Array.from(mangadexIdMap.keys()), [mangadexIdMap]);

  const {
    data: recentChapters,
    isLoading: chaptersLoading,
    refetch,
  } = useQuery({
    queryKey: ['library-chapters', mangadexIds.join(',')],
    queryFn: () => getChaptersForLibrary(mangadexIds),
    enabled: mangadexIds.length > 0,
    staleTime: 1000 * 60 * 15,
  });

  // Build section list data for À venir
  const avenir = useMemo(() => {
    if (!recentChapters) return [];
    const readIds = new Set(entries.flatMap(e => e.readChapterIds ?? []));

    const unread = recentChapters
      .filter(ch => !readIds.has(ch.id) && mangadexIdMap.has(ch.mangaId))
      .sort((a, b) => new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime());

    const groups = new Map<string, MangaChapter[]>();
    for (const ch of unread) {
      const grp = relativeGroup(ch.publishAt);
      if (!groups.has(grp)) groups.set(grp, []);
      groups.get(grp)!.push(ch);
    }

    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [recentChapters, entries, mangadexIdMap]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const isEmpty = readingEntries.length === 0;
  const avenirEmpty = avenir.length === 0 && !chaptersLoading;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Typography variant="kicker" color={COLORS.accentRed}>BIBLIOTHÈQUE</Typography>
        <View style={styles.headerRow}>
          <Typography variant="hero" color={COLORS.textInk} style={styles.title}>
            Manga & Webtoon
          </Typography>
          <View style={styles.countBadge}>
            <Typography variant="label" color={COLORS.textInkMuted}>{entries.length}</Typography>
          </View>
        </View>

        {/* Sub-tabs */}
        <View style={styles.subTabs}>
          {(['voir', 'venir'] as const).map(tab => (
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
              <Typography
                variant="subheading"
                style={[styles.subTabLabel, activeTab === tab && styles.subTabLabelActive]}
              >
                {tab === 'voir' ? 'À LIRE' : 'À VENIR'}
              </Typography>
              {activeTab === tab && <View style={styles.subTabLine} />}
            </Pressable>
          ))}
        </View>
      </View>

      {/* À LIRE */}
      {activeTab === 'voir' && (
        isEmpty ? (
          <ScrollView
            contentContainerStyle={[styles.emptyWrap, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accentRed} colors={[COLORS.accentRed]} />}
          >
            <Ionicons name="book-outline" size={56} color={COLORS.textInkMuted} />
            <Typography variant="heading" color={COLORS.textInk} style={styles.emptyTitle}>Rien à lire</Typography>
            <Typography variant="body" color={COLORS.textInkMuted} style={styles.emptyText}>
              Ajoutez des mangas en statut «&nbsp;En cours&nbsp;» pour les voir ici.
            </Typography>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)/search' as never)}>
              <Typography variant="bodyBold" color={COLORS.onInk}>Rechercher</Typography>
            </Pressable>
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accentRed} colors={[COLORS.accentRed]} />}
          >
            {readingEntries.map((entry, i) => (
              <TrackerCard key={`${entry.mangaId}-${entry.source}`} entry={entry} index={i} />
            ))}
          </ScrollView>
        )
      )}

      {/* À VENIR */}
      {activeTab === 'venir' && (
        chaptersLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.accentRed} size="large" />
            <Typography variant="body" color={COLORS.textInkMuted}>Chargement du fil de chapitres…</Typography>
          </View>
        ) : avenirEmpty ? (
          <ScrollView
            contentContainerStyle={[styles.emptyWrap, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accentRed} colors={[COLORS.accentRed]} />}
          >
            <Ionicons name="calendar-outline" size={56} color={COLORS.textInkMuted} />
            <Typography variant="heading" color={COLORS.textInk} style={styles.emptyTitle}>
              {mangadexIds.length === 0 ? 'Aucune série liée à MangaDex' : 'Pas de nouveaux chapitres'}
            </Typography>
            <Typography variant="body" color={COLORS.textInkMuted} style={styles.emptyText}>
              {mangadexIds.length === 0
                ? 'Ajoutez des mangas disponibles sur MangaDex pour voir leurs nouveaux chapitres ici.'
                : 'Aucun nouveau chapitre sur MangaDex dans les 14 derniers jours pour vos mangas.'}
            </Typography>
          </ScrollView>
        ) : (
          <SectionList
            sections={avenir}
            keyExtractor={item => item.id}
            renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
            renderItem={({ item, index }) => {
              const entry = mangadexIdMap.get(item.mangaId);
              if (!entry) return null;
              return <ChapterCard chapter={item} entry={entry} index={index} />;
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accentRed} colors={[COLORS.accentRed]} />}
          />
        )
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },

  header: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    gap: 4,
    borderBottomWidth: BORDERS.hair,
    borderBottomColor: COLORS.line,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  title: { fontSize: 34, lineHeight: 36, flex: 1 },
  countBadge: {
    backgroundColor: COLORS.paperSunken,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },

  subTabs: { flexDirection: 'row', gap: SPACING.xl },
  subTabBtn: { paddingBottom: SPACING.md, paddingTop: SPACING.xs, position: 'relative' },
  subTabLabel: { color: COLORS.textInkMuted, fontSize: 13, letterSpacing: 0.8 },
  subTabLabelActive: { color: COLORS.textInk, fontFamily: FONTS.bodyBold },
  subTabLine: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.accentRed,
    borderRadius: 1,
  },

  listContent: { paddingTop: SPACING.sm },

  // TV Time card
  tvCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: BORDERS.hair,
    borderBottomColor: COLORS.line,
    backgroundColor: COLORS.paper,
  },
  tvCoverWrap: {
    borderRadius: RADIUS.sm,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
    flexShrink: 0,
  },
  tvCover: { width: 68, height: 96 },
  tvCoverEmpty: { backgroundColor: COLORS.paperSunken, alignItems: 'center', justifyContent: 'center' },
  tvBody: { flex: 1, gap: SPACING.xs },
  tvTitlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    backgroundColor: COLORS.paperSunken,
    borderRadius: RADIUS.full,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    maxWidth: '90%',
  },
  tvTitlePillText: {
    fontSize: 10,
    letterSpacing: 0.6,
    color: COLORS.textInk,
    fontFamily: FONTS.bodyBold,
    flexShrink: 1,
  },
  tvChapter: {
    fontFamily: FONTS.display,
    fontSize: 24,
    lineHeight: 28,
    color: COLORS.textInk,
    letterSpacing: 0.5,
  },
  tvChapterTitle: { fontSize: 12 },
  tvMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  tvBadge: {
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  tvBadgeNew: { backgroundColor: COLORS.warning },
  tvBadgeReadable: { backgroundColor: COLORS.statusCompleted },
  tvBadgeText: { fontSize: 8, letterSpacing: 0.8, color: COLORS.onInk, fontFamily: FONTS.bodyBold },
  tvBadgeNewText: { color: COLORS.onInk },
  quickCheckIn: { padding: SPACING.xs },

  // Section header
  sectionHeaderWrap: { alignItems: 'center', paddingVertical: SPACING.md },
  sectionPill: {
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  sectionPillText: {
    color: COLORS.onInk,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: FONTS.bodyBold,
  },

  // Empty / loading states
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
    paddingTop: 80,
  },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentRed,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
}));
