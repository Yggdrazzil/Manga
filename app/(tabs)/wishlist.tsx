import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useComicsStore } from '@/lib/store/comics';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, themedStyles } from '@/constants/theme';
import type { BDSeriesEntry, BDVolume } from '@/lib/types';

const TAB_BAR_HEIGHT = 88;

// TV Time-style staleness: after a month without activity, the series drops
// from "À lire" to "Pas lu depuis un moment".
const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

// ── À LIRE card ───────────────────────────────────────────────────────────────

function BDCard({ entry, index }: { entry: BDSeriesEntry; index: number }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const toggleVolumeRead = useComicsStore(s => s.toggleVolumeRead);
  const total = entry.series.totalVolumes;
  const readCount = entry.readVolumes.length;

  const nextVolume = useMemo(() => {
    for (let i = 1; i <= total; i++) {
      if (!entry.readVolumes.includes(i)) return i;
    }
    return null;
  }, [entry.readVolumes, total]);

  const navigate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/comic/${entry.seriesId}` as never);
  };

  const handleQuickCheckIn = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (nextVolume == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleVolumeRead(entry.seriesId, nextVolume);
  };

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
        onPress={navigate}
        accessibilityRole="button"
        accessibilityLabel={entry.series.title}
      >
        <View style={styles.tvCoverWrap}>
          {entry.series.coverImage ? (
            <Image source={{ uri: entry.series.coverImage }} style={styles.tvCover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.tvCover, styles.tvCoverEmpty]}>
              <Ionicons name="book" size={22} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>

        <View style={styles.tvBody}>
          <View style={styles.tvTitlePill}>
            <Typography variant="caption" style={styles.tvTitlePillText} numberOfLines={1}>
              {entry.series.title.toUpperCase()}
            </Typography>
            <Ionicons name="chevron-forward" size={10} color={COLORS.textInk} />
          </View>

          <Typography style={styles.tvVolume}>
            {nextVolume != null ? `Tome ${nextVolume}` : 'Terminé ✓'}
          </Typography>

          <View style={styles.tvMeta}>
            {total > 0 && (
              <View style={styles.tvBadge}>
                <Typography variant="caption" style={styles.tvBadgeText}>
                  {readCount}/{total}
                </Typography>
              </View>
            )}
            <Typography variant="caption" color={COLORS.textInkMuted}>
              {readCount === 0
                ? 'À commencer'
                : `${readCount} tome${readCount !== 1 ? 's' : ''} lu${readCount !== 1 ? 's' : ''}`}
            </Typography>
          </View>
        </View>

        {nextVolume != null ? (
          <Pressable
            onPress={handleQuickCheckIn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Marquer le tome ${nextVolume} comme lu`}
            style={({ pressed }) => [styles.quickCheckIn, pressed && { transform: [{ scale: 0.92 }] }]}
          >
            <Ionicons name="add-circle" size={30} color={COLORS.cyan} />
          </Pressable>
        ) : (
          <Ionicons name="checkmark-circle" size={28} color={COLORS.statusCompleted} />
        )}
      </Pressable>
    </MotiView>
  );
}

// ── Upcoming album card — TV Time "À VENIR" with a real release date ─────────

function UpcomingAlbumCard({ entry, volume, index }: { entry: BDSeriesEntry; volume: BDVolume; index: number }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const dateLabel = volume.publishedDate
    ? format(parseISO(volume.publishedDate), 'd MMMM yyyy', { locale: fr })
    : null;

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
          router.push(`/comic/${entry.seriesId}` as never);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${entry.series.title}, tome ${volume.num}${dateLabel ? `, sortie le ${dateLabel}` : ''}`}
      >
        <View style={styles.tvCoverWrap}>
          {(volume.coverImage ?? entry.series.coverImage) ? (
            <Image
              source={{ uri: volume.coverImage ?? entry.series.coverImage }}
              style={styles.tvCover}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.tvCover, styles.tvCoverEmpty]}>
              <Ionicons name="book" size={22} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>

        <View style={styles.tvBody}>
          <View style={styles.tvTitlePill}>
            <Typography variant="caption" style={styles.tvTitlePillText} numberOfLines={1}>
              {entry.series.title.toUpperCase()}
            </Typography>
            <Ionicons name="chevron-forward" size={10} color={COLORS.textInk} />
          </View>

          <Typography style={styles.tvVolume}>
            Tome {volume.num}{volume.subtitle ? ` — ${volume.subtitle}` : ''}
          </Typography>

          {dateLabel && (
            <View style={styles.tvMeta}>
              <View style={[styles.tvBadge, styles.tvBadgeUpcoming]}>
                <Typography variant="caption" style={styles.tvBadgeText}>
                  {dateLabel.toUpperCase()}
                </Typography>
              </View>
            </View>
          )}
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BDTrackerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'voir' | 'venir'>('voir');

  const entries = useComicsStore(s => s.entries);

  // À LIRE — TV Time grouping: active reads, stale reads (> 1 month), and the
  // plan-to-read / never-started queue
  const alireSections = useMemo(() => {
    const active: BDSeriesEntry[] = [];
    const stale: BDSeriesEntry[] = [];
    const notStarted: BDSeriesEntry[] = [];
    const now = Date.now();
    for (const e of entries) {
      if (e.status === 'COMPLETED' || e.status === 'DROPPED') continue;
      if (e.status === 'PLAN_TO_READ' || e.readVolumes.length === 0) notStarted.push(e);
      else if (now - new Date(e.updatedAt).getTime() > STALE_AFTER_MS) stale.push(e);
      else active.push(e);
    }
    const byUpdated = (a: BDSeriesEntry, b: BDSeriesEntry) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    active.sort(byUpdated);
    stale.sort(byUpdated);
    notStarted.sort(byUpdated);
    return [
      { title: 'À LIRE', data: active },
      { title: 'PAS LU DEPUIS UN MOMENT', data: stale },
      { title: 'PAS COMMENCÉ', data: notStarted },
    ].filter(s => s.data.length > 0);
  }, [entries]);

  // À VENIR: series where user has read every known volume (waiting for more)
  const completedEntries = useMemo(
    () => entries
      .filter(e => {
        const total = e.series.totalVolumes;
        return total > 0 && e.readVolumes.length >= total && e.status !== 'DROPPED';
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [entries],
  );

  // Announced albums with a future publication date (Wikidata provides them)
  const upcomingAlbums = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const items: Array<{ entry: BDSeriesEntry; volume: BDVolume }> = [];
    for (const e of entries) {
      if (e.status === 'DROPPED') continue;
      for (const v of e.series.volumes) {
        if (v.publishedDate && v.publishedDate.slice(0, 10) > today) {
          items.push({ entry: e, volume: v });
        }
      }
    }
    return items.sort((a, b) =>
      (a.volume.publishedDate ?? '').localeCompare(b.volume.publishedDate ?? ''),
    );
  }, [entries]);

  const venirSections = useMemo(() => {
    const sections: Array<{
      title: string;
      data: Array<{ key: string; entry: BDSeriesEntry; volume?: BDVolume }>;
    }> = [];
    if (upcomingAlbums.length > 0) {
      sections.push({
        title: 'SORTIES ANNONCÉES',
        data: upcomingAlbums.map(({ entry, volume }) => ({
          key: `${entry.seriesId}-v${volume.num}`,
          entry,
          volume,
        })),
      });
    }
    if (completedEntries.length > 0) {
      sections.push({
        title: 'À JOUR — EN ATTENTE DE SUITE',
        data: completedEntries.map(entry => ({ key: entry.seriesId, entry })),
      });
    }
    return sections;
  }, [upcomingAlbums, completedEntries]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Typography variant="kicker" color={COLORS.accentRed}>BIBLIOTHÈQUE</Typography>
        <View style={styles.headerRow}>
          <Typography variant="hero" color={COLORS.textInk} style={styles.title}>
            BD & Comics
          </Typography>
          <View style={styles.countBadge}>
            <Typography variant="label" color={COLORS.textInkMuted}>{entries.length}</Typography>
          </View>
        </View>

        <View style={styles.subTabs}>
          {(['voir', 'venir'] as const).map(tab => (
            <Pressable
              key={tab}
              style={styles.subTabBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab); }}
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

      {activeTab === 'voir' && (
        <View style={styles.tabPane}>
          {alireSections.length === 0 ? (
            <ScrollView contentContainerStyle={[styles.emptyWrap, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
              <Ionicons name="book-outline" size={56} color={COLORS.textInkMuted} />
              <Typography variant="heading" color={COLORS.textInk} style={styles.emptyTitle}>Rien à lire</Typography>
              <Typography variant="body" color={COLORS.textInkMuted} style={styles.emptyText}>
                Ajoutez des BD depuis l'onglet Rechercher.
              </Typography>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)/search' as never)}>
                <Typography variant="bodyBold" color={COLORS.onInk}>Rechercher</Typography>
              </Pressable>
            </ScrollView>
          ) : (
            <SectionList
              sections={alireSections}
              keyExtractor={item => item.seriesId}
              renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
              renderItem={({ item, index }) => <BDCard entry={item} index={index} />}
              stickySectionHeadersEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            />
          )}
        </View>
      )}

      {activeTab === 'venir' && (
        <View style={styles.tabPane}>
          {venirSections.length === 0 ? (
            <ScrollView contentContainerStyle={[styles.emptyWrap, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
              <Ionicons name="calendar-outline" size={56} color={COLORS.textInkMuted} />
              <Typography variant="heading" color={COLORS.textInk} style={styles.emptyTitle}>Aucune sortie attendue</Typography>
              <Typography variant="body" color={COLORS.textInkMuted} style={styles.emptyText}>
                Les tomes annoncés et les séries où vous avez tout lu apparaîtront ici.
              </Typography>
            </ScrollView>
          ) : (
            <SectionList
              sections={venirSections}
              keyExtractor={item => item.key}
              renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
              renderItem={({ item, index }) =>
                item.volume ? (
                  <UpcomingAlbumCard entry={item.entry} volume={item.volume} index={index} />
                ) : (
                  <BDCard entry={item.entry} index={index} />
                )
              }
              stickySectionHeadersEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            />
          )}
        </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
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
  subTabLine: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, backgroundColor: COLORS.accentRed, borderRadius: 1 },

  listContent: { paddingTop: SPACING.md },
  // TV Time-style contrast: raised cards float on a sunken pane
  tabPane: { flex: 1, backgroundColor: COLORS.paperSunken },

  tvCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.base, marginBottom: SPACING.md,
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
  tvCoverWrap: { borderRadius: RADIUS.sm, borderWidth: BORDERS.bold, borderColor: COLORS.ink, overflow: 'hidden', flexShrink: 0 },
  tvCover: { width: 68, height: 96 },
  tvCoverEmpty: { backgroundColor: COLORS.paperSunken, alignItems: 'center', justifyContent: 'center' },
  tvBody: { flex: 1, gap: SPACING.xs },
  tvTitlePill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 3, backgroundColor: COLORS.paperSunken,
    borderRadius: RADIUS.full, borderWidth: BORDERS.bold, borderColor: COLORS.ink,
    paddingHorizontal: SPACING.sm, paddingVertical: 3, maxWidth: '90%',
  },
  tvTitlePillText: { fontSize: 10, letterSpacing: 0.6, color: COLORS.textInk, fontFamily: FONTS.bodyBold, flexShrink: 1 },
  tvVolume: { fontFamily: FONTS.display, fontSize: 24, lineHeight: 28, color: COLORS.textInk, letterSpacing: 0.5 },
  tvMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  tvBadge: { backgroundColor: COLORS.cyan, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  tvBadgeUpcoming: { backgroundColor: COLORS.warning },
  tvBadgeText: { fontSize: 8, letterSpacing: 0.8, color: COLORS.onInk, fontFamily: FONTS.bodyBold },

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
  quickCheckIn: { padding: SPACING.xs },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.xl, paddingTop: 80 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: SPACING.sm, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, backgroundColor: COLORS.accentRed,
  },
}));
