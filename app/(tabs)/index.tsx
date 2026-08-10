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
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getChaptersForLibrary } from '@/lib/api/mangadex';
import { getDailyReleases } from '@/lib/api/mangaplus';
import { useLibraryStore } from '@/lib/store/library';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, themedStyles } from '@/constants/theme';
import type { LibraryEntry, MediaSource } from '@/lib/types';
import { coverSource } from '@/lib/utils/images';
import { readableInk } from '@/lib/utils/contrast';
import { isRecentRelease, releaseGroupLabel, releaseGroupRank } from '@/lib/utils/dates';

const TAB_BAR_HEIGHT = 88;

// ── Sorties : forme commune aux deux fils (séries suivies + MANGA Plus) ───────

interface ReleaseItem {
  key: string;
  mangaId: string;
  source: MediaSource;
  title: string;
  coverImage?: string;
  chapterLabel?: string;
  chapterSubtitle?: string;
  publishAt: string;
  followed: boolean;
  isReadable: boolean;
  isNewSeries?: boolean;
  viewCount?: number;
}

function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// TV Time-style staleness: after a month without marking a chapter read, the
// work drops from "À lire" to "Pas lu depuis un moment".
const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

function lastReadTime(entry: LibraryEntry): number {
  let max = 0;
  for (const note of Object.values(entry.chapterData ?? {})) {
    if (!note.readAt) continue;
    const t = new Date(note.readAt).getTime();
    if (t > max) max = t;
  }
  // Entries whose progress predates per-chapter readAt tracking fall back to
  // the entry's last update.
  return max > 0 ? max : new Date(entry.updatedAt).getTime();
}

// ── À LIRE card ───────────────────────────────────────────────────────────────

function TrackerCard({ entry, index }: { entry: LibraryEntry; index: number }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const progress = entry.progress;
  const total = entry.manga.chapters;
  // Single source of truth for display: the progress watermark
  const remaining = total != null ? Math.max(total - progress, 0) : null;
  const isNew0 = progress === 0;
  const isCaughtUp = total != null && progress >= total;

  return (
    <MotiView
      from={reduceMotion ? { opacity: 1, translateX: 0 } : { opacity: 0, translateX: -12 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={reduceMotion
        ? { type: 'timing', duration: 0 }
        : { type: 'spring', stiffness: 300, damping: 26, delay: Math.min(index * 45, 400) }}
    >
      <Pressable
        style={({ pressed }) => [styles.tvCard, pressed && styles.tvCardPressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/manga/${encodeURIComponent(entry.mangaId)}?source=${encodeURIComponent(entry.source)}` as never);
        }}
        accessibilityRole="button"
        accessibilityLabel={entry.manga.title.userPreferred}
      >
        <View style={styles.tvCoverWrap}>
          {entry.manga.coverImage ? (
            <Image source={coverSource(entry.manga.coverImage)} style={styles.tvCover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.tvCover, styles.tvCoverEmpty]}>
              <Ionicons name="book" size={22} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>

        <View style={styles.tvBody}>
          {/* Décor, pas un bouton : la carte entière porte déjà l'action. Un
              Pressable imbriqué dupliquait la cible pour les lecteurs d'écran
              tout en offrant une zone tactile de 19 px. */}
          <View style={styles.tvTitlePill}>
            <Typography variant="caption" style={styles.tvTitlePillText} numberOfLines={1}>
              {entry.manga.title.userPreferred.toUpperCase()}
            </Typography>
            <Ionicons name="chevron-forward" size={10} color={COLORS.textInk} />
          </View>

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

        {isCaughtUp && (
          <Ionicons name="checkmark-circle" size={28} color={COLORS.statusCompleted} />
        )}
      </Pressable>
    </MotiView>
  );
}

// ── SORTIES card (global MangaPlus daily releases) ────────────────────────────

function formatViews(n?: number): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function ReleaseCard({ release, index }: { release: ReleaseItem; index: number }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const views = formatViews(release.viewCount);
  const fresh = isRecentRelease(release.publishAt);
  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(
      `/manga/${encodeURIComponent(release.mangaId)}?source=${encodeURIComponent(release.source)}` as never,
    );
  };

  return (
    <MotiView
      from={reduceMotion ? { opacity: 1, translateX: 0 } : { opacity: 0, translateX: -12 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={reduceMotion
        ? { type: 'timing', duration: 0 }
        : { type: 'spring', stiffness: 300, damping: 26, delay: Math.min(index * 40, 400) }}
    >
      <Pressable
        style={({ pressed }) => [
          styles.tvCard,
          release.followed && styles.tvCardFollowed,
          pressed && styles.tvCardPressed,
        ]}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={
          `${release.title}${release.chapterLabel ? `, chapitre ${release.chapterLabel}` : ''}` +
          `${release.followed ? ', série suivie' : ''}`
        }
      >
        <View style={styles.tvCoverWrap}>
          {release.coverImage ? (
            <Image source={coverSource(release.coverImage)} style={styles.tvCover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.tvCover, styles.tvCoverEmpty]}>
              <Ionicons name="book" size={22} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>

        <View style={styles.tvBody}>
          <View style={styles.tvTitlePill}>
            <Typography variant="caption" style={styles.tvTitlePillText} numberOfLines={1}>
              {release.title.toUpperCase()}
            </Typography>
            <Ionicons name="chevron-forward" size={10} color={COLORS.textInk} />
          </View>

          <Typography style={styles.tvChapter}>
            {release.chapterLabel ? `Ch. ${release.chapterLabel}` : 'Nouveau chapitre'}
          </Typography>

          {release.chapterSubtitle && (
            <Typography variant="label" color={COLORS.textInkMuted} numberOfLines={1} style={styles.tvChapterTitle}>
              {release.chapterSubtitle}
            </Typography>
          )}

          <View style={styles.tvMeta}>
            {release.followed && (
              <View style={[styles.tvBadge, styles.tvBadgeFollowed]}>
                <Typography variant="caption" style={[styles.tvBadgeText, { color: readableInk(COLORS.accentRed) }]}>
                  SUIVI
                </Typography>
              </View>
            )}
            {(fresh || release.isNewSeries) && (
              <View style={[styles.tvBadge, styles.tvBadgeNew]}>
                <Typography variant="caption" style={[styles.tvBadgeText, { color: readableInk(COLORS.warning) }]}>
                  {release.isNewSeries ? 'NOUVELLE SÉRIE' : 'NOUVEAU'}
                </Typography>
              </View>
            )}
            {release.source === 'mangaplus' && (
              <View style={[styles.tvBadge, styles.tvBadgeReadable]}>
                <Typography variant="caption" style={[styles.tvBadgeText, { color: readableInk(COLORS.statusCompleted) }]}>MANGA PLUS</Typography>
              </View>
            )}
            {views && (
              <Typography variant="caption" color={COLORS.textInkMuted}>
                {views} vues
              </Typography>
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
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<'voir' | 'venir'>('voir');
  const [refreshing, setRefreshing] = useState(false);

  // Tab content slides in from the side of the tab being entered
  const tabEnter = (tab: 'voir' | 'venir') =>
    reduceMotion
      ? { opacity: 1, translateX: 0 }
      : { opacity: 0, translateX: tab === 'voir' ? -16 : 16 };

  const entries = useLibraryStore(s => s.entries);
  // TV Time grouping: active reads, stale reads (> 1 month), never started
  const alireSections = useMemo(() => {
    const active: LibraryEntry[] = [];
    const stale: LibraryEntry[] = [];
    const notStarted: LibraryEntry[] = [];
    const now = Date.now();
    for (const e of entries) {
      // Works shelved as "À lire" (plan-to-read) queue up under Pas commencé
      if (e.status === 'PLAN_TO_READ') {
        notStarted.push(e);
        continue;
      }
      if (e.status !== 'READING') continue;
      const started = e.progress > 0 || (e.readChapterIds?.length ?? 0) > 0;
      if (!started) notStarted.push(e);
      else if (now - lastReadTime(e) > STALE_AFTER_MS) stale.push(e);
      else active.push(e);
    }
    const byLastRead = (a: LibraryEntry, b: LibraryEntry) => lastReadTime(b) - lastReadTime(a);
    active.sort(byLastRead);
    stale.sort(byLastRead);
    notStarted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return [
      { title: 'À LIRE', data: active },
      { title: 'PAS LU DEPUIS UN MOMENT', data: stale },
      { title: 'PAS COMMENCÉ', data: notStarted },
    ].filter(s => s.data.length > 0);
  }, [entries]);

  // ── Onglet SORTIES ──────────────────────────────────────────────────────────
  // Deux fils complémentaires : les nouveaux chapitres des séries SUIVIES
  // (le plus utile au quotidien) et le fil global MANGA Plus (~17h00 Paris).

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
    data: libraryChapters,
    isLoading: libraryLoading,
    isError: libraryError,
    refetch: refetchLibrary,
  } = useQuery({
    queryKey: ['library-chapters', mangadexIds.join(',')],
    queryFn: () => getChaptersForLibrary(mangadexIds),
    enabled: mangadexIds.length > 0,
    staleTime: 1000 * 60 * 15,
  });

  const {
    data: releases,
    isLoading: releasesLoading,
    isError: releasesError,
    error: releasesErrorObj,
    refetch: refetchReleases,
  } = useQuery({
    queryKey: ['mangaplus-daily-releases'],
    queryFn: getDailyReleases,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  // Les chapitres non lus des séries suivies, en tête de liste.
  const mesSorties = useMemo<ReleaseItem[]>(() => {
    if (!libraryChapters) return [];
    const readIds = new Set(entries.flatMap(e => e.readChapterIds ?? []));
    return libraryChapters
      .filter(ch => !readIds.has(ch.id) && mangadexIdMap.has(ch.mangaId))
      .map(ch => {
        const entry = mangadexIdMap.get(ch.mangaId)!;
        return {
          key: `lib-${ch.id}`,
          mangaId: entry.mangaId,
          source: entry.source,
          title: entry.manga.title.userPreferred,
          coverImage: entry.manga.coverImage,
          chapterLabel: ch.chapter,
          chapterSubtitle: ch.title,
          publishAt: ch.publishAt,
          followed: true,
          isReadable: ch.isReadable,
        };
      });
  }, [libraryChapters, entries, mangadexIdMap]);

  const feedGlobal = useMemo<ReleaseItem[]>(() => {
    if (!releases) return [];
    // Une série suivie déjà listée au-dessus ne doit pas réapparaître.
    const seen = new Set(mesSorties.map(r => normTitle(r.title)));
    return releases
      .filter(r => !seen.has(normTitle(r.manga.title.userPreferred)))
      .map(r => ({
        key: `mp-${r.manga.id}`,
        mangaId: r.manga.id,
        source: 'mangaplus' as const,
        title: r.manga.title.userPreferred,
        coverImage: r.manga.coverImage,
        chapterLabel: r.chapterLabel,
        chapterSubtitle: r.chapterSubtitle,
        publishAt: r.publishAt,
        followed: false,
        isReadable: true,
        isNewSeries: r.isNew,
        viewCount: r.viewCount,
      }));
  }, [releases, mesSorties]);

  // Regroupement par JOUR CALENDAIRE : un chapitre paru hier à 23h ne doit pas
  // s'afficher sous « AUJOURD'HUI » sous prétexte qu'il date de moins de 24 h.
  const sorties = useMemo(() => {
    const all = [...mesSorties, ...feedGlobal];
    if (all.length === 0) return [];
    const now = new Date();
    const groups = new Map<string, { rank: number; data: ReleaseItem[] }>();
    for (const r of all) {
      // Le fil global est celui « du jour » : une date absente y vaut aujourd'hui.
      const iso = r.publishAt || (r.followed ? '' : now.toISOString());
      const label = releaseGroupLabel(iso, now);
      const rank = releaseGroupRank(iso, now);
      const bucket = groups.get(label) ?? { rank, data: [] };
      bucket.data.push(r);
      groups.set(label, bucket);
    }
    return Array.from(groups.entries())
      .map(([title, b]) => ({ title, rank: b.rank, data: b.data }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ title, data }) => ({
        title,
        // Les séries suivies d'abord, puis par popularité.
        data: data.sort(
          (x, y) => Number(y.followed) - Number(x.followed) || (y.viewCount ?? 0) - (x.viewCount ?? 0),
        ),
      }));
  }, [mesSorties, feedGlobal]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchReleases(), mangadexIds.length > 0 ? refetchLibrary() : null]);
    setRefreshing(false);
  };

  const isEmpty = alireSections.length === 0;
  const sortiesLoading = releasesLoading || libraryLoading;
  const sortiesEmpty = sorties.length === 0 && !sortiesLoading;
  // Le fil global peut échouer alors que les séries suivies s'affichent : on
  // ne montre l'erreur que si l'écran serait vide autrement.
  const showReleasesError = releasesError && mesSorties.length === 0;

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
                {tab === 'voir' ? 'À LIRE' : 'SORTIES'}
              </Typography>
              {activeTab === tab && <View style={styles.subTabLine} />}
            </Pressable>
          ))}
        </View>
      </View>

      {/* À LIRE */}
      {activeTab === 'voir' && (
        <MotiView
          key="voir"
          from={tabEnter('voir')}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          style={styles.tabPane}
        >
        {isEmpty ? (
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
          <SectionList
            sections={alireSections}
            keyExtractor={item => `${item.mangaId}-${item.source}`}
            renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
            renderItem={({ item, index }) => <TrackerCard entry={item} index={index} />}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accentRed} colors={[COLORS.accentRed]} />}
          />
        )}
        </MotiView>
      )}

      {/* SORTIES — séries suivies + fil global MANGA Plus */}
      {activeTab === 'venir' && (
        <MotiView
          key="venir"
          from={tabEnter('venir')}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          style={styles.tabPane}
        >
        {sortiesLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.accentRed} size="large" />
            <Typography variant="body" color={COLORS.textInkMuted}>Chargement des sorties du jour…</Typography>
          </View>
        ) : sortiesEmpty ? (
          <ScrollView
            contentContainerStyle={[styles.emptyWrap, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accentRed} colors={[COLORS.accentRed]} />}
          >
            <Ionicons name={showReleasesError ? 'cloud-offline-outline' : 'calendar-outline'} size={56} color={COLORS.textInkMuted} />
            <Typography variant="heading" color={COLORS.textInk} style={styles.emptyTitle}>
              {showReleasesError ? 'Sorties indisponibles' : 'Pas encore de sorties'}
            </Typography>
            <Typography variant="body" color={COLORS.textInkMuted} style={styles.emptyText}>
              {showReleasesError
                ? `Impossible de récupérer les sorties MANGA Plus${
                    releasesErrorObj instanceof Error ? ` (${releasesErrorObj.message})` : ''
                  }. Tirez vers le bas pour réessayer.`
                : 'Les nouveaux chapitres MANGA Plus paraissent chaque jour vers 17h00. Revenez plus tard ou tirez pour actualiser.'}
            </Typography>
          </ScrollView>
        ) : (
          <SectionList
            sections={sorties}
            keyExtractor={item => item.key}
            renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
            renderItem={({ item, index }) => <ReleaseCard release={item} index={index} />}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Typography variant="caption" color={COLORS.textInkMuted} style={styles.sortiesHint}>
                {releasesError
                  // L'en-tête ne doit pas affirmer que les séries suivies sont
                  // listées quand leur source est tombée.
                  ? (libraryError
                      ? 'Sources indisponibles · tirez pour réessayer'
                      : 'Vos séries suivies · fil MANGA Plus indisponible')
                  : (libraryError
                      ? 'Sorties MANGA Plus · vos séries suivies indisponibles'
                      : 'Vos séries suivies · sorties MANGA Plus (vers 17h00)')}
              </Typography>
            }
            contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accentRed} colors={[COLORS.accentRed]} />}
          />
        )}
        </MotiView>
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

  listContent: { paddingTop: SPACING.md },
  sortiesHint: {
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.xs,
  },
  // TV Time-style contrast: raised cards float on a sunken pane
  tabPane: { flex: 1, backgroundColor: COLORS.paperSunken },

  // TV Time card
  tvCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.paperRaised,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  tvCardPressed: { backgroundColor: COLORS.paper },
  // Liseré d'accent : distingue une sortie d'une série suivie d'une découverte.
  tvCardFollowed: { borderLeftWidth: 3, borderLeftColor: COLORS.accentRed },
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
  tvBadgeFollowed: { backgroundColor: COLORS.accentRed },
  // Encre calculée depuis le fond : les couleurs d'accent varient d'un thème à
  // l'autre et l'encre codée en dur tombait à 1,4:1 sur l'ambre de Néo-Tokyo.
  tvBadgeText: {
    fontSize: 8,
    letterSpacing: 0.8,
    color: readableInk(COLORS.accentRed),
    fontFamily: FONTS.bodyBold,
  },

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
