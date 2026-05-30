import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useComicsStore } from '@/lib/store/comics';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import type { ComicEntry } from '@/lib/types';

const TAB_BAR_HEIGHT = 88;

// ── À VOIR card ───────────────────────────────────────────────────────────────

function BDCard({ entry, index }: { entry: ComicEntry; index: number }) {
  const router = useRouter();
  const total = entry.totalVolumes ?? entry.comic.totalVolumes ?? 0;
  const readCount = entry.readVolumes.length;

  const nextVolume = useMemo(() => {
    if (total === 0) return null;
    for (let i = 1; i <= total; i++) {
      if (!entry.readVolumes.includes(i)) return i;
    }
    return null;
  }, [entry.readVolumes, total]);

  const isNew = readCount === 0;

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
          router.push(`/comic/${entry.comicId}` as never);
        }}
        accessibilityRole="button"
        accessibilityLabel={entry.comic.title}
      >
        <View style={styles.tvCoverWrap}>
          {entry.comic.coverImage ? (
            <Image source={{ uri: entry.comic.coverImage }} style={styles.tvCover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.tvCover, styles.tvCoverEmpty]}>
              <Ionicons name="book" size={22} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>

        <View style={styles.tvBody}>
          <Pressable
            style={styles.tvTitlePill}
            onPress={() => router.push(`/comic/${entry.comicId}` as never)}
            hitSlop={4}
          >
            <Typography variant="caption" style={styles.tvTitlePillText} numberOfLines={1}>
              {entry.comic.title.toUpperCase()}
            </Typography>
            <Ionicons name="chevron-forward" size={10} color={COLORS.textInk} />
          </Pressable>

          <Typography style={styles.tvVolume}>
            {nextVolume != null
              ? `Tome ${nextVolume}`
              : total > 0
              ? 'Terminé ✓'
              : 'Tome 1'}
          </Typography>

          <View style={styles.tvMeta}>
            {readCount > 0 && total > 0 && (
              <View style={styles.tvBadge}>
                <Typography variant="caption" style={styles.tvBadgeText}>
                  {readCount}/{total}
                </Typography>
              </View>
            )}
            <Typography variant="caption" color={COLORS.textInkMuted}>
              {isNew
                ? 'À commencer'
                : total > 0
                ? `${readCount} tome${readCount !== 1 ? 's' : ''} lus`
                : `${readCount} lu${readCount !== 1 ? 's' : ''}`}
            </Typography>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={COLORS.textInkFaint} />
      </Pressable>
    </MotiView>
  );
}

// ── À VENIR card ──────────────────────────────────────────────────────────────

function UpcomingBDCard({ entry, index }: { entry: ComicEntry; index: number }) {
  const router = useRouter();
  const total = entry.totalVolumes ?? entry.comic.totalVolumes ?? 0;
  const readCount = entry.readVolumes.length;
  const remaining = total > 0 ? total - readCount : null;

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
          router.push(`/comic/${entry.comicId}` as never);
        }}
      >
        <View style={styles.tvCoverWrap}>
          {entry.comic.coverImage ? (
            <Image source={{ uri: entry.comic.coverImage }} style={styles.tvCover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.tvCover, styles.tvCoverEmpty]}>
              <Ionicons name="book" size={22} color={COLORS.textInkMuted} />
            </View>
          )}
        </View>

        <View style={styles.tvBody}>
          <Pressable
            style={styles.tvTitlePill}
            onPress={() => router.push(`/comic/${entry.comicId}` as never)}
            hitSlop={4}
          >
            <Typography variant="caption" style={styles.tvTitlePillText} numberOfLines={1}>
              {entry.comic.title.toUpperCase()}
            </Typography>
            <Ionicons name="chevron-forward" size={10} color={COLORS.textInk} />
          </Pressable>

          <Typography style={styles.tvVolume}>Prochainement</Typography>

          <View style={styles.tvMeta}>
            {remaining !== null && (
              <Typography variant="caption" color={COLORS.textInkMuted}>
                {remaining} tome{remaining !== 1 ? 's' : ''} restant{remaining !== 1 ? 's' : ''}
              </Typography>
            )}
            <View style={styles.tvBadgeInfo}>
              <Ionicons name="time-outline" size={11} color={COLORS.textInkMuted} />
              <Typography variant="caption" color={COLORS.textInkMuted}>Dates non disponibles</Typography>
            </View>
          </View>
        </View>
      </Pressable>
    </MotiView>
  );
}

// ── SCREEN ────────────────────────────────────────────────────────────────────

export default function BDTrackerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'voir' | 'venir'>('voir');
  const [refreshing] = useState(false);

  const entries = useComicsStore(s => s.entries);

  const readingEntries = useMemo(
    () => entries
      .filter(e => e.status === 'READING')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [entries],
  );

  const unfinishedOngoing = useMemo(
    () => entries
      .filter(e => {
        const total = e.totalVolumes ?? e.comic.totalVolumes ?? 0;
        const remaining = total > 0 ? total - e.readVolumes.length : null;
        return e.status !== 'COMPLETED' && e.status !== 'DROPPED' && remaining !== 0;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [entries],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
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
                {tab === 'voir' ? 'À VOIR' : 'À VENIR'}
              </Typography>
              {activeTab === tab && <View style={styles.subTabLine} />}
            </Pressable>
          ))}
        </View>
      </View>

      {/* À VOIR */}
      {activeTab === 'voir' && (
        readingEntries.length === 0 ? (
          <ScrollView
            contentContainerStyle={[styles.emptyWrap, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {}} tintColor={COLORS.accentRed} colors={[COLORS.accentRed]} />}
          >
            <Ionicons name="book-outline" size={56} color={COLORS.textInkMuted} />
            <Typography variant="heading" color={COLORS.textInk} style={styles.emptyTitle}>Rien à lire</Typography>
            <Typography variant="body" color={COLORS.textInkMuted} style={styles.emptyText}>
              Ajoutez des BD en statut «&nbsp;En cours&nbsp;» pour les voir ici.
            </Typography>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)/search' as never)}>
              <Typography variant="bodyBold" color={COLORS.onInk}>Rechercher</Typography>
            </Pressable>
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
          >
            {readingEntries.map((entry, i) => (
              <BDCard key={entry.comicId} entry={entry} index={i} />
            ))}
          </ScrollView>
        )
      )}

      {/* À VENIR */}
      {activeTab === 'venir' && (
        unfinishedOngoing.length === 0 ? (
          <ScrollView
            contentContainerStyle={[styles.emptyWrap, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
          >
            <Ionicons name="calendar-outline" size={56} color={COLORS.textInkMuted} />
            <Typography variant="heading" color={COLORS.textInk} style={styles.emptyTitle}>Aucune série en cours</Typography>
            <Typography variant="body" color={COLORS.textInkMuted} style={styles.emptyText}>
              Recherchez des BD à suivre dans l'onglet Rechercher.
            </Typography>
          </ScrollView>
        ) : (
          <>
            <View style={styles.infoBar}>
              <Ionicons name="information-circle-outline" size={14} color={COLORS.textInkMuted} />
              <Typography variant="caption" color={COLORS.textInkMuted} style={styles.infoText}>
                Dates de sortie indisponibles — séries en cours de suivi
              </Typography>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
            >
              {unfinishedOngoing.map((entry, i) => (
                <UpcomingBDCard key={entry.comicId} entry={entry} index={i} />
              ))}
            </ScrollView>
          </>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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

  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.paperSunken,
    borderBottomWidth: BORDERS.hair,
    borderBottomColor: COLORS.line,
  },
  infoText: { flex: 1 },

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
  tvVolume: {
    fontFamily: FONTS.display,
    fontSize: 24,
    lineHeight: 28,
    color: COLORS.textInk,
    letterSpacing: 0.5,
  },
  tvMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  tvBadge: {
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  tvBadgeText: { fontSize: 8, letterSpacing: 0.8, color: COLORS.onInk, fontFamily: FONTS.bodyBold },
  tvBadgeInfo: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  // Empty / loading
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
});
