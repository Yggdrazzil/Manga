import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS, SPACING, STATUS_LABELS } from '@/constants/theme';
import { useLibraryStore } from '@/lib/store/library';
import type { LibraryEntry, ReadingStatus } from '@/lib/types';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Typography } from '@/components/ui/Typography';

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
      <Typography variant="heading" style={styles.statValue}>{value}</Typography>
      <Typography variant="label" color={COLORS.textMuted} style={styles.statLabel}>{label}</Typography>
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
        <Typography variant="bodyBold" style={styles.statusBarText}>{STATUS_LABELS[status]}</Typography>
      </View>
      <View style={styles.statusBarTrack}>
        <View style={[styles.statusBarFill, { backgroundColor: color, flex: percent }]} />
        {percent < 1 && <View style={{ flex: 1 - percent }} />}
      </View>
      <Typography variant="label" color={COLORS.textMuted} style={styles.statusCount}>{count}</Typography>
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
    Alert.alert(title, 'Retirer cette œuvre de votre historique ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => removeEntry(entry.mangaId, entry.source) },
    ]);
  };

  return (
    <Pressable
      onPress={() => router.push(`/manga/${entry.mangaId}?source=${entry.source}`)}
      onLongPress={confirmRemove}
    >
      <GlassCard style={styles.row}>
        <View style={styles.rowInner}>
          <Image
            source={{ uri: entry.manga.coverImage }}
            style={styles.rowCover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.rowInfo}>
            <Typography variant="bodyBold" numberOfLines={2} style={styles.rowTitle}>{title}</Typography>
            <View style={styles.rowMeta}>
              <StatusBadge status={entry.status} compact />
              <Typography variant="label" color={COLORS.textMuted}>{relative}</Typography>
              {entry.score ? (
                <Typography variant="label" color={COLORS.warning}>★ {entry.score}</Typography>
              ) : null}
            </View>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percent * 100}%` as `${number}%` }]} />
              </View>
              <Typography variant="label" color={COLORS.textMuted} style={styles.progressText}>
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
      </GlassCard>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const entries = useLibraryStore(s => s.entries);
  const getStats = useLibraryStore(s => s.getStats);
  const stats = getStats();
  const [filter, setFilter] = useState<Filter>('ALL');

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
        <View style={styles.hero}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" />
          ) : null}
          <LinearGradient
            colors={['rgba(10,11,20,0.35)', 'rgba(10,11,20,0.75)', COLORS.bg]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={[styles.heroContent, { paddingTop: insets.top + SPACING.lg }]}
          >
            <View style={styles.avatar}>
              <Typography style={styles.avatarEmoji}>📖</Typography>
            </View>
            <Typography variant="heading" style={styles.username}>Lecteur Manga</Typography>
            <Typography variant="body">Votre bibliothèque personnelle</Typography>
          </MotiView>
        </View>

        <View style={styles.statStrip}>
          <StatPill value={stats.totalEntries} label="Œuvres" />
          <View style={styles.statDivider} />
          <StatPill value={stats.chaptersRead} label="Chapitres" />
          <View style={styles.statDivider} />
          <StatPill value={stats.averageScore > 0 ? stats.averageScore.toFixed(1) : '—'} label="Note moy." />
        </View>

        <View style={styles.body}>
          {stats.totalEntries > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 200 }}
            >
              <GlassCard style={styles.section}>
                <View style={styles.sectionInner}>
                  <Typography variant="heading" style={styles.sectionTitle}>Statistiques</Typography>
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
                          <Typography variant="label" color={COLORS.accentLight}>{genre}</Typography>
                          <Typography variant="label" color={COLORS.textMuted}>{count}</Typography>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </GlassCard>
            </MotiView>
          )}

          <View style={styles.libraryHeader}>
            <Typography variant="heading" style={styles.sectionTitle}>Ma bibliothèque</Typography>
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
                  variant="bodyBold"
                  style={[styles.filterLabel, filter === key && styles.filterLabelActive]}
                >
                  {label}
                </Typography>
              </Pressable>
            ))}
          </ScrollView>

          {visible.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <View style={styles.emptyInner}>
                <Typography style={styles.emptyEmoji}>🌸</Typography>
                <Typography variant="heading" style={styles.emptyTitle}>
                  {entries.length === 0 ? 'Votre aventure commence ici' : 'Aucune œuvre ici'}
                </Typography>
                <Typography variant="body" style={styles.emptyText}>
                  {entries.length === 0
                    ? "Ajoutez des œuvres à votre bibliothèque depuis l'écran Découvrir."
                    : 'Aucune œuvre ne correspond à ce filtre pour le moment.'}
                </Typography>
              </View>
            </GlassCard>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  hero: {
    height: 260,
    backgroundColor: COLORS.surfaceRaised,
    justifyContent: 'flex-end',
  },
  heroContent: { alignItems: 'center', gap: SPACING.xs, paddingBottom: SPACING.base },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  avatarEmoji: { fontSize: 38, lineHeight: 44 },
  username: { fontSize: 24 },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.base,
    marginHorizontal: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statPill: { alignItems: 'center', gap: 2, flex: 1 },
  statValue: { fontSize: 22, color: COLORS.text },
  statLabel: { textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.border },
  body: { paddingHorizontal: SPACING.base, paddingTop: SPACING.lg, gap: SPACING.lg },
  section: { borderRadius: RADIUS.lg },
  sectionInner: { padding: SPACING.base, gap: SPACING.md },
  sectionTitle: { fontSize: 18 },
  statusBars: { gap: SPACING.md },
  statusBarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusBarLabel: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, width: 96 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBarText: { fontSize: 12, color: COLORS.text },
  statusBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
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
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: `${COLORS.accent}33`,
  },
  libraryHeader: { marginBottom: -SPACING.sm },
  filterScroll: { flexGrow: 0, marginHorizontal: -SPACING.base },
  filterTabs: { paddingHorizontal: SPACING.base, gap: SPACING.sm },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTabActive: { backgroundColor: COLORS.accentMuted, borderColor: `${COLORS.accent}66` },
  filterLabel: { color: COLORS.textMuted, fontSize: 13 },
  filterLabelActive: { color: COLORS.accentLight },
  list: { gap: SPACING.md },
  row: { borderRadius: RADIUS.lg },
  rowInner: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.md, alignItems: 'center' },
  rowCover: { width: 56, height: 80, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceRaised },
  rowInfo: { flex: 1, gap: SPACING.xs },
  rowTitle: { fontSize: 14, lineHeight: 19, color: COLORS.text },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  progressTrack: { flex: 1, height: 4, backgroundColor: COLORS.surfaceRaised, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },
  progressText: { fontSize: 11, minWidth: 56 },
  plusBtn: {
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: `${COLORS.accent}44`,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  plusLabel: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.accentLight },
  emptyCard: { borderRadius: RADIUS.xl },
  emptyInner: { padding: SPACING.xl, alignItems: 'center', gap: SPACING.md },
  emptyEmoji: { fontSize: 48, lineHeight: 56 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center', color: COLORS.textMuted },
});
