import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useCallback, useEffect, useState } from 'react';
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
import { consolidateBDSeries } from '@/lib/api/bdconsolidate';
import { getVolumeDescription } from '@/lib/api/googlebooks';
import { getWikipediaSummaryByTitle } from '@/lib/api/wikipedia';
import { useComicsStore } from '@/lib/store/comics';
import { confirmAction } from '@/lib/utils/confirm';
import { Panel } from '@/components/ui/Panel';
import { StarRating } from '@/components/ui/StarRating';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, STATUS_LABELS, inkScrim, themedStyles } from '@/constants/theme';
import type { BDSeries, BDVolume, ReadingStatus } from '@/lib/types';

const STATUSES: ReadingStatus[] = ['READING', 'PLAN_TO_READ', 'COMPLETED', 'PAUSED', 'DROPPED'];

// ── Volume card — data pre-loaded at add-time, synopsis lazy via Wikipedia FR ──
// Tap the card to expand the synopsis; tap the checkbox to mark read.

function VolumeCard({
  volume,
  seriesTitle,
  isRead,
  onToggle,
  onEnrich,
}: {
  volume: BDVolume;
  seriesTitle: string;
  isRead: boolean;
  onToggle: () => void;
  onEnrich?: (description: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fetchingDesc, setFetchingDesc] = useState(false);
  const [localDesc, setLocalDesc] = useState<string | undefined>();
  const { subtitle, publisher } = volume;
  const description = volume.description ?? localDesc;

  // Lazy per-volume synopsis, fetched the first time the card is expanded:
  // dedicated FR Wikipedia article when Wikidata knows it, else Google Books
  // (4e de couverture) looked up by episode title.
  useEffect(() => {
    if (!expanded || description || fetchingDesc) return;
    if (!volume.frwikiTitle && !subtitle) return;
    setFetchingDesc(true);
    const lookup = async (): Promise<string | undefined> => {
      if (volume.frwikiTitle) {
        const extract = await getWikipediaSummaryByTitle(volume.frwikiTitle);
        if (extract) return extract;
      }
      if (subtitle) return getVolumeDescription(seriesTitle, subtitle);
      return undefined;
    };
    lookup()
      .then(extract => {
        if (!extract) return;
        setLocalDesc(extract);
        onEnrich?.(extract);
      })
      .finally(() => setFetchingDesc(false));
    // frwikiTitle / subtitle included so the effect re-fires when a background
    // refreshSeries populates these after the card was already expanded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, volume.frwikiTitle, subtitle]);

  return (
    <View style={[styles.volumeCard, isRead && styles.volumeCardRead]}>
      <Pressable
        style={({ pressed }) => [styles.volumeMain, pressed && styles.volumeMainPressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpanded(e => !e);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Tome ${volume.num}${subtitle ? ` — ${subtitle}` : ''}, ${expanded ? 'masquer' : 'voir'} le résumé`}
      >
        {volume.coverImage ? (
          <View style={styles.volumeCoverWrap}>
            <Image
              source={{ uri: volume.coverImage }}
              style={styles.volumeCover}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
        ) : (
          <View style={[styles.volumeChip, isRead && styles.volumeChipRead]}>
            <Typography style={[styles.volumeChipText, isRead && styles.volumeChipTextRead]}>
              {volume.num}
            </Typography>
          </View>
        )}

        <View style={styles.volumeInfo}>
          <Typography variant="caption" color={isRead ? COLORS.accentRed : COLORS.textInkFaint} style={styles.volumeKicker}>
            TOME {volume.num}{isRead ? ' · LU' : ''}
          </Typography>
          {subtitle ? (
            <Typography variant="subheading" color={COLORS.textInk} style={styles.volumeSubtitle} numberOfLines={expanded ? undefined : 2}>
              {subtitle}
            </Typography>
          ) : null}
          {publisher && (
            <Typography variant="caption" color={COLORS.textInkFaint}>{publisher.toUpperCase()}</Typography>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.volumeCheck, pressed && { opacity: 0.6 }]}
          onPress={e => {
            e.stopPropagation();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onToggle();
          }}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isRead }}
          accessibilityLabel={`Tome ${volume.num} — ${isRead ? 'lu' : 'non lu'}`}
        >
          <Ionicons
            name={isRead ? 'checkmark-circle' : 'ellipse-outline'}
            size={28}
            color={isRead ? COLORS.accentRed : COLORS.textInkFaint}
          />
        </Pressable>
      </Pressable>

      {expanded && (
        <View style={styles.volumeDetail}>
          {description ? (
            <Typography variant="body" color={COLORS.textInkMuted} style={styles.volumeDesc}>
              {description}
            </Typography>
          ) : fetchingDesc ? (
            <ActivityIndicator size="small" color={COLORS.cyan} />
          ) : (
            <Typography variant="caption" color={COLORS.textInkFaint} style={styles.volumeDesc}>
              Résumé non disponible pour ce tome.
            </Typography>
          )}
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SeriesDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, title: titleParam } = useLocalSearchParams<{ id: string; title?: string }>();

  const entry = useComicsStore(s => s.getEntry(id ?? ''));
  const addOrUpdateSeries = useComicsStore(s => s.addOrUpdateSeries);
  const removeEntry = useComicsStore(s => s.removeEntry);
  const toggleVolumeRead = useComicsStore(s => s.toggleVolumeRead);
  const updateStatus = useComicsStore(s => s.updateStatus);
  const updateScore = useComicsStore(s => s.updateScore);
  const updateNotes = useComicsStore(s => s.updateNotes);
  const updateVolumeDetail = useComicsStore(s => s.updateVolumeDetail);
  const toggleFavorite = useComicsStore(s => s.toggleFavorite);
  const [notes, setNotes] = useState(entry?.notes ?? '');
  useEffect(() => { setNotes(entry?.notes ?? ''); }, [entry?.notes]);

  // If the series isn't in the store yet, run the full consolidation pipeline.
  // expo-router already decodes params — no manual decodeURIComponent (it
  // crashes on titles containing a literal "%").
  const seriesTitle = entry?.series.title ?? titleParam ?? '';
  const { data: fetchedSeries, isLoading: loadingSeries, isError: previewError, refetch: retryPreview } = useQuery({
    queryKey: ['series-preview', id, seriesTitle],
    queryFn: async () => {
      const result = await consolidateBDSeries(seriesTitle);
      if (!result) throw new Error('Aucune donnée trouvée pour cette série');
      return result;
    },
    enabled: !entry && !!seriesTitle,
    staleTime: 1000 * 60 * 10,
  });

  const series: BDSeries | undefined = entry?.series ?? fetchedSeries ?? undefined;
  const isLoading = !entry && loadingSeries;

  const handleToggle = useCallback((volNum: number) => {
    if (!series) return;
    if (entry) {
      toggleVolumeRead(id!, volNum);
    } else {
      // First interaction adds the series and marks this volume
      addOrUpdateSeries(series, volNum);
    }
  }, [entry, series, id, toggleVolumeRead, addOrUpdateSeries]);

  const handleStatus = useCallback((status: ReadingStatus) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (entry) {
      updateStatus(id!, status);
    } else if (series) {
      // Track the series without marking any volume read
      addOrUpdateSeries(series);
      updateStatus(series.id, status);
    }
  }, [entry, series, id, updateStatus, addOrUpdateSeries]);

  // Stored series data is frozen at add-time; sources (Wikidata, Wikipedia)
  // keep improving. Re-consolidate silently on open and merge — no manual
  // refresh needed, the stored data stays usable until fresh data lands.
  const refreshSeries = useComicsStore(s => s.refreshSeries);
  const { data: freshSeries } = useQuery({
    queryKey: ['series-refresh', entry?.seriesId],
    queryFn: () => consolidateBDSeries(entry!.series.title),
    enabled: !!entry,
    staleTime: 1000 * 60 * 30,
  });
  useEffect(() => {
    if (freshSeries) refreshSeries(freshSeries);
  }, [freshSeries, refreshSeries]);

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    confirmAction({
      title: series?.title ?? 'Retirer',
      message: 'Retirer cette série de votre bibliothèque BD ?',
      confirmLabel: 'Retirer',
      destructive: true,
      onConfirm: () => {
        removeEntry(id!);
        router.back();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      },
    });
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

  if (!series) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
          </View>
        </Pressable>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.textInkMuted} />
          <Typography variant="heading" color={COLORS.textInk}>
            {previewError ? 'Impossible de charger cette série' : 'Série introuvable'}
          </Typography>
          {previewError && (
            <Pressable
              style={styles.retryBtn}
              onPress={() => retryPreview()}
              accessibilityRole="button"
              accessibilityLabel="Réessayer"
            >
              <Typography variant="label" color={COLORS.accentRed}>Réessayer</Typography>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const readCount = entry?.readVolumes.length ?? 0;
  const totalVolumes = series.totalVolumes;
  const progressPct = totalVolumes > 0 ? Math.min(readCount / totalVolumes, 1) : 0;
  const statusLabels: Record<ReadingStatus, string> = STATUS_LABELS;

  return (
    <View style={styles.container}>
      <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <View style={styles.backBtnInner}>
          <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
        </View>
      </Pressable>

      {entry && (
        <Pressable
          style={[styles.favBtn, { top: insets.top + 8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleFavorite(entry.seriesId);
          }}
          accessibilityRole="button"
          accessibilityLabel={entry.favorite ? 'Retirer des préférés' : 'Ajouter aux préférés'}
          accessibilityState={{ selected: !!entry.favorite }}
        >
          <View style={styles.backBtnInner}>
            <Ionicons
              name={entry.favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={entry.favorite ? COLORS.accentBright : COLORS.onInk}
            />
          </View>
        </Pressable>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          {series.coverImage ? (
            <Image
              source={{ uri: series.coverImage }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : null}
          <LinearGradient
            colors={[inkScrim(0.15), inkScrim(0.7), COLORS.ink]}
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
                    {series.type}
                  </Typography>
                </View>
                {totalVolumes > 0 && (
                  <Typography variant="kicker" color={COLORS.onInkMuted}>
                    {totalVolumes} tomes
                  </Typography>
                )}
              </View>
              <Typography variant="hero" color={COLORS.onInk} style={styles.heroTitle} numberOfLines={3}>
                {series.title}
              </Typography>
              {series.authors.length > 0 && (
                <Typography variant="label" color={COLORS.onInkMuted} numberOfLines={2}>
                  {series.authors.join(', ')}
                </Typography>
              )}
            </MotiView>
          </View>
        </View>

        <View style={styles.content}>
          {/* Tracking */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 140 }}
          >
            <Panel variant="paper" bordered hardShadow style={styles.trackingCard}>
              <View style={styles.trackingInner}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionMarker} />
                  <Typography variant="heading" color={COLORS.textInk}>
                    {entry ? 'Votre suivi' : 'Ajouter à la bibliothèque'}
                  </Typography>
                </View>

                {/* Status picker */}
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
                        {statusLabels[status]}
                      </Typography>
                    </Pressable>
                  ))}
                </View>

                {/* Progress bar */}
                {totalVolumes > 0 && (
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Typography variant="label" color={COLORS.textInkMuted}>
                        {readCount} / {totalVolumes} tomes lus
                      </Typography>
                      <Typography variant="label" color={entry?.status === 'COMPLETED' ? COLORS.statusCompleted : COLORS.accentRed}>
                        {entry?.status ? statusLabels[entry.status] : '—'}
                      </Typography>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progressPct * 100}%` as `${number}%` }]} />
                    </View>
                  </View>
                )}

                {entry && (
                  <>
                    {/* Work-level rating */}
                    <View style={styles.ratingSection}>
                      <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionMarker} />
                        <Typography variant="subheading" color={COLORS.textInk}>Ma note</Typography>
                      </View>
                      <StarRating
                        score={entry.score}
                        onRate={score => updateScore(entry.seriesId, score)}
                      />
                    </View>

                    {/* Journal de lecture */}
                    <View style={styles.ratingSection}>
                      <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionMarker} />
                        <Typography variant="subheading" color={COLORS.textInk}>Notes</Typography>
                      </View>
                      <TextInput
                        style={styles.notesInput}
                        value={notes}
                        onChangeText={setNotes}
                        onBlur={() => updateNotes(entry.seriesId, notes)}
                        placeholder="Vos impressions sur cette série…"
                        placeholderTextColor={COLORS.textInkMuted}
                        multiline
                        numberOfLines={3}
                        accessibilityLabel="Journal de lecture"
                      />
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

          {/* Series description (from Wikipedia FR) */}
          {series.description && (
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 180 }}
            >
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionMarker} />
                <Typography variant="title" color={COLORS.textInk}>Synopsis</Typography>
              </View>
              <Panel variant="paper" bordered style={styles.synopsisCard}>
                <Typography variant="body" color={COLORS.textInkMuted} style={styles.synopsisText}>
                  {series.description}
                </Typography>
              </Panel>
            </MotiView>
          )}

          {/* Volume list */}
          {series.volumes.length > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 220 }}
            >
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionMarker} />
                <Typography variant="title" color={COLORS.textInk}>Tomes</Typography>
                <Typography variant="caption" color={COLORS.textInkFaint} style={styles.tomeHint}>
                  Cochez pour marquer lu · tapez la carte pour le résumé
                </Typography>
              </View>
              <View style={styles.volumesGrid}>
                {series.volumes.map(vol => {
                  const isRead = entry?.readVolumes.includes(vol.num) ?? false;
                  return (
                    <VolumeCard
                      key={vol.num}
                      volume={vol}
                      seriesTitle={series.title}
                      isRead={isRead}
                      onToggle={() => handleToggle(vol.num)}
                      onEnrich={desc => updateVolumeDetail(series.id, vol.num, { description: desc })}
                    />
                  );
                })}
              </View>
            </MotiView>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  backBtn: { position: 'absolute', left: SPACING.base, zIndex: 100 },
  favBtn: { position: 'absolute', right: SPACING.base, zIndex: 100 },
  backBtnInner: {
    width: 44, height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.ink,
    borderWidth: BORDERS.bold, borderColor: COLORS.lineOnInk,
    alignItems: 'center', justifyContent: 'center',
  },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.xl },
  retryBtn: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.accentRed,
    borderRadius: RADIUS.sm,
  },
  hero: { height: 320, backgroundColor: COLORS.ink, justifyContent: 'flex-end' },
  heroBottom: { padding: SPACING.base, gap: SPACING.sm },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  typeBadge: {
    backgroundColor: COLORS.cyan,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: BORDERS.bold, borderColor: 'rgba(0,0,0,0.2)',
  },
  typeBadgeText: { fontSize: 9, letterSpacing: 1.5 },
  heroTitle: { fontSize: 34, lineHeight: 36 },
  content: { padding: SPACING.base, gap: SPACING.lg, backgroundColor: COLORS.paper },

  trackingCard: { borderRadius: RADIUS.lg },
  trackingInner: { padding: SPACING.base, gap: SPACING.md },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  sectionMarker: { width: 4, height: 20, backgroundColor: COLORS.accentRed, borderRadius: 2 },
  tomeHint: { flex: 1, fontSize: 9, lineHeight: 13 },

  statusPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statusBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.hair, borderColor: COLORS.line,
  },
  statusBtnActive: { backgroundColor: COLORS.accentSoft, borderColor: `${COLORS.accentRed}66` },
  statusBtnLabel: { color: COLORS.textInkMuted, fontSize: 12 },
  statusBtnLabelActive: { color: COLORS.accentRed },

  progressSection: { gap: SPACING.xs },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: {
    height: 6, backgroundColor: COLORS.paperSunken,
    borderRadius: RADIUS.full, overflow: 'hidden',
    borderWidth: BORDERS.hair, borderColor: COLORS.line,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.accentRed, borderRadius: RADIUS.full },
  removeBtn: { alignSelf: 'center', paddingVertical: SPACING.sm },
  ratingSection: { gap: SPACING.sm },
  notesInput: {
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.line,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    color: COLORS.textInk,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  volumesGrid: { gap: SPACING.sm },

  volumeCard: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.paperRaised,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  volumeCardRead: { backgroundColor: COLORS.paper },
  volumeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  volumeMainPressed: { opacity: 0.85 },
  volumeCoverWrap: {
    borderRadius: RADIUS.sm,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
    flexShrink: 0,
  },
  volumeCover: { width: 44, height: 62 },
  volumeChip: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold, borderColor: COLORS.ink,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  volumeChipRead: { backgroundColor: COLORS.accentRed, borderColor: COLORS.accentDeep },
  volumeChipText: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.textInkMuted },
  volumeChipTextRead: { color: COLORS.onInk },
  volumeInfo: { flex: 1, gap: 2 },
  volumeKicker: { letterSpacing: 1 },
  volumeSubtitle: { fontSize: 14, lineHeight: 18 },
  volumeCheck: { padding: SPACING.xs },
  volumeDetail: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: 0,
  },
  volumeDesc: { lineHeight: 22, fontSize: 13 },
  synopsisCard: { borderRadius: RADIUS.lg, padding: SPACING.base },
  synopsisText: { lineHeight: 24, fontSize: 14 },
}));
