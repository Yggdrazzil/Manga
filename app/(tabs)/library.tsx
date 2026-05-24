import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS, SPACING, STATUS_LABELS } from '@/constants/theme';
import type { LibraryEntry, ReadingStatus } from '@/lib/types';
import { useLibraryStore } from '@/lib/store/library';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Typography } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassButton } from '@/components/ui/GlassButton';

const TAB_BAR_HEIGHT = 88;

const STATUSES: ReadingStatus[] = ['READING', 'PLAN_TO_READ', 'COMPLETED', 'PAUSED', 'DROPPED'];

function ProgressBar({ progress, total }: { progress: number; total?: number }) {
  const percent = total ? Math.min(progress / total, 1) : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${percent * 100}%` as `${number}%` }]} />
    </View>
  );
}

function LibraryItem({ entry, onRemove }: { entry: LibraryEntry; onRemove: () => void }) {
  const router = useRouter();
  const updateStatus = useLibraryStore(s => s.updateStatus);
  const updateProgress = useLibraryStore(s => s.updateProgress);

  const title = entry.manga.title.english ?? entry.manga.title.romaji ?? entry.manga.title.userPreferred;

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      title,
      'Choisissez une action',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: '+1 Chapitre',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            updateProgress(entry.mangaId, entry.source, entry.progress + 1);
          },
        },
        {
          text: 'Retirer de la bibliothèque',
          style: 'destructive',
          onPress: onRemove,
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={() => router.push(`/manga/${entry.mangaId}?source=${entry.source}`)}
      onLongPress={handleLongPress}
    >
      <GlassCard style={styles.entryCard}>
        <View style={styles.entryInner}>
          <Image
            source={{ uri: entry.manga.coverImage }}
            style={styles.entryCover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.entryInfo}>
            <Typography variant="bodyBold" numberOfLines={2} style={styles.entryTitle}>
              {title}
            </Typography>
            <View style={styles.entryMeta}>
              <StatusBadge status={entry.status} compact />
              {entry.score && (
                <Typography variant="label" color={COLORS.warning}>
                  ★ {entry.score}/10
                </Typography>
              )}
            </View>
            <View style={styles.progressRow}>
              <ProgressBar progress={entry.progress} total={entry.manga.chapters} />
              <Typography variant="label" color={COLORS.textMuted} style={styles.progressText}>
                {entry.progress}
                {entry.manga.chapters ? `/${entry.manga.chapters}` : ''} ch.
              </Typography>
            </View>
            <View style={styles.entryActions}>
              <TouchableOpacity
                style={styles.plusBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateProgress(entry.mangaId, entry.source, entry.progress + 1);
                }}
              >
                <Typography style={styles.plusLabel}>+1</Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [activeStatus, setActiveStatus] = useState<ReadingStatus>('READING');
  const entriesByStatus = useLibraryStore(s => s.entriesByStatus);
  const removeEntry = useLibraryStore(s => s.removeEntry);

  const entries = entriesByStatus(activeStatus);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Typography variant="display" style={styles.title}>Bibliothèque</Typography>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusTabs}
        style={styles.statusTabsScroll}
      >
        {STATUSES.map(status => (
          <Pressable
            key={status}
            style={[styles.statusTab, activeStatus === status && styles.statusTabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveStatus(status);
            }}
          >
            <Typography
              variant="bodyBold"
              style={[styles.statusTabLabel, activeStatus === status && styles.statusTabLabelActive]}
            >
              {STATUS_LABELS[status]}
            </Typography>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom },
        ]}
      >
        {entries.length === 0 ? (
          <EmptyState
            icon="📚"
            title="Aucune entrée"
            subtitle={`Vous n'avez pas encore de manga avec le statut "${STATUS_LABELS[activeStatus]}".`}
          />
        ) : (
          entries.map((entry, index) => (
            <MotiView
              key={`${entry.source}-${entry.mangaId}`}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 50 }}
            >
              <LibraryItem
                entry={entry}
                onRemove={() => {
                  Alert.alert('Supprimer', 'Retirer ce manga de votre bibliothèque ?', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer',
                      style: 'destructive',
                      onPress: () => removeEntry(entry.mangaId, entry.source),
                    },
                  ]);
                }}
              />
            </MotiView>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: { color: COLORS.text, fontSize: 32 },
  statusTabsScroll: { flexGrow: 0, marginBottom: SPACING.md },
  statusTabs: { paddingHorizontal: SPACING.base, gap: SPACING.sm },
  statusTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusTabActive: {
    backgroundColor: COLORS.accentMuted,
    borderColor: `${COLORS.accent}66`,
  },
  statusTabLabel: { color: COLORS.textMuted, fontSize: 13 },
  statusTabLabelActive: { color: COLORS.accentLight },
  list: { paddingHorizontal: SPACING.base, gap: SPACING.md, paddingTop: SPACING.xs },
  entryCard: { borderRadius: RADIUS.lg },
  entryInner: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.md },
  entryCover: {
    width: 64,
    height: 90,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceRaised,
  },
  entryInfo: { flex: 1, gap: SPACING.xs },
  entryTitle: { fontSize: 14, lineHeight: 19, color: COLORS.text },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  progressText: { fontSize: 11, minWidth: 50 },
  entryActions: { flexDirection: 'row', marginTop: 4 },
  plusBtn: {
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: `${COLORS.accent}44`,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  plusLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.accentLight,
  },
});
