import { MotiView } from 'moti';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS, SPACING, STATUS_LABELS } from '@/constants/theme';
import { useLibraryStore } from '@/lib/store/library';
import type { ReadingStatus } from '@/lib/types';
import { GlassCard } from '@/components/ui/GlassCard';
import { Typography } from '@/components/ui/Typography';

const TAB_BAR_HEIGHT = 88;

const STATUS_COLORS: Record<ReadingStatus, string> = {
  READING: COLORS.statusReading,
  COMPLETED: COLORS.statusCompleted,
  PLAN_TO_READ: COLORS.statusPlan,
  DROPPED: COLORS.statusDropped,
  PAUSED: COLORS.statusPaused,
};

function StatCard({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <GlassCard style={styles.statCard}>
      <View style={styles.statInner}>
        <Typography
          variant="display"
          style={[styles.statValue, accent && { color: COLORS.accent }]}
        >
          {value}
        </Typography>
        <Typography variant="label" style={styles.statLabel}>{label}</Typography>
      </View>
    </GlassCard>
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
        <View
          style={[
            styles.statusBarFill,
            { backgroundColor: color, flex: percent },
          ]}
        />
        {percent < 1 && <View style={{ flex: 1 - percent }} />}
      </View>
      <Typography variant="label" color={COLORS.textMuted} style={styles.statusCount}>{count}</Typography>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const getStats = useLibraryStore(s => s.getStats);
  const stats = getStats();

  const statuses: ReadingStatus[] = ['READING', 'COMPLETED', 'PLAN_TO_READ', 'PAUSED', 'DROPPED'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
      >
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          style={styles.header}
        >
          <View style={styles.avatar}>
            <Typography style={styles.avatarEmoji}>📖</Typography>
          </View>
          <Typography variant="heading" style={styles.username}>Lecteur Manga</Typography>
          <Typography variant="body">Votre bibliothèque personnelle</Typography>
        </MotiView>

        <View style={styles.statsGrid}>
          {[
            { label: 'Total', value: stats.totalEntries, accent: true },
            { label: 'Chapitres lus', value: stats.chaptersRead },
            { label: 'Score moyen', value: stats.averageScore > 0 ? stats.averageScore.toFixed(1) : '—' },
            { label: 'Terminés', value: stats.byStatus.COMPLETED },
          ].map(({ label, value, accent }, i) => (
            <MotiView
              key={label}
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22, delay: i * 80 }}
              style={styles.statWrap}
            >
              <StatCard label={label} value={value} accent={accent} />
            </MotiView>
          ))}
        </View>

        {stats.totalEntries > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 350 }}
          >
            <GlassCard style={styles.section}>
              <View style={styles.sectionInner}>
                <Typography variant="heading" style={styles.sectionTitle}>📊 Répartition</Typography>
                <View style={styles.statusBars}>
                  {statuses.map(s => (
                    stats.byStatus[s] > 0 && (
                      <StatusBar
                        key={s}
                        status={s}
                        count={stats.byStatus[s]}
                        total={stats.totalEntries}
                      />
                    )
                  ))}
                </View>
              </View>
            </GlassCard>
          </MotiView>
        )}

        {stats.topGenres.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 450 }}
          >
            <GlassCard style={styles.section}>
              <View style={styles.sectionInner}>
                <Typography variant="heading" style={styles.sectionTitle}>🎭 Top Genres</Typography>
                <View style={styles.genresWrap}>
                  {stats.topGenres.map(({ genre, count }, i) => (
                    <View key={genre} style={styles.genreRow}>
                      <View style={[styles.genreRank, { backgroundColor: i < 3 ? COLORS.accentMuted : COLORS.surfaceRaised }]}>
                        <Typography variant="label" color={i < 3 ? COLORS.accentLight : COLORS.textMuted}>
                          #{i + 1}
                        </Typography>
                      </View>
                      <Typography variant="bodyBold" style={styles.genreName}>{genre}</Typography>
                      <Typography variant="label" color={COLORS.textMuted}>{count}</Typography>
                    </View>
                  ))}
                </View>
              </View>
            </GlassCard>
          </MotiView>
        )}

        {stats.totalEntries === 0 && (
          <GlassCard style={styles.emptyCard}>
            <View style={styles.emptyInner}>
              <Typography style={styles.emptyEmoji}>🌸</Typography>
              <Typography variant="heading" style={styles.emptyTitle}>Votre aventure commence ici</Typography>
              <Typography variant="body" style={styles.emptyText}>
                Ajoutez des mangas à votre bibliothèque depuis l&apos;écran Découvrir.
              </Typography>
            </View>
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: SPACING.base, gap: SPACING.lg, paddingTop: SPACING.md },
  header: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 36, lineHeight: 42 },
  username: { fontSize: 22 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statWrap: { width: '47%', flexGrow: 1 },
  statCard: { borderRadius: RADIUS.lg },
  statInner: { padding: SPACING.base, alignItems: 'center', gap: SPACING.xs },
  statValue: { fontSize: 34, lineHeight: 36, color: COLORS.text },
  statLabel: { textAlign: 'center', letterSpacing: 0.5 },
  section: { borderRadius: RADIUS.lg },
  sectionInner: { padding: SPACING.base, gap: SPACING.md },
  sectionTitle: { fontSize: 16 },
  statusBars: { gap: SPACING.md },
  statusBarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    width: 96,
  },
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
  genresWrap: { gap: SPACING.sm },
  genreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  genreRank: {
    width: 36,
    height: 24,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genreName: { flex: 1, color: COLORS.text, fontSize: 13 },
  emptyCard: { borderRadius: RADIUS.xl },
  emptyInner: {
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptyEmoji: { fontSize: 48, lineHeight: 56 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center' },
});
