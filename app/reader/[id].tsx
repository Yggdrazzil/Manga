import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
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
import { getChapterPages as getMDChapterPages } from '@/lib/api/mangadex';
import { getChapterPages as getCKChapterPages } from '@/lib/api/comick';
import { getChapterPages as getMPChapterPages } from '@/lib/api/mangaplus';
import { getChapterPages as getWTChapterPages } from '@/lib/api/webtoon';
import { useDownloadsStore } from '@/lib/store/downloads';
import { getLocalPages } from '@/lib/utils/downloads';
import { useLibraryStore } from '@/lib/store/library';
import { useSettingsStore } from '@/lib/store/settings';
import { chapterNumber, compareChapters } from '@/lib/utils/chapter';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, themedStyles } from '@/constants/theme';
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
  offline,
  onBack,
}: {
  mangaTitle: string;
  chapter: string;
  title?: string;
  current: number;
  total: number;
  visible: boolean;
  indicatorVisible: boolean;
  offline?: boolean;
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
              {offline ? ' · Hors-ligne' : ''}
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
            accessibilityLabel={`Lire le chapitre suivant${nextChapter.chapter ? `, chapitre ${nextChapter.chapter}` : ''}`}
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

function ResumeBanner({
  page,
  visible,
  onResume,
  onDismiss,
}: {
  page: number;
  visible: boolean;
  onResume: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  return (
    <MotiView
      pointerEvents={visible ? 'box-none' : 'none'}
      animate={{ opacity: visible ? 1 : 0, translateY: visible ? 0 : 20 }}
      transition={{ type: 'timing', duration: reduceMotion ? 0 : 220 }}
      style={[styles.resumeWrap, { top: insets.top + 70 }]}
    >
      <View style={styles.resumeBanner}>
        <Ionicons name="bookmark" size={16} color={COLORS.accentBright} />
        <Typography variant="label" color={COLORS.onInk} style={styles.resumeText}>
          Reprendre à la page {page}
        </Typography>
        <Pressable
          style={styles.resumeBtn}
          onPress={onResume}
          accessibilityRole="button"
          accessibilityLabel={`Reprendre à la page ${page}`}
          hitSlop={6}
        >
          <Typography variant="caption" color={COLORS.onInk} style={styles.resumeBtnLabel}>
            REPRENDRE
          </Typography>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Ignorer">
          <Ionicons name="close" size={16} color={COLORS.onInkMuted} />
        </Pressable>
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
  const { id, chapter, title, mangaTitle, entryMangaId, source, pagesSource } = useLocalSearchParams<{
    id: string;
    chapter: string;
    title?: string;
    mangaTitle?: string;
    entryMangaId?: string;
    source?: string;
    pagesSource?: string;
  }>();
  // `source` is the library-entry identity (read tracking); `pagesSource` is the
  // adapter the pages come from — they differ when a fallback feed (MangaPlus /
  // Comick / Webtoon) backs an AniList catalogue entry.
  const feedSource = pagesSource || source;

  const { width } = useWindowDimensions();
  const [chromeVisible, setChromeVisible] = useState(true);
  const toggleChrome = useCallback(() => setChromeVisible(v => !v), []);
  const [currentPage, setCurrentPage] = useState(1);
  const [finished, setFinished] = useState(false);
  const [resumeVisible, setResumeVisible] = useState(false);
  const [resumePage, setResumePage] = useState(0);
  const flatListRef = useRef<FlatList<string>>(null);
  const savePositionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chapterIdRef = useRef(id);
  const markChapterRead = useLibraryStore(s => s.markChapterRead);
  const getReadingPosition = useLibraryStore(s => s.getReadingPosition);
  const clearReadingPosition = useLibraryStore(s => s.clearReadingPosition);
  const dataSaver = useSettingsStore(s => s.dataSaver);

  // Downloaded chapters read from disk — works offline, immune to MangaDex
  // URL expiry. Subscribing to the store entry refreshes if it gets deleted.
  const downloadEntry = useDownloadsStore(s => s.downloads[id ?? '']);
  const localPages = useMemo(
    () => (id && downloadEntry ? getLocalPages(id) : null),
    [id, downloadEntry],
  );

  const { data: pages, isLoading, isError } = useQuery({
    queryKey: ['chapter-pages', id, feedSource, dataSaver, localPages != null],
    queryFn: () => {
      if (localPages) return Promise.resolve(localPages);
      if (feedSource === 'comick') return getCKChapterPages(id!);
      if (feedSource === 'mangaplus') return getMPChapterPages(id!);
      if (feedSource === 'webtoon') return getWTChapterPages(id!);
      return getMDChapterPages(id!, dataSaver);
    },
    enabled: !!id,
  });

  const total = pages?.length ?? 0;

  const nextChapter = useMemo<MangaChapter | null>(() => {
    if (!id) return null;
    const tracked = queryClient.getQueriesData<MangaChapter[]>({ queryKey: ['tracking-chapters'] });
    const fallbacks = queryClient.getQueriesData<{ chapters: MangaChapter[] } | null>({
      queryKey: ['reading-fallback'],
    });
    const lists = [
      ...tracked.map(([, chapters]) => chapters),
      ...fallbacks.map(([, feed]) => feed?.chapters),
    ];
    for (const chapters of lists) {
      if (!chapters) continue;
      const readable = chapters.filter(ch => ch.isReadable !== false).sort(compareChapters);
      const index = readable.findIndex(ch => ch.id === id);
      if (index >= 0) return readable[index + 1] ?? null;
    }
    return null;
  }, [queryClient, id]);

  useEffect(() => {
    chapterIdRef.current = id;
    setFinished(false);
    setCurrentPage(1);
    setResumeVisible(false);
    if (savePositionTimer.current) clearTimeout(savePositionTimer.current);
  }, [id]);

  // Show resume banner once pages are loaded
  useEffect(() => {
    if (!id || !pages || pages.length === 0) return;
    const saved = getReadingPosition(id);
    if (saved && saved > 1 && saved <= pages.length) {
      setResumePage(saved);
      setResumeVisible(true);
      const t = setTimeout(() => setResumeVisible(false), 5000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pages?.length]);

  useEffect(() => {
    if (finished || total === 0 || currentPage < total) return;
    setFinished(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (id) clearReadingPosition(id);
    if (id && entryMangaId && source) {
      markChapterRead(entryMangaId, source, id, chapterNumber(chapter));
    }
  }, [currentPage, total, finished, id, chapter, entryMangaId, source, markChapterRead, clearReadingPosition]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find(v => v.isViewable && v.index != null);
      if (first?.index == null) return;
      const page = first.index + 1;
      setCurrentPage(page);
      // Debounce-save position (1.5s), skip page 1
      if (savePositionTimer.current) clearTimeout(savePositionTimer.current);
      if (page > 1) {
        savePositionTimer.current = setTimeout(() => {
          const cid = chapterIdRef.current;
          if (cid) useLibraryStore.getState().saveReadingPosition(cid, page);
        }, 1500);
      }
    },
  ).current;

  // viewAreaCoveragePercentThreshold: measures % of the VIEWPORT the item covers,
  // not % of the item that is visible. Tall webtoon/MangaPlus strips easily cover
  // 100 % of the viewport even though < 50 % of the strip itself is on screen.
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleResume = useCallback(() => {
    setResumeVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flatListRef.current?.scrollToIndex({ index: resumePage - 1, animated: false });
    setCurrentPage(resumePage);
  }, [resumePage]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleNext = useCallback(() => {
    if (!nextChapter) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace(
      `/reader/${encodeURIComponent(nextChapter.id)}?chapter=${encodeURIComponent(nextChapter.chapter ?? '')}&title=${encodeURIComponent(nextChapter.title ?? '')}&entryMangaId=${encodeURIComponent(entryMangaId ?? '')}&source=${encodeURIComponent(source ?? '')}&pagesSource=${encodeURIComponent(feedSource ?? '')}&mangaTitle=${encodeURIComponent(mangaTitle ?? '')}` as never,
    );
  }, [nextChapter, router, entryMangaId, source, feedSource, mangaTitle]);

  if (isLoading) return <ReaderMessage loading onBack={handleBack} />;
  if (isError || !pages || pages.length === 0) {
    return <ReaderMessage loading={false} onBack={handleBack} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden />
      <FlatList
        ref={flatListRef}
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
        offline={localPages != null}
        onBack={handleBack}
      />

      <ChapterEndBanner
        visible={finished}
        nextChapter={nextChapter}
        onNext={handleNext}
        onBack={handleBack}
      />

      <ResumeBanner
        page={resumePage}
        visible={resumeVisible && !finished}
        onResume={handleResume}
        onDismiss={() => setResumeVisible(false)}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
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
  resumeWrap: {
    position: 'absolute',
    left: SPACING.base,
    right: SPACING.base,
    alignItems: 'center',
    zIndex: 20,
  },
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.ink,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.lineOnInk,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    maxWidth: 380,
  },
  resumeText: { flex: 1 },
  resumeBtn: {
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 1,
  },
  resumeBtnLabel: { letterSpacing: 0.8, lineHeight: 14 },
}));
