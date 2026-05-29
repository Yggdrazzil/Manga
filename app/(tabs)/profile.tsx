import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, STATUS_LABELS } from '@/constants/theme';
import { useLibraryStore } from '@/lib/store/library';
import { confirmAction } from '@/lib/utils/confirm';
import type { LibraryEntry, ReadingStatus } from '@/lib/types';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Typography } from '@/components/ui/Typography';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { Ionicons } from '@expo/vector-icons';

const TAB_BAR_HEIGHT = 88;

const STATUS_COLORS: Record<ReadingStatus, string> = {
  READING: COLORS.statusReading,
  COMPLETED: COLORS.statusCompleted,
  PLAN_TO_READ: COLORS.statusPlan,
  DROPPED: COLORS.statusDropped,
  PAUSED: COLORS.statusPaused,
};

type Filter = 'ALL' | ReadingStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Historique' },
  { key: 'READING', label: STATUS_LABELS.READING },
  { key: 'COMPLETED', label: STATUS_LABELS.COMPLETED },
  { key: 'PAUSED', label: STATUS_LABELS.PAUSED },
  { key: 'DROPPED', label: STATUS_LABELS.DROPPED },
];

function StatPill({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statPill}>
      <Typography variant="display" color={COLORS.onInk} style={styles.statValue}>{value}</Typography>
      <Typography variant="caption" color={COLORS.onInkMuted} style={styles.statLabel}>{label}</Typography>
    </View>
  );
}

function StatusBar({ status, count, total }: { status: ReadingStatus; count: number; total: number }) {
  const percent = total > 0 ? count / total : 0;
  const color = STATUS_COLORS[status];
  return (
    <View style={styles.statusBarRow}>
      <View style={styles.statusBarLabel}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Typography variant="label" color={COLORS.textInk}>{STATUS_LABELS[status]}</Typography>
      </View>
      <View style={styles.statusBarTrack}>
        <View style={[styles.statusBarFill, { backgroundColor: color, flex: percent }]} />
        {percent < 1 && <View style={{ flex: 1 - percent }} />}
      </View>
      <Typography variant="label" color={COLORS.textInkMuted} style={styles.statusCount}>{count}</Typography>
    </View>
  );
}

function HistoryRow({ entry }: { entry: LibraryEntry }) {
  const router = useRouter();
  const updateProgress = useLibraryStore(s => s.updateProgress);
  const removeEntry = useLibraryStore(s => s.removeEntry);

  const title = entry.manga.title.english ?? entry.manga.title.romaji ?? entry.manga.title.userPreferred;
  const percent = entry.manga.chapters ? Math.min(entry.progress / entry.manga.chapters, 1) : 0;
  const relative = formatDistanceToNow(new Date(entry.updatedAt), { addSuffix: true, locale: fr });

  const confirmRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    confirmAction({
      title,
      message: 'Retirer cette œuvre de votre historique ?',
      confirmLabel: 'Retirer',
      destructive: true,
      onConfirm: () => removeEntry(entry.mangaId, entry.source),
    });
  };

  return (
    <Pressable
      onPress={() => router.push(`/manga/${entry.mangaId}?source=${entry.source}`)}
      onLongPress={confirmRemove}
    >
      <Panel variant="paper" bordered style={styles.row}>
        <View style={styles.rowInner}>
          <View style={styles.rowCoverFrame}>
            <Image
              source={{ uri: entry.manga.coverImage }}
              style={styles.rowCover}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
          <View style={styles.rowInfo}>
            <Typography variant="subheading" numberOfLines={2} color={COLORS.textInk} style={styles.rowTitle}>{title}</Typography>
            <View style={styles.rowMeta}>
              <StatusBadge status={entry.status} compact />
              <Typography variant="label" color={COLORS.textInkMuted}>{relative}</Typography>
              {entry.score ? (
                <Typography variant="label" color={COLORS.warning}>★ {entry.score}</Typography>
              ) : null}
            </View>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percent * 100}%` as `${number}%` }]} />
              </View>
              <Typography variant="label" color={COLORS.textInkMuted} style={styles.progressText}>
                {entry.progress}{entry.manga.chapters ? `/${entry.manga.chapters}` : ''} ch.
              </Typography>
            </View>
          </View>
          <TouchableOpacity
            style={styles.plusBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateProgress(entry.mangaId, entry.source, entry.progress + 1);
            }}
            accessibilityLabel="Ajouter un chapitre"
          >
            <Typography style={styles.plusLabel}>+1</Typography>
          </TouchableOpacity>
        </View>
      </Panel>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const entries = useLibraryStore(s => s.entries);
  const avatar = useLibraryStore(s => s.avatar);
  const setAvatar = useLibraryStore(s => s.setAvatar);
  const getStats = useLibraryStore(s => s.getStats);
  const stats = getStats();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [pickerOpen, setPickerOpen] = useState(false);

  const featured = entries.find(e => e.manga.bannerImage) ?? entries[0];
  const backdrop = featured?.manga.bannerImage ?? featured?.manga.coverImage;

  const visible = entries
    .filter(e => (filter === 'ALL' ? true : e.status === filter))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const statuses: ReadingStatus[] = ['READING', 'COMPLETED', 'PLAN_TO_READ', 'PAUSED', 'DROPPED'];

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom }}
      >
        {/* Ink hero */}
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" />
          ) : null}
          <LinearGradient
            colors={['rgba(22,19,14,0.3)', 'rgba(22,19,14,0.8)', COLORS.ink]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={styles.heroContent}
          >
            <Pressable
              style={styles.avatar}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPickerOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Changer la photo de profil"
            >
              <View style={styles.avatarClip}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <Typography style={styles.avatarEmoji}>📖</Typography>
                )}
              </View>
              <View style={styles.avatarEditBadge}>
                <Ionicons name="pencil" size={13} color={COLORS.onInk} />
              </View>
            </Pressable>
            <Typography variant="kicker" color={COLORS.accentRed}>LECTEUR MANGA</Typography>
            <Typography variant="hero" color={COLORS.onInk} style={styles.username}>
              Ma Bibliothèque
            </Typography>
          </MotiView>
        </View>

        {/* Stats strip — ink world */}
        <View style={styles.statStrip}>
          <StatPill value={stats.totalEntries} label="ŒUVRES" />
          <View style={styles.statDivider} />
          <StatPill value={stats.chaptersRead} label="CHAPITRES" />
          <View style={styles.statDivider} />
          <StatPill value={stats.averageScore > 0 ? stats.averageScore.toFixed(1) : '—'} label="NOTE MOY." />
        </View>

        <View style={styles.body}>
          {stats.totalEntries > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 200 }}
            >
              <Panel variant="paper" bordered style={styles.section}>
                <View style={styles.sectionInner}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionMarker} />
                    <Typography variant="title" color={COLORS.textInk}>Statistiques</Typography>
                  </View>
                  <View style={styles.statusBars}>
                    {statuses.map(s => (
                      stats.byStatus[s] > 0 && (
                        <StatusBar key={s} status={s} count={stats.byStatus[s]} total={stats.totalEntries} />
                      )
                    ))}
                  </View>
                  {stats.topGenres.length > 0 && (
                    <View style={styles.genresWrap}>
                      {stats.topGenres.slice(0, 6).map(({ genre, count }) => (
                        <View key={genre} style={styles.genreChip}>
                          <Typography variant="label" color={COLORS.accentRed}>{genre}</Typography>
                          <Typography variant="label" color={COLORS.textInkMuted}>{count}</Typography>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </Panel>
            </MotiView>
          )}

          <View style={styles.libraryHeaderRow}>
            <View style={styles.sectionMarker} />
            <Typography variant="title" color={COLORS.textInk}>Ma bibliothèque</Typography>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabs}
            style={styles.filterScroll}
          >
            {FILTERS.map(({ key, label }) => (
              <Pressable
                key={key}
                style={[styles.filterTab, filter === key && styles.filterTabActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFilter(key);
                }}
              >
                <Typography
                  variant="label"
                  color={filter === key ? COLORS.accentRed : COLORS.textInkMuted}
                >
                  {label}
                </Typography>
              </Pressable>
            ))}
          </ScrollView>

          {visible.length === 0 ? (
            <Panel variant="paper" bordered style={styles.emptyCard}>
              <View style={styles.emptyInner}>
                <Typography style={styles.emptyEmoji}>🌸</Typography>
                <Typography variant="heading" color={COLORS.textInk} style={styles.emptyTitle}>
                  {entries.length === 0 ? 'Votre aventure commence ici' : 'Aucune œuvre ici'}
                </Typography>
                <Typography variant="body" color={COLORS.textInkMuted} style={styles.emptyText}>
                  {entries.length === 0
                    ? "Ajoutez des œuvres à votre bibliothèque depuis l'écran Découvrir."
                    : 'Aucune œuvre ne correspond à ce filtre pour le moment.'}
                </Typography>
              </View>
            </Panel>
          ) : (
            <View style={styles.list}>
              {visible.map((entry, index) => (
                <MotiView
                  key={`${entry.source}-${entry.mangaId}`}
                  from={{ opacity: 0, translateY: 12 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: Math.min(index, 8) * 45 }}
                >
                  <HistoryRow entry={entry} />
                </MotiView>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <AvatarPicker
        visible={pickerOpen}
        current={avatar}
        onSelect={setAvatar}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  hero: {
    height: 280,
    backgroundColor: COLORS.ink,
    justifyContent: 'flex-end',
  },
  heroContent: {
    alignItems: 'center',
    gap: SPACING.xs,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.base,
  },
  avatar: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  avatarClip: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.inkSoft,
    borderWidth: BORDERS.heavy,
    borderColor: COLORS.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
  },
  avatarEmoji: { fontSize: 38, lineHeight: 44 },
  username: { fontSize: 28, lineHeight: 30 },

  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.ink,
  },
  statPill: { alignItems: 'center', gap: 4, flex: 1 },
  statValue: { fontSize: 32, lineHeight: 34, letterSpacing: 1 },
  statLabel: { letterSpacing: 1, fontSize: 10 },
  statDivider: { width: BORDERS.hair, height: 32, backgroundColor: COLORS.lineOnInk },

  body: { paddingHorizontal: SPACING.base, paddingTop: SPACING.lg, gap: SPACING.lg },
  section: { borderRadius: RADIUS.lg },
  sectionInner: { padding: SPACING.base, gap: SPACING.md },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionMarker: { width: 4, height: 20, backgroundColor: COLORS.accentRed, borderRadius: 2 },
  statusBars: { gap: SPACING.md },
  statusBarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusBarLabel: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, width: 96 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: COLORS.paperSunken,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  statusBarFill: { borderRadius: 3 },
  statusCount: { width: 24, textAlign: 'right', fontSize: 12 },
  genresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentSoft,
    borderWidth: BORDERS.hair,
    borderColor: `${COLORS.accentRed}44`,
  },
  libraryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: -SPACING.sm,
  },
  filterScroll: { flexGrow: 0, marginHorizontal: -SPACING.base },
  filterTabs: { paddingHorizontal: SPACING.base, gap: SPACING.sm },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.line,
  },
  filterTabActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentRed,
  },
  list: { gap: SPACING.md },
  row: { borderRadius: RADIUS.lg },
  rowInner: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.md, alignItems: 'center' },
  rowCoverFrame: {
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  rowCover: { width: 52, height: 74, backgroundColor: COLORS.paperSunken },
  rowInfo: { flex: 1, gap: SPACING.xs },
  rowTitle: { fontSize: 14, lineHeight: 18 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.paperSunken,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.accentRed, borderRadius: 2 },
  progressText: { fontSize: 11, minWidth: 56 },
  plusBtn: {
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusLabel: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.onInk, letterSpacing: 0.5 },
  emptyCard: { borderRadius: RADIUS.xl },
  emptyInner: { padding: SPACING.xl, alignItems: 'center', gap: SPACING.md },
  emptyEmoji: { fontSize: 48, lineHeight: 56 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center' },
});
