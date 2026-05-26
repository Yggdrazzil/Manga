import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as anilist from '@/lib/api/anilist';
import * as mangadex from '@/lib/api/mangadex';
import { findMangadexId, getReadableChapters } from '@/lib/api/mangadex';
import * as jikan from '@/lib/api/jikan';
import { useLibraryStore } from '@/lib/store/library';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { Typography } from '@/components/ui/Typography';
import { ChapterList } from '@/components/manga/ChapterList';
import { COLORS, FONTS, RADIUS, SPACING, STATUS_LABELS } from '@/constants/theme';
import type { Manga, ReadingStatus } from '@/lib/types';

const STATUSES: ReadingStatus[] = ['READING', 'PLAN_TO_READ', 'COMPLETED', 'PAUSED', 'DROPPED'];

type ActiveTab = 'about' | 'chapters';

function DescriptionText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const maxChars = 220;
  const shouldTruncate = text.length > maxChars;
  const displayed = shouldTruncate && !expanded ? `${text.slice(0, maxChars)}…` : text;

  return (
    <View>
      <Typography variant="body" style={styles.description}>{displayed}</Typography>
      {shouldTruncate && (
        <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
          <Typography variant="label" color={COLORS.accent}>
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

function TrackingPanel({ manga }: { manga: Manga }) {
  const addEntry = useLibraryStore(s => s.addEntry);
  const updateStatus = useLibraryStore(s => s.updateStatus);
  const updateProgress = useLibraryStore(s => s.updateProgress);
  const updateScore = useLibraryStore(s => s.updateScore);
  const removeEntry = useLibraryStore(s => s.removeEntry);
  const getEntry = useLibraryStore(s => s.getEntry);

  const entry = getEntry(manga.id, manga.source);
  const [chapterInput, setChapterInput] = useState(String(entry?.progress ?? 0));

  const handleAddWithStatus = (status: ReadingStatus) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (entry) {
      updateStatus(manga.id, manga.source, status);
    } else {
      addEntry(manga, status);
    }
  };

  const handleProgressSave = () => {
    const val = parseInt(chapterInput, 10);
    if (!isNaN(val) && val >= 0) {
      if (!entry) addEntry(manga, 'READING');
      updateProgress(manga.id, manga.source, val);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRemove = () => {
    Alert.alert('Retirer', 'Retirer de votre bibliothèque ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          removeEntry(manga.id, manga.source);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  return (
    <GlassCard style={styles.trackingCard}>
      <View style={styles.trackingInner}>
        <Typography variant="heading" style={styles.trackingTitle}>
          {entry ? '📚 Votre suivi' : '➕ Ajouter à la bibliothèque'}
        </Typography>

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
            <View style={styles.progressSection}>
              <Typography variant="bodyBold" style={styles.sectionLabel}>
                Chapitres lus
                {manga.chapters ? ` / ${manga.chapters}` : ''}
              </Typography>
              <View style={styles.progressInputRow}>
                <TextInput
                  style={styles.progressInput}
                  value={chapterInput}
                  onChangeText={setChapterInput}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleProgressSave}
                  placeholderTextColor={COLORS.textMuted}
                />
                <GlassButton
                  label="Sauvegarder"
                  variant="ghost"
                  size="sm"
                  onPress={handleProgressSave}
                />
              </View>
            </View>

            <View style={styles.scoreSection}>
              <Typography variant="bodyBold" style={styles.sectionLabel}>
                Score {entry.score ? `· ${entry.score}/10` : ''}
              </Typography>
              <ScorePicker
                score={entry.score}
                onChange={s => updateScore(manga.id, manga.source, s)}
              />
            </View>

            <Pressable onPress={handleRemove} style={styles.removeBtn}>
              <Typography variant="label" color={COLORS.error}>
                Retirer de la bibliothèque
              </Typography>
            </Pressable>
          </>
        )}
      </View>
    </GlassCard>
  );
}

function LoadingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <BlurView intensity={30} tint="dark" style={styles.backBtnBlur}>
          <Ionicons name="chevron-down" size={22} color={COLORS.text} />
        </BlurView>
      </Pressable>
      <ActivityIndicator color={COLORS.accent} size="large" style={{ flex: 1 }} />
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
    ? manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred
    : '';
  const directMdId = manga ? (manga.source === 'mangadex' ? manga.id : manga.mangadexId) : null;

  const { data: resolvedMdId } = useQuery({
    queryKey: ['resolve-mdid', manga?.source, manga?.id],
    queryFn: () => findMangadexId(searchTitle),
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
  const hasChapters = (chapters?.length ?? 0) > 0;
  const showChaptersTab = hasChapters;

  if (isLoading) return <LoadingScreen />;

  if (isError || !manga) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <BlurView intensity={30} tint="dark" style={styles.backBtnBlur}>
            <Ionicons name="chevron-down" size={22} color={COLORS.text} />
          </BlurView>
        </Pressable>
        <View style={styles.errorState}>
          <Typography variant="display" style={styles.errorEmoji}>😔</Typography>
          <Typography variant="heading">Impossible de charger</Typography>
          <Typography variant="body">Une erreur s&apos;est produite. Réessayez.</Typography>
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
        {Platform.OS === 'ios' ? (
          <BlurView intensity={30} tint="dark" style={styles.backBtnBlur}>
            <Ionicons name="chevron-down" size={22} color={COLORS.text} />
          </BlurView>
        ) : (
          <View style={[styles.backBtnBlur, styles.backBtnAndroid]}>
            <Ionicons name="chevron-down" size={22} color={COLORS.text} />
          </View>
        )}
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Image
            source={{ uri: manga.bannerImage ?? manga.coverImage }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['rgba(10,11,20,0.2)', 'rgba(10,11,20,0.6)', COLORS.bg]}
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
                <Typography variant="caption" color="rgba(255,255,255,0.6)">
                  {manga.year ?? '—'} · {manga.status === 'ONGOING' ? 'En cours' : manga.status === 'COMPLETED' ? 'Terminé' : manga.status}
                </Typography>
              </View>
              <Typography variant="display" style={styles.heroTitle} numberOfLines={3}>
                {displayTitle}
              </Typography>
            </MotiView>
          </View>
        </View>

        {/* Tab bar — only when readable chapters exist */}
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
                    variant="label"
                    style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                  >
                    {label}
                  </Typography>
                  <View style={[styles.tabLine, isActive && styles.tabLineActive]} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* À PROPOS tab */}
        {currentTab === 'about' && (
          <View style={styles.content}>
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 160 }}
            >
              <GlassCard style={styles.infoCard}>
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
              </GlassCard>
            </MotiView>

            {manga.genres.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 220 }}
                style={styles.genresSection}
              >
                <View style={styles.genresWrap}>
                  {manga.genres.map(g => (
                    <View key={g} style={styles.genreChip}>
                      <Typography variant="label" color={COLORS.accentLight}>{g}</Typography>
                    </View>
                  ))}
                </View>
              </MotiView>
            )}

            {manga.description && (
              <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 280 }}
              >
                <Typography variant="heading" style={styles.sectionHeading}>Synopsis</Typography>
                <DescriptionText text={manga.description} />
              </MotiView>
            )}

            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 340 }}
            >
              <TrackingPanel manga={manga} />
            </MotiView>
          </View>
        )}

        {/* CHAPITRES tab */}
        {currentTab === 'chapters' && (
          <View style={[styles.chaptersContent, { paddingBottom: insets.bottom + 88 }]}>
            <ChapterList
              chapters={chapters ?? []}
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

function InfoItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoItem}>
      <Typography variant="caption">{label}</Typography>
      <Typography
        variant="bodyBold"
        color={highlight ? COLORS.warning : COLORS.text}
        style={styles.infoValue}
      >
        {value}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: {},
  backBtn: {
    position: 'absolute',
    left: SPACING.base,
    zIndex: 100,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  backBtnBlur: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnAndroid: {
    backgroundColor: 'rgba(10,11,20,0.85)',
    borderRadius: RADIUS.full,
  },
  hero: {
    height: 320,
    backgroundColor: COLORS.surfaceRaised,
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
    fontSize: 30,
    lineHeight: 32,
    color: COLORS.text,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  tabLabel: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyBold,
    letterSpacing: 1,
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  tabLabelActive: {
    color: COLORS.accentLight,
  },
  tabLine: {
    height: 2,
    width: '60%',
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  tabLineActive: {
    backgroundColor: COLORS.accent,
  },
  content: {
    padding: SPACING.base,
    gap: SPACING.lg,
  },
  chaptersContent: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.lg,
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
  genresSection: {},
  genresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  genreChip: {
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: `${COLORS.accent}33`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  sectionHeading: { fontSize: 16, marginBottom: SPACING.sm },
  description: { lineHeight: 24, color: COLORS.textSecondary },
  expandBtn: { marginTop: SPACING.sm, alignSelf: 'flex-start' },
  trackingCard: { borderRadius: RADIUS.xl },
  trackingInner: { padding: SPACING.base, gap: SPACING.lg },
  trackingTitle: { fontSize: 17 },
  statusPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statusBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusBtnActive: {
    backgroundColor: COLORS.accentMuted,
    borderColor: `${COLORS.accent}66`,
  },
  statusBtnLabel: { color: COLORS.textMuted, fontFamily: FONTS.bodyMedium, fontSize: 12 },
  statusBtnLabelActive: { color: COLORS.accentLight },
  progressSection: { gap: SPACING.sm },
  sectionLabel: { color: COLORS.text, fontSize: 14 },
  progressInputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  progressInput: {
    width: 80,
    height: 44,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.text,
    textAlign: 'center',
  },
  scoreSection: { gap: SPACING.sm },
  scoreRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  scoreBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.textMuted,
  },
  scoreBtnLabelActive: { color: '#000' },
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
  errorEmoji: { fontSize: 60, lineHeight: 70 },
});
