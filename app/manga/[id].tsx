import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as anilist from '@/lib/api/anilist';
import * as mangadex from '@/lib/api/mangadex';
import { findMangadexId, getReadableChapters } from '@/lib/api/mangadex';
import * as jikan from '@/lib/api/jikan';
import { useLibraryStore } from '@/lib/store/library';
import { confirmAction } from '@/lib/utils/confirm';
import { Panel } from '@/components/ui/Panel';
import { Halftone } from '@/components/ui/Halftone';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { Typography } from '@/components/ui/Typography';
import { ChapterList } from '@/components/manga/ChapterList';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, STATUS_LABELS } from '@/constants/theme';
import type { Manga, MangaChapter, ReadingStatus } from '@/lib/types';

const STATUSES: ReadingStatus[] = ['READING', 'PLAN_TO_READ', 'COMPLETED', 'PAUSED', 'DROPPED'];

type ActiveTab = 'about' | 'chapters';

const SPRING = { stiffness: 300, damping: 26 };

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
        <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandBtn} hitSlop={8}>
          <Typography variant="label" color={COLORS.accentRed}>
            {expanded ? 'Voir moins ↑' : 'Voir plus ↓'}
          </Typography>
        </Pressable>
      )}
    </View>
  );
}

function ScorePicker({ score, onChange }: { score?: number; onChange: (s: number) => void }) {
  return (
    <View style={styles.scoreRow}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <Pressable
          key={n}
          style={[styles.scoreBtn, score === n && styles.scoreBtnActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(n);
          }}
        >
          <Typography
            style={[styles.scoreBtnLabel, score === n && styles.scoreBtnLabelActive]}
          >
            {n}
          </Typography>
        </Pressable>
      ))}
    </View>
  );
}

function TrackingPanel({ manga, totalChapters, readCount, onGoToChapters }: {
  manga: Manga;
  totalChapters: number;
  readCount: number;
  onGoToChapters?: () => void;
}) {
  const addEntry = useLibraryStore(s => s.addEntry);
  const updateStatus = useLibraryStore(s => s.updateStatus);
  const updateScore = useLibraryStore(s => s.updateScore);
  const removeEntry = useLibraryStore(s => s.removeEntry);
  const entry = useLibraryStore(s =>
    s.entries.find(e => e.mangaId === manga.id && e.source === manga.source),
  );

  const handleAddWithStatus = (status: ReadingStatus) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (entry) {
      updateStatus(manga.id, manga.source, status);
    } else {
      addEntry(manga, status);
    }
  };

  const progressPct = totalChapters > 0 ? Math.min(readCount / totalChapters, 1) : 0;

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    confirmAction({
      title: 'Retirer',
      message: 'Retirer de votre bibliothèque ?',
      confirmLabel: 'Retirer',
      destructive: true,
      onConfirm: () => {
        removeEntry(manga.id, manga.source);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      },
    });
  };

  return (
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
              style={[
                styles.statusBtn,
                entry?.status === status && styles.statusBtnActive,
              ]}
              onPress={() => handleAddWithStatus(status)}
            >
              <Typography
                variant="label"
                style={[
                  styles.statusBtnLabel,
                  entry?.status === status && styles.statusBtnLabelActive,
                ]}
              >
                {STATUS_LABELS[status]}
              </Typography>
            </Pressable>
          ))}
        </View>

        {entry && (
          <>
            {totalChapters > 0 && (
              <Pressable style={styles.progressSection} onPress={onGoToChapters} hitSlop={4}>
                <View style={styles.progressHeader}>
                  <Typography variant="subheading" color={COLORS.textInk}>
                    Progression
                  </Typography>
                  <Typography variant="label" color={COLORS.textInkMuted}>
                    {readCount} / {totalChapters} chapitres
                  </Typography>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPct * 100}%` as `${number}%` }]} />
                </View>
                {onGoToChapters && (
                  <View style={styles.progressHint}>
                    <Ionicons name="checkbox-outline" size={14} color={COLORS.accentRed} />
                    <Typography variant="label" color={COLORS.accentRed}>
                      Cocher mes chapitres lus →
                    </Typography>
                  </View>
                )}
              </Pressable>
            )}

            <View style={styles.scoreSection}>
              <Typography variant="subheading" color={COLORS.textInk}>
                Score {entry.score ? `· ${entry.score}/10` : ''}
              </Typography>
              <ScorePicker
                score={entry.score}
                onChange={s => updateScore(manga.id, manga.source, s)}
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
  );
}

function LoadingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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


export default function MangaDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, source } = useLocalSearchParams<{ id: string; source: string }>();
  const [activeTab, setActiveTab] = useState<ActiveTab>('about');

  const { data: manga, isLoading, isError } = useQuery({
    queryKey: ['manga-detail', id, source],
    queryFn: async () => {
      if (!id) throw new Error('No ID');
      if (source === 'mangadex') return mangadex.getMangaById(id);
      if (source === 'jikan') return jikan.getMangaById(id);
      return anilist.getMangaById(id);
    },
    enabled: !!id,
  });

  const searchTitle = manga
    ? (manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred)
    : '';
  const directMdId = manga ? (manga.source === 'mangadex' ? manga.id : manga.mangadexId) : null;

  const { data: resolvedMdId } = useQuery({
    queryKey: ['resolve-mdid', manga?.source, manga?.id, manga?.year],
    queryFn: () => findMangadexId(searchTitle, manga?.year ? { year: manga.year } : undefined),
    enabled: !!manga && !directMdId && !!searchTitle,
    staleTime: 1000 * 60 * 60,
  });
  const effectiveMdId = directMdId ?? resolvedMdId ?? null;

  const { data: chapters } = useQuery({
    queryKey: ['readable-chapters', effectiveMdId],
    queryFn: () => getReadableChapters(effectiveMdId!),
    enabled: !!effectiveMdId,
    staleTime: 1000 * 60 * 5,
  });

  // Build the chapter list: real readable chapters when available, otherwise
  // synthesize one card per chapter from the API's total count (TV-Time style).
  const displayChapters = useMemo<MangaChapter[]>(() => {
    if (chapters && chapters.length > 0) return chapters;
    const count = manga?.chapters ?? 0;
    if (!manga || count <= 0) return [];
    return Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      return {
        id: `${manga.id}-syn-${n}`,
        mangaId: manga.id,
        chapter: String(n),
        pages: 0,
        publishAt: '',
        translatedLanguage: '',
        isReadable: false,
      } satisfies MangaChapter;
    });
  }, [chapters, manga]);

  const entry = useLibraryStore(s =>
    manga ? s.entries.find(e => e.mangaId === manga.id && e.source === manga.source) : undefined,
  );
  const readCount = useMemo(() => {
    if (!entry) return 0;
    const ids = entry.readChapterIds ?? [];
    if (displayChapters.length > 0) {
      return displayChapters.filter(
        ch => ids.includes(ch.id) || (Number.isFinite(parseFloat(ch.chapter)) && parseFloat(ch.chapter) <= entry.progress),
      ).length;
    }
    return entry.progress;
  }, [entry, displayChapters]);

  const showChaptersTab = displayChapters.length > 0;
  const totalChapters = displayChapters.length || manga?.chapters || 0;

  if (isLoading) return <LoadingScreen />;

  if (isError || !manga) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
          </View>
        </Pressable>
        <View style={styles.errorState}>
          <Halftone opacity={0.04} />
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.textInkMuted} />
          <Typography variant="heading" color={COLORS.textInk}>Impossible de charger</Typography>
          <Typography variant="body" color={COLORS.textInkMuted}>Une erreur s&apos;est produite. Réessayez.</Typography>
        </View>
      </View>
    );
  }

  const displayTitle = manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred;
  const currentTab: ActiveTab = showChaptersTab ? activeTab : 'about';

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => router.back()}
      >
        <View style={styles.backBtnInner}>
          <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
        </View>
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Ink hero */}
        <View style={styles.hero}>
          <Image
            source={{ uri: manga.bannerImage ?? manga.coverImage }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
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
                <TypeBadge type={manga.type} />
                <Typography variant="kicker" color={COLORS.onInkMuted}>
                  {manga.year ?? '—'} · {manga.status === 'ONGOING' ? 'En cours' : manga.status === 'COMPLETED' ? 'Terminé' : manga.status}
                </Typography>
              </View>
              <Typography variant="hero" color={COLORS.onInk} style={styles.heroTitle} numberOfLines={3}>
                {displayTitle}
              </Typography>
            </MotiView>
          </View>
        </View>

        {/* Underline tab bar */}
        {showChaptersTab && (
          <View style={styles.tabBar}>
            {(['about', 'chapters'] as const).map(tab => {
              const isActive = currentTab === tab;
              const label = tab === 'about' ? 'À PROPOS' : 'CHAPITRES';
              return (
                <Pressable
                  key={tab}
                  style={styles.tabItem}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveTab(tab);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={label}
                >
                  <Typography
                    variant="kicker"
                    style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                  >
                    {label}
                  </Typography>
                </Pressable>
              );
            })}
            <View style={styles.tabUnderline}>
              <TabUnderlineIndicator activeTab={currentTab} />
            </View>
          </View>
        )}

        {/* À PROPOS */}
        {currentTab === 'about' && (
          <View style={styles.content}>
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 140 }}
            >
              <Panel variant="paper" bordered style={styles.infoCard}>
                <View style={styles.infoGrid}>
                  <InfoItem label="Auteur(s)" value={manga.authors.join(', ') || '—'} />
                  <InfoItem label="Chapitres" value={manga.chapters ? String(manga.chapters) : '—'} />
                  <InfoItem label="Volumes" value={manga.volumes ? String(manga.volumes) : '—'} />
                  <InfoItem
                    label="Score"
                    value={manga.averageScore ? `${(manga.averageScore / 10).toFixed(1)}/10` : '—'}
                    highlight
                  />
                </View>
              </Panel>
            </MotiView>

            {manga.genres.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 200 }}
              >
                <View style={styles.genresWrap}>
                  {manga.genres.map(g => (
                    <View key={g} style={styles.genreChip}>
                      <Typography variant="label" color={COLORS.accentRed}>{g}</Typography>
                    </View>
                  ))}
                </View>
              </MotiView>
            )}

            {manga.description && (
              <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 260 }}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionMarker} />
                  <Typography variant="title" color={COLORS.textInk}>Synopsis</Typography>
                </View>
                <DescriptionText text={manga.description} />
              </MotiView>
            )}

            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 320 }}
            >
              <TrackingPanel
                manga={manga}
                totalChapters={totalChapters}
                readCount={readCount}
                onGoToChapters={showChaptersTab ? () => setActiveTab('chapters') : undefined}
              />
            </MotiView>
          </View>
        )}

        {/* CHAPITRES */}
        {currentTab === 'chapters' && (
          <View style={[styles.chaptersContent, { paddingBottom: insets.bottom + 88 }]}>
            <ChapterList
              chapters={displayChapters}
              entryMangaId={manga.id}
              source={manga.source}
              manga={manga}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TabUnderlineIndicator({ activeTab }: { activeTab: ActiveTab }) {
  const x = useSharedValue(0);
  x.value = withSpring(activeTab === 'chapters' ? 1 : 0, SPRING);
  const style = useAnimatedStyle(() => ({
    left: `${x.value * 50}%` as `${number}%`,
    width: '50%',
  }));
  return <Animated.View style={[styles.tabLineIndicator, style]} />;
}

function InfoItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoItem}>
      <Typography variant="caption" color={COLORS.textInkMuted}>{label}</Typography>
      <Typography
        variant="subheading"
        color={highlight ? COLORS.warning : COLORS.textInk}
        style={styles.infoValue}
      >
        {value}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  scroll: {},
  backBtn: {
    position: 'absolute',
    left: SPACING.base,
    zIndex: 100,
  },
  backBtnInner: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.ink,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.lineOnInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 340,
    backgroundColor: COLORS.ink,
    justifyContent: 'flex-end',
  },
  heroBottom: {
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 36,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.ink,
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.base,
  },
  tabLabel: {
    color: COLORS.onInkMuted,
    letterSpacing: 1.5,
    fontSize: 11,
  },
  tabLabelActive: {
    color: COLORS.onInk,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  tabLineActive: {},
  tabLineIndicator: {
    position: 'absolute',
    height: 2,
    backgroundColor: COLORS.accentRed,
    borderRadius: 1,
  },
  content: {
    padding: SPACING.base,
    gap: SPACING.lg,
    backgroundColor: COLORS.paper,
  },
  chaptersContent: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.lg,
    backgroundColor: COLORS.paper,
  },
  infoCard: { borderRadius: RADIUS.lg },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.base,
    gap: SPACING.base,
  },
  infoItem: { width: '45%', gap: 4, flexGrow: 1 },
  infoValue: { fontSize: 15 },
  genresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  genreChip: {
    backgroundColor: COLORS.accentSoft,
    borderWidth: BORDERS.hair,
    borderColor: `${COLORS.accentRed}44`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionMarker: {
    width: 4,
    height: 20,
    backgroundColor: COLORS.accentRed,
    borderRadius: 2,
  },
  description: { lineHeight: 24 },
  expandBtn: { marginTop: SPACING.sm, alignSelf: 'flex-start' },
  trackingCard: { borderRadius: RADIUS.lg, overflow: 'visible' },
  trackingInner: { padding: SPACING.base, gap: SPACING.lg },
  trackingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statusBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  statusBtnActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: `${COLORS.accentRed}66`,
  },
  statusBtnLabel: { color: COLORS.textInkMuted, fontSize: 12 },
  statusBtnLabelActive: { color: COLORS.accentRed },
  progressSection: { gap: SPACING.sm },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.paperSunken,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.full,
  },
  progressHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  scoreSection: { gap: SPACING.sm },
  scoreRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  scoreBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBtnActive: {
    backgroundColor: COLORS.warning,
    borderColor: COLORS.warning,
  },
  scoreBtnLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textInkMuted,
  },
  scoreBtnLabelActive: { color: COLORS.ink },
  removeBtn: {
    alignSelf: 'center',
    paddingVertical: SPACING.sm,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
  },
});

