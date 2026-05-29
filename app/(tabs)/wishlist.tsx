import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { format, isThisWeek, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getChaptersForLibrary } from '@/lib/api/mangadex';
import { useLibraryStore } from '@/lib/store/library';
import { Typography } from '@/components/ui/Typography';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BORDERS, COLORS, RADIUS, SPACING } from '@/constants/theme';
import type { LibraryEntry, MangaChapter } from '@/lib/types';

const TAB_BAR_HEIGHT = 88;
const COLUMNS = 3;
const GUTTER = SPACING.md;
const CARD_WIDTH = Math.floor(
  (Dimensions.get('window').width - SPACING.base * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS
);

function getDateLabel(publishAt: string): string {
  const date = parseISO(publishAt);
  if (isYesterday(date)) return 'HIER';
  if (isToday(date)) return "AUJOURD'HUI";
  if (isTomorrow(date)) return 'DEMAIN';
  if (isThisWeek(date, { weekStartsOn: 1 })) return 'CETTE SEMAINE';
  if (date > new Date()) return format(date, 'MMMM yyyy', { locale: fr }).toUpperCase();
  return format(date, 'd MMM', { locale: fr }).toUpperCase();
}

function WishlistCard({ entry, index }: { entry: LibraryEntry; index: number }) {
  const router = useRouter();
  const updateStatus = useLibraryStore(s => s.updateStatus);

  const title = entry.manga.title.english ?? entry.manga.title.romaji ?? entry.manga.title.userPreferred;
  const imageHeight = Math.round(CARD_WIDTH * 1.42);

  const startReading = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateStatus(entry.mangaId, entry.source, 'READING');
  };

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24, delay: (index % 9) * 45 }}
      style={{ width: CARD_WIDTH }}
    >
      <Pressable onPress={() => router.push(`/manga/${entry.mangaId}?source=${entry.source}`)}>
        <View style={[styles.poster, { height: imageHeight }]}>
          <Image
            source={{ uri: entry.manga.coverImage }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'LKO2?V%2Tw=w]~RBVZRi};RPxuwH' }}
          />
          <View style={styles.typeBadgeWrap}>
            <TypeBadge type={entry.manga.type} />
          </View>
          <Pressable
            style={styles.startBtn}
            hitSlop={8}
            onPress={startReading}
            accessibilityLabel={`Commencer ${title}`}
          >
            <Ionicons name="play" size={12} color={COLORS.onInk} />
          </Pressable>
        </View>
      </Pressable>
      <Typography variant="label" numberOfLines={2} color={COLORS.textInk} style={styles.cardTitle}>
        {title}
      </Typography>
    </MotiView>
  );
}

function WishlistTab({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const entries = useLibraryStore(s => s.entries);
  const wishlist = entries
    .filter(e => e.status === 'PLAN_TO_READ')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
    >
      {wishlist.length === 0 ? (
        <EmptyState
          icon="🔖"
          title="Rien à lire pour l'instant"
          subtitle="Ajoutez des œuvres à votre liste « À lire » depuis l'écran Découvrir pour les retrouver ici en un clic."
        />
      ) : (
        <View style={styles.grid}>
          {wishlist.map((entry, index) => (
            <WishlistCard key={`${entry.source}-${entry.mangaId}`} entry={entry} index={index} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ChapterCalendarSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      {[0, 1, 2].map(i => (
        <MotiView
          key={i}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 300, delay: i * 80 }}
          style={styles.skeletonRow}
        >
          <Skeleton width={48} height={68} borderRadius={RADIUS.sm} />
          <View style={styles.skeletonContent}>
            <Skeleton width={120} height={22} borderRadius={RADIUS.full} />
            <Skeleton width={90} height={14} style={{ marginTop: SPACING.xs }} />
            <Skeleton width={140} height={12} style={{ marginTop: 4 }} />
          </View>
          <Skeleton width={28} height={28} borderRadius={14} />
        </MotiView>
      ))}
    </View>
  );
}

function UpcomingChapterRow({
  chapter,
  entry,
  isRead,
  onToggle,
  index,
}: {
  chapter: MangaChapter;
  entry: LibraryEntry;
  isRead: boolean;
  onToggle: () => void;
  index: number;
}) {
  const router = useRouter();
  const title =
    entry.manga.title.english ?? entry.manga.title.romaji ?? entry.manga.title.userPreferred;

  const isNew = new Date(chapter.publishAt) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: Math.min(index * 40, 400) }}
      style={styles.upcomingRow}
    >
      <Pressable
        style={styles.upcomingCoverFrame}
        onPress={() => router.push(`/manga/${entry.mangaId}?source=${entry.source}`)}
        accessibilityLabel={`Voir ${title}`}
      >
        <Image
          source={{ uri: entry.manga.coverImage }}
          style={styles.upcomingCover}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </Pressable>

      <View style={styles.upcomingInfo}>
        <Pressable
          style={styles.titlePill}
          onPress={() => router.push(`/manga/${entry.mangaId}?source=${entry.source}`)}
          accessibilityLabel={`Ouvrir ${title}`}
        >
          <Typography variant="label" numberOfLines={1} color={COLORS.accentRed} style={styles.titlePillText}>
            {title} ›
          </Typography>
        </Pressable>

        <View style={styles.chapterLine}>
          <Typography variant="display" color={COLORS.textInk} style={styles.chapterLabel}>
            CH.{chapter.chapter}
          </Typography>
          {chapter.title ? (
            <Typography variant="label" numberOfLines={1} color={COLORS.textInkMuted} style={styles.chapterTitle}>
              {chapter.title}
            </Typography>
          ) : null}
        </View>

        {isNew && (
          <View style={styles.newBadge}>
            <Typography variant="kicker" color={COLORS.onInk} style={styles.newBadgeText}>
              NOUVEAU
            </Typography>
          </View>
        )}
      </View>

      <Pressable
        style={styles.checkBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle();
        }}
        hitSlop={8}
        accessibilityLabel={isRead ? 'Marquer non lu' : 'Marquer lu'}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isRead }}
      >
        <Ionicons
          name={isRead ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={isRead ? COLORS.statusCompleted : COLORS.textInkMuted}
        />
      </Pressable>
    </MotiView>
  );
}

function UpcomingTab({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const entries = useLibraryStore(s => s.entries);
  const toggleChapterRead = useLibraryStore(s => s.toggleChapterRead);

  const readingEntries = entries.filter(e => e.status === 'READING');

  const mangadexIds = readingEntries
    .map(e => (e.source === 'mangadex' ? e.mangaId : e.manga.mangadexId))
    .filter((id): id is string => !!id);

  const entryByMangadexId = new Map(
    readingEntries
      .filter(e => e.source === 'mangadex' || !!e.manga.mangadexId)
      .map(e => [e.source === 'mangadex' ? e.mangaId : e.manga.mangadexId!, e])
  );

  const { data: chapters, isLoading } = useQuery({
    queryKey: ['library-chapters', mangadexIds],
    queryFn: () => getChaptersForLibrary(mangadexIds),
    enabled: mangadexIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  if (readingEntries.length === 0) {
    return (
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
        <EmptyState icon="📅" title="Aucun manga en cours" subtitle="Marquez des œuvres comme « En cours » pour suivre les nouvelles sorties." />
      </ScrollView>
    );
  }

  if (mangadexIds.length === 0) {
    return (
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
        <EmptyState icon="🔗" title="Aucun lien MangaDex" subtitle="Vos séries en cours n'ont pas encore de lien MangaDex pour les sorties." />
      </ScrollView>
    );
  }

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
        <ChapterCalendarSkeleton />
      </ScrollView>
    );
  }

  const allChapters = chapters ?? [];

  const visibleChapters = allChapters.filter(ch => {
    const entry = entryByMangadexId.get(ch.mangaId);
    if (!entry) return false;
    const ids = entry.readChapterIds ?? [];
    return !ids.includes(ch.id);
  });

  if (visibleChapters.length === 0) {
    return (
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
        <EmptyState icon="✅" title="Tout à jour !" subtitle="Aucune sortie récente à lire pour vos séries en cours." />
      </ScrollView>
    );
  }

  const grouped = new Map<string, MangaChapter[]>();
  for (const ch of visibleChapters) {
    const label = getDateLabel(ch.publishAt);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(ch);
  }

  let globalIndex = 0;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.upcomingScroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
    >
      {Array.from(grouped.entries()).map(([label, groupChapters]) => (
        <View key={label} style={styles.dateGroup}>
          <View style={styles.datePill}>
            <Typography variant="kicker" color={COLORS.onInk} style={styles.datePillText}>
              {label}
            </Typography>
          </View>

          <View style={styles.dateGroupItems}>
            {groupChapters.map(ch => {
              const entry = entryByMangadexId.get(ch.mangaId);
              if (!entry) return null;
              const idx = globalIndex++;
              const readIds = entry.readChapterIds ?? [];
              const isRead = readIds.includes(ch.id);
              return (
                <UpcomingChapterRow
                  key={ch.id}
                  chapter={ch}
                  entry={entry}
                  isRead={isRead}
                  onToggle={() => toggleChapterRead(entry.mangaId, entry.source, ch.id, parseFloat(ch.chapter))}
                  index={idx}
                />
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'wishlist' | 'upcoming'>('wishlist');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Typography variant="kicker" color={COLORS.accentRed}>LISTE DE LECTURE</Typography>
        <Typography variant="hero" color={COLORS.textInk} style={styles.title}>À lire</Typography>

        <View style={styles.subTabs}>
          {(['wishlist', 'upcoming'] as const).map(tab => (
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
                {tab === 'wishlist' ? 'À lire' : 'À paraître'}
              </Typography>
              {activeTab === tab && <View style={styles.subTabLine} />}
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === 'wishlist' ? (
        <WishlistTab insets={insets} />
      ) : (
        <UpcomingTab insets={insets} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  header: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: 0,
    gap: 4,
  },
  title: { fontSize: 38, lineHeight: 40, marginBottom: SPACING.sm },

  subTabs: {
    flexDirection: 'row',
    borderBottomWidth: BORDERS.hair,
    borderBottomColor: COLORS.line,
  },
  subTabBtn: {
    paddingBottom: SPACING.md,
    paddingRight: SPACING.xl,
    position: 'relative',
  },
  subTabLabel: {
    color: COLORS.textInkMuted,
    fontSize: 14,
  },
  subTabLabelActive: {
    color: COLORS.textInk,
  },
  subTabLine: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: SPACING.xl,
    height: 2,
    backgroundColor: COLORS.accentRed,
    borderRadius: 1,
  },

  scroll: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, flexGrow: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GUTTER },
  poster: {
    width: '100%',
    borderRadius: RADIUS.md,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
    backgroundColor: COLORS.paperSunken,
  },
  typeBadgeWrap: {
    position: 'absolute',
    bottom: SPACING.xs,
    left: SPACING.xs,
  },
  startBtn: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentRed,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { marginTop: SPACING.sm, fontSize: 12, lineHeight: 16 },

  upcomingScroll: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, gap: SPACING.lg },
  dateGroup: { gap: SPACING.sm },
  datePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  datePillText: { fontSize: 10, letterSpacing: 1.2 },
  dateGroupItems: { gap: SPACING.sm },

  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.paperRaised,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
  },
  upcomingCoverFrame: {
    borderRadius: RADIUS.sm,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
  },
  upcomingCover: { width: 48, height: 68 },
  upcomingInfo: { flex: 1, gap: SPACING.xs },
  titlePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
    borderWidth: BORDERS.hair,
    borderColor: `${COLORS.accentRed}44`,
    maxWidth: '100%',
  },
  titlePillText: { fontSize: 11 },
  chapterLine: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  chapterLabel: { fontSize: 18, lineHeight: 20, letterSpacing: 0.5 },
  chapterTitle: { flex: 1, fontSize: 12 },
  newBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  newBadgeText: { fontSize: 9, letterSpacing: 1 },
  checkBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  skeletonContainer: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, gap: SPACING.md },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.paperRaised,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
  },
  skeletonContent: { flex: 1, gap: SPACING.xs },
});
