import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image, type ImageLoadEventData } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MotiView } from 'moti';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getChapterPages } from '@/lib/api/mangadex';
import { useLibraryStore } from '@/lib/store/library';
import { chapterNumber, compareChapters } from '@/lib/utils/chapter';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import type { MangaChapter } from '@/lib/types';

function ReaderPageBase({ uri, width, onTap }: { uri: string; width: number; onTap: () => void }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const handleLoad = useCallback((e: ImageLoadEventData) => {
    const { width: w, height: h } = e.source;
    if (w > 0 && h > 0) setRatio(w / h);
    setFailed(false);
  }, []);

  const handleError = useCallback(() => setFailed(true), []);
  const handleRetry = useCallback(() => setFailed(false), []);

  const height = ratio ? width / ratio : width * 1.4;

  return (
    <Pressable onPress={onTap}>
      <View style={{ width, height, backgroundColor: '#0a0a0a' }}>
        {failed ? (
          <Pressable style={styles.pageError} onPress={handleRetry} hitSlop={8}>
            <Ionicons name="reload" size={26} color={COLORS.onInkMuted} />
            <Typography variant="label" color={COLORS.onInkMuted} style={styles.pageErrorText}>
              Appuyez pour recharger
            </Typography>
          </Pressable>
        ) : (
          <Image
            source={{ uri }}
            style={{ width, height }}
            contentFit="contain"
            transition={120}
            cachePolicy="memory-disk"
            recyclingKey={uri}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </View>
    </Pressable>
  );
}

// Memoized so scroll-driven currentPage updates in the parent don't re-render
// (and re-fade) every mounted page — a key source of the "pages go black" bug.
const ReaderPage = React.memo(ReaderPageBase);

function ReaderChrome({
  mangaTitle,
  chapter,
  title,
  current,
  total,
  visible,
  indicatorVisible,
  onBack,
}: {
  mangaTitle: string;
  chapter: string;
  title?: string;
  current: number;
  total: number;
  visible: boolean;
  indicatorVisible: boolean;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <>
      <MotiView
        pointerEvents={visible ? 'box-none' : 'none'}
        animate={{ opacity: visible ? 1 : 0, translateY: visible ? 0 : -16 }}
        transition={{ type: 'timing', duration: 200 }}
        style={styles.topBar}
      >
        <LinearGradient
          colors={['rgba(22,19,14,0.9)', 'transparent']}
          style={[styles.topGradient, { paddingTop: insets.top + SPACING.sm }]}
        >
          <Pressable
            style={styles.backBtn}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Fermer le lecteur"
            hitSlop={8}
          >
            <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
          </Pressable>
          <View style={styles.topInfo}>
            <Typography variant="bodyBold" numberOfLines={1} color={COLORS.onInk} style={styles.topTitle}>
              {mangaTitle}
            </Typography>
            <Typography variant="label" numberOfLines={1} color={COLORS.onInkMuted}>
              Ch.{chapter}
              {title ? ` · ${title}` : ''}
            </Typography>
          </View>
        </LinearGradient>
      </MotiView>

      <MotiView
        pointerEvents="none"
        animate={{
          opacity: visible && indicatorVisible ? 1 : 0,
          translateY: visible && indicatorVisible ? 0 : 16,
        }}
        transition={{ type: 'timing', duration: 200 }}
        style={[styles.pageIndicatorWrap, { bottom: insets.bottom + SPACING.lg }]}
      >
        <View style={styles.pageIndicator}>
          <Typography variant="display" color={COLORS.onInk} style={styles.pageIndicatorText}>
            {Math.min(current, total)} / {total}
          </Typography>
        </View>
      </MotiView>
    </>
  );
}

function ChapterEndBanner({
  visible,
  nextChapter,
  onNext,
  onBack,
}: {
  visible: boolean;
  nextChapter: MangaChapter | null;
  onNext: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  return (
    <MotiView
      pointerEvents={visible ? 'box-none' : 'none'}
      from={{ opacity: 0, translateY: 24 }}
      animate={{ opacity: visible ? 1 : 0, translateY: visible ? 0 : 24 }}
      transition={{ type: 'timing', duration: reduceMotion ? 0 : 240 }}
      style={[styles.endBannerWrap, { bottom: insets.bottom + SPACING.lg }]}
    >
      <View style={styles.endBanner}>
        <View style={styles.endBannerHeader}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.accentBright} />
          <Typography variant="kicker" color={COLORS.onInk} style={styles.endBannerTitle}>
            Chapitre terminé
          </Typography>
        </View>
        {nextChapter ? (
          <Pressable
            style={({ pressed }) => [styles.endBannerCta, pressed && styles.endBannerCtaPressed]}
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={`Lire le chapitre suivant, chapitre ${nextChapter.chapter}`}
          >
            <Typography variant="bodyBold" color={COLORS.onInk}>
              Chapitre suivant
            </Typography>
            <Ionicons name="arrow-forward" size={18} color={COLORS.onInk} />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.endBannerCta, pressed && styles.endBannerCtaPressed]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Retour à la fiche"
          >
            <Typography variant="bodyBold" color={COLORS.onInk}>
              Retour à la fiche
            </Typography>
          </Pressable>
        )}
      </View>
    </MotiView>
  );
}

function ReaderMessage({ loading, onBack }: { loading: boolean; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.centered}>
      <StatusBar style="light" hidden />
      <Pressable
        style={[styles.backBtn, styles.backBtnFloating, { top: insets.top + SPACING.sm }]}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Retour"
        hitSlop={8}
      >
        <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
      </Pressable>
      {loading ? (
        <>
          <ActivityIndicator color={COLORS.accentRed} size="large" />
          <Typography variant="body" color={COLORS.onInkMuted} style={styles.messageText}>
            Chargement du chapitre…
          </Typography>
        </>
      ) : (
        <>
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.onInkMuted} />
          <Typography variant="heading" color={COLORS.onInk} style={styles.messageHeading}>
            Impossible de charger ce chapitre
          </Typography>
          <Pressable style={styles.retryBtn} onPress={onBack}>
            <Typography variant="bodyBold" color={COLORS.onInk}>
              Retour
            </Typography>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function ReaderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id, chapter, title, mangaTitle, entryMangaId, source } = useLocalSearchParams<{
    id: string;
    chapter: string;
    title?: string;
    mangaTitle?: string;
    entryMangaId?: string;
    source?: string;
  }>();

  const { width } = useWindowDimensions();
  const [chromeVisible, setChromeVisible] = useState(true);
  const toggleChrome = useCallback(() => setChromeVisible(v => !v), []);
  const [currentPage, setCurrentPage] = useState(1);
  const [finished, setFinished] = useState(false);
  const markChapterRead = useLibraryStore(s => s.markChapterRead);

  const { data: pages, isLoading, isError } = useQuery({
    queryKey: ['chapter-pages', id],
    queryFn: () => getChapterPages(id),
    enabled: !!id,
  });

  const total = pages?.length ?? 0;

  const nextChapter = useMemo<MangaChapter | null>(() => {
    if (!id) return null;
    const cached = queryClient.getQueriesData<MangaChapter[]>({ queryKey: ['tracking-chapters'] });
    for (const [, chapters] of cached) {
      if (!chapters) continue;
      const readable = chapters.filter(ch => ch.isReadable !== false).sort(compareChapters);
      const index = readable.findIndex(ch => ch.id === id);
      if (index >= 0) return readable[index + 1] ?? null;
    }
    return null;
  }, [queryClient, id]);

  useEffect(() => {
    setFinished(false);
    setCurrentPage(1);
  }, [id]);

  useEffect(() => {
    if (finished || total === 0 || currentPage < total) return;
    setFinished(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (id && entryMangaId && source) {
      markChapterRead(entryMangaId, source, id, chapterNumber(chapter));
    }
  }, [currentPage, total, finished, id, chapter, entryMangaId, source, markChapterRead]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find(v => v.isViewable && v.index != null);
      if (first?.index != null) setCurrentPage(first.index + 1);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleNext = useCallback(() => {
    if (!nextChapter) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace(
      `/reader/${nextChapter.id}?chapter=${encodeURIComponent(nextChapter.chapter)}&title=${encodeURIComponent(nextChapter.title ?? '')}&entryMangaId=${encodeURIComponent(entryMangaId ?? '')}&source=${encodeURIComponent(source ?? '')}&mangaTitle=${encodeURIComponent(mangaTitle ?? '')}` as never,
    );
  }, [nextChapter, router, entryMangaId, source, mangaTitle]);

  if (isLoading) return <ReaderMessage loading onBack={handleBack} />;
  if (isError || !pages || pages.length === 0) {
    return <ReaderMessage loading={false} onBack={handleBack} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden />
      <FlatList
        data={pages}
        keyExtractor={(uri, index) => `${index}-${uri}`}
        renderItem={({ item }) => <ReaderPage uri={item} width={width} onTap={toggleChrome} />}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={false}
        windowSize={5}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={60}
      />

      <ReaderChrome
        mangaTitle={mangaTitle ?? 'Lecture'}
        chapter={chapter ?? ''}
        title={title}
        current={currentPage}
        total={total}
        visible={chromeVisible}
        indicatorVisible={!finished}
        onBack={handleBack}
      />

      <ChapterEndBanner
        visible={finished}
        nextChapter={nextChapter}
        onNext={handleNext}
        onBack={handleBack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  pageError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  pageErrorText: { textAlign: 'center' },
  centered: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.base,
    padding: SPACING.xl,
  },
  messageText: { textAlign: 'center' },
  messageHeading: { textAlign: 'center', fontSize: 18 },
  retryBtn: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentRed,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.lg,
  },
  topInfo: { flex: 1 },
  topTitle: { fontSize: 15 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.lineOnInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnFloating: {
    position: 'absolute',
    left: SPACING.base,
    zIndex: 10,
  },
  pageIndicatorWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pageIndicator: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentRed,
  },
  pageIndicatorText: {
    fontFamily: FONTS.display,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 1,
  },
  endBannerWrap: {
    position: 'absolute',
    left: SPACING.base,
    right: SPACING.base,
    alignItems: 'center',
  },
  endBanner: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.ink,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.lineOnInk,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.md,
  },
  endBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  endBannerTitle: {
    fontSize: 16,
    letterSpacing: 2,
  },
  endBannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentRed,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.accentDeep,
    paddingHorizontal: SPACING.lg,
  },
  endBannerCtaPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
