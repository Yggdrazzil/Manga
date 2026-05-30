import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getComicById } from '@/lib/api/googlebooks';
import { useComicsStore } from '@/lib/store/comics';
import { confirmAction } from '@/lib/utils/confirm';
import { Panel } from '@/components/ui/Panel';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, STATUS_LABELS } from '@/constants/theme';
import type { ReadingStatus } from '@/lib/types';

const STATUSES: ReadingStatus[] = ['READING', 'PLAN_TO_READ', 'COMPLETED', 'PAUSED', 'DROPPED'];

function DescriptionText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const maxChars = 240;
  const shouldTruncate = text.length > maxChars;
  const displayed = shouldTruncate && !expanded ? `${text.slice(0, maxChars)}…` : text;

  return (
    <View>
      <Typography variant="body" color={COLORS.textInkMuted} style={styles.description}>
        {displayed}
      </Typography>
      {shouldTruncate && (
        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={8} style={styles.expandBtn}>
          <Typography variant="label" color={COLORS.accentRed}>
            {expanded ? 'Voir moins ↑' : 'Voir plus ↓'}
          </Typography>
        </Pressable>
      )}
    </View>
  );
}

export default function ComicDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const entry = useComicsStore(s => s.entries.find(e => e.comicId === id));
  const addEntry = useComicsStore(s => s.addEntry);
  const removeEntry = useComicsStore(s => s.removeEntry);
  const updateStatus = useComicsStore(s => s.updateStatus);
  const toggleVolumeRead = useComicsStore(s => s.toggleVolumeRead);
  const setTotalVolumes = useComicsStore(s => s.setTotalVolumes);

  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState('');

  const { data: comic, isLoading } = useQuery({
    queryKey: ['comic', id],
    queryFn: () => getComicById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 60,
  });

  const effectiveComic = comic;
  const totalVolumes = entry?.totalVolumes ?? 0;
  const readCount = entry?.readVolumes.length ?? 0;

  const handleStatus = (status: ReadingStatus) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (entry) {
      updateStatus(id!, status);
    } else if (effectiveComic) {
      addEntry({
        id: effectiveComic.id,
        title: effectiveComic.title,
        authors: effectiveComic.authors,
        coverImage: effectiveComic.coverImage,
        description: effectiveComic.description,
        publisher: effectiveComic.publisher,
        publishedDate: effectiveComic.publishedDate,
        categories: effectiveComic.categories,
        type: 'COMIC',
      }, status);
    }
  };

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    confirmAction({
      title: 'Retirer',
      message: 'Retirer de votre bibliothèque BD ?',
      confirmLabel: 'Retirer',
      destructive: true,
      onConfirm: () => {
        removeEntry(id!);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        router.back();
      },
    });
  };

  const handleSaveTotal = () => {
    const n = parseInt(totalInput, 10);
    if (!isNaN(n) && n > 0) {
      setTotalVolumes(id!, n);
    }
    setEditingTotal(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
          </View>
        </Pressable>
        <ActivityIndicator color={COLORS.accentRed} size="large" style={{ flex: 1 }} />
      </View>
    );
  }

  if (!effectiveComic) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
          </View>
        </Pressable>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.textInkMuted} />
          <Typography variant="heading" color={COLORS.textInk}>Impossible de charger</Typography>
        </View>
      </View>
    );
  }

  const displayTitle = effectiveComic.title;
  const progressPct = totalVolumes > 0 ? Math.min(readCount / totalVolumes, 1) : 0;

  return (
    <View style={styles.container}>
      <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <View style={styles.backBtnInner}>
          <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
        </View>
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          {effectiveComic.coverImage ? (
            <Image
              source={{ uri: effectiveComic.coverImage }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : null}
          <LinearGradient
            colors={['rgba(22,19,14,0.15)', 'rgba(22,19,14,0.7)', COLORS.ink]}
            locations={[0.2, 0.6, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.heroBottom, { paddingTop: insets.top + 56 }]}>
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 100 }}
            >
              <View style={styles.heroMeta}>
                <View style={styles.typeBadge}>
                  <Typography variant="kicker" color={COLORS.onInk} style={styles.typeBadgeText}>
                    COMIC
                  </Typography>
                </View>
                {effectiveComic.publishedDate && (
                  <Typography variant="kicker" color={COLORS.onInkMuted}>
                    {effectiveComic.publishedDate.slice(0, 4)}
                  </Typography>
                )}
              </View>
              <Typography variant="hero" color={COLORS.onInk} style={styles.heroTitle} numberOfLines={3}>
                {displayTitle}
              </Typography>
              {effectiveComic.authors.length > 0 && (
                <Typography variant="label" color={COLORS.onInkMuted} numberOfLines={1}>
                  {effectiveComic.authors.join(', ')}
                </Typography>
              )}
            </MotiView>
          </View>
        </View>

        <View style={styles.content}>
          {/* Info grid */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 140 }}
          >
            <Panel variant="paper" bordered style={styles.infoCard}>
              <View style={styles.infoGrid}>
                <InfoItem label="Auteur(s)" value={effectiveComic.authors.join(', ') || '—'} />
                <InfoItem label="Éditeur" value={effectiveComic.publisher || '—'} />
                {effectiveComic.publishedDate && (
                  <InfoItem label="Parution" value={effectiveComic.publishedDate.slice(0, 4)} />
                )}
                {effectiveComic.averageRating != null && (
                  <InfoItem label="Note" value={`${effectiveComic.averageRating.toFixed(1)}/5`} highlight />
                )}
              </View>
            </Panel>
          </MotiView>

          {/* Categories */}
          {effectiveComic.categories.length > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 200 }}
            >
              <View style={styles.genresWrap}>
                {effectiveComic.categories.map(g => (
                  <View key={g} style={styles.genreChip}>
                    <Typography variant="label" color={COLORS.accentRed}>{g}</Typography>
                  </View>
                ))}
              </View>
            </MotiView>
          )}

          {/* Description */}
          {effectiveComic.description && (
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 260 }}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.sectionMarker} />
                <Typography variant="title" color={COLORS.textInk}>Synopsis</Typography>
              </View>
              <DescriptionText text={effectiveComic.description} />
            </MotiView>
          )}

          {/* Tracking panel */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 320 }}
          >
            <Panel variant="paper" bordered hardShadow style={styles.trackingCard}>
              <View style={styles.trackingInner}>
                <View style={styles.trackingTitleRow}>
                  <View style={styles.sectionMarker} />
                  <Typography variant="heading" color={COLORS.textInk}>
                    {entry ? 'Votre suivi' : 'Ajouter à la bibliothèque'}
                  </Typography>
                </View>

                <View style={styles.statusPicker}>
                  {STATUSES.map(status => (
                    <Pressable
                      key={status}
                      style={[styles.statusBtn, entry?.status === status && styles.statusBtnActive]}
                      onPress={() => handleStatus(status)}
                    >
                      <Typography
                        variant="label"
                        style={[styles.statusBtnLabel, entry?.status === status && styles.statusBtnLabelActive]}
                      >
                        {STATUS_LABELS[status]}
                      </Typography>
                    </Pressable>
                  ))}
                </View>

                {entry && (
                  <>
                    {/* Volume progress */}
                    <View style={styles.volumeSection}>
                      <View style={styles.volumeHeader}>
                        <View style={styles.progressHeader}>
                          <Typography variant="subheading" color={COLORS.textInk}>Tomes lus</Typography>
                          <Typography variant="label" color={COLORS.textInkMuted}>
                            {readCount}{totalVolumes > 0 ? ` / ${totalVolumes}` : ''} tomes
                          </Typography>
                        </View>
                        <Pressable
                          onPress={() => {
                            setTotalInput(String(totalVolumes || ''));
                            setEditingTotal(true);
                          }}
                          hitSlop={8}
                          style={styles.editTotalBtn}
                        >
                          <Ionicons name="create-outline" size={16} color={COLORS.accentRed} />
                          <Typography variant="caption" color={COLORS.accentRed} style={styles.editTotalLabel}>
                            Nbre de tomes
                          </Typography>
                        </Pressable>
                      </View>

                      {editingTotal && (
                        <View style={styles.totalInputRow}>
                          <TextInput
                            style={styles.totalInput}
                            value={totalInput}
                            onChangeText={setTotalInput}
                            keyboardType="number-pad"
                            placeholder="Ex: 12"
                            placeholderTextColor={COLORS.textInkMuted}
                            autoFocus
                            returnKeyType="done"
                            onSubmitEditing={handleSaveTotal}
                          />
                          <Pressable style={styles.saveTotalBtn} onPress={handleSaveTotal}>
                            <Typography variant="kicker" color={COLORS.onInk} style={styles.saveTotalText}>OK</Typography>
                          </Pressable>
                        </View>
                      )}

                      {totalVolumes > 0 && (
                        <>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${progressPct * 100}%` as `${number}%` }]} />
                          </View>
                          <View style={styles.volumeGrid}>
                            {Array.from({ length: totalVolumes }, (_, i) => i + 1).map(n => {
                              const read = entry.readVolumes.includes(n);
                              return (
                                <Pressable
                                  key={n}
                                  style={[styles.volumeChip, read && styles.volumeChipRead]}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    toggleVolumeRead(id!, n);
                                  }}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked: read }}
                                  accessibilityLabel={`Tome ${n}`}
                                >
                                  <Typography
                                    style={[styles.volumeChipText, read && styles.volumeChipTextRead]}
                                  >
                                    {n}
                                  </Typography>
                                </Pressable>
                              );
                            })}
                          </View>
                        </>
                      )}
                    </View>

                    <Pressable onPress={handleRemove} style={styles.removeBtn} hitSlop={8}>
                      <Typography variant="label" color={COLORS.error}>
                        Retirer de la bibliothèque
                      </Typography>
                    </Pressable>
                  </>
                )}
              </View>
            </Panel>
          </MotiView>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoItem}>
      <Typography variant="caption" color={COLORS.textInkMuted}>{label}</Typography>
      <Typography variant="subheading" color={highlight ? COLORS.warning : COLORS.textInk} style={styles.infoValue}>
        {value}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  backBtn: { position: 'absolute', left: SPACING.base, zIndex: 100 },
  backBtnInner: {
    width: 44, height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.ink,
    borderWidth: BORDERS.bold, borderColor: COLORS.lineOnInk,
    alignItems: 'center', justifyContent: 'center',
  },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.xl },
  hero: { height: 340, backgroundColor: COLORS.ink, justifyContent: 'flex-end' },
  heroBottom: { padding: SPACING.base, gap: SPACING.sm },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  typeBadge: {
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: BORDERS.bold, borderColor: COLORS.accentDeep,
  },
  typeBadgeText: { fontSize: 9, letterSpacing: 1.5 },
  heroTitle: { fontSize: 34, lineHeight: 36 },
  content: { padding: SPACING.base, gap: SPACING.lg, backgroundColor: COLORS.paper },
  infoCard: { borderRadius: RADIUS.lg },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: SPACING.base, gap: SPACING.base },
  infoItem: { width: '45%', gap: 4, flexGrow: 1 },
  infoValue: { fontSize: 15 },
  genresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  genreChip: {
    backgroundColor: COLORS.accentSoft, borderWidth: BORDERS.hair,
    borderColor: `${COLORS.accentRed}44`,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.full,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  sectionMarker: { width: 4, height: 20, backgroundColor: COLORS.accentRed, borderRadius: 2 },
  description: { lineHeight: 24 },
  expandBtn: { marginTop: SPACING.sm, alignSelf: 'flex-start' },
  trackingCard: { borderRadius: RADIUS.lg, overflow: 'visible' },
  trackingInner: { padding: SPACING.base, gap: SPACING.lg },
  trackingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statusBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.hair, borderColor: COLORS.line,
  },
  statusBtnActive: { backgroundColor: COLORS.accentSoft, borderColor: `${COLORS.accentRed}66` },
  statusBtnLabel: { color: COLORS.textInkMuted, fontSize: 12 },
  statusBtnLabelActive: { color: COLORS.accentRed },
  volumeSection: { gap: SPACING.sm },
  volumeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressHeader: { gap: 2 },
  editTotalBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  editTotalLabel: { letterSpacing: 0.5, fontSize: 11 },
  totalInputRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  totalInput: {
    flex: 1, height: 44,
    backgroundColor: COLORS.paperSunken,
    borderRadius: RADIUS.md, borderWidth: BORDERS.bold, borderColor: COLORS.ink,
    paddingHorizontal: SPACING.md,
    fontFamily: FONTS.body, fontSize: 16, color: COLORS.textInk,
  },
  saveTotalBtn: {
    height: 44, paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.md, borderWidth: BORDERS.bold, borderColor: COLORS.accentDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  saveTotalText: { letterSpacing: 1.2 },
  progressTrack: {
    height: 6, backgroundColor: COLORS.paperSunken,
    borderRadius: RADIUS.full, overflow: 'hidden',
    borderWidth: BORDERS.hair, borderColor: COLORS.line,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.accentRed, borderRadius: RADIUS.full },
  volumeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  volumeChip: {
    width: 40, height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold, borderColor: COLORS.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  volumeChipRead: { backgroundColor: COLORS.accentRed, borderColor: COLORS.accentDeep },
  volumeChipText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.textInkMuted },
  volumeChipTextRead: { color: COLORS.onInk },
  removeBtn: { alignSelf: 'center', paddingVertical: SPACING.sm },
});
