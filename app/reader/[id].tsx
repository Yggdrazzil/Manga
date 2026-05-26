import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MotiView } from 'moti';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image as RNImage,
  Pressable,
  StyleSheet,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getChapterPages } from '@/lib/api/mangadex';
import { useLibraryStore } from '@/lib/store/library';
import { Typography } from '@/components/ui/Typography';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PLACEHOLDER_HEIGHT = SCREEN_WIDTH * 1.4;

function ReaderPage({ uri, onTap }: { uri: string; onTap: () => void }) {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    RNImage.getSize(
      uri,
      (w, h) => {
        if (active && h > 0) setRatio(w / h);
      },
      () => {
        if (active) setRatio(null);
      },
    );
    return () => {
      active = false;
    };
  }, [uri]);

  return (
    <Pressable onPress={onTap}>
      <ExpoImage
        source={{ uri }}
        style={{
          width: SCREEN_WIDTH,
          height: ratio ? SCREEN_WIDTH / ratio : PLACEHOLDER_HEIGHT,
          backgroundColor: '#000',
        }}
        contentFit="contain"
        transition={220}
        cachePolicy="memory-disk"
      />
    </Pressable>
  );
}

function ReaderChrome({
  mangaTitle,
  chapter,
  title,
  current,
  total,
  visible,
  onBack,
}: {
  mangaTitle: string;
  chapter: string;
  title?: string;
  current: number;
  total: number;
  visible: boolean;
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
          colors={['rgba(0,0,0,0.85)', 'transparent']}
          style={[styles.topGradient, { paddingTop: insets.top + SPACING.sm }]}
        >
          <Pressable
            style={styles.backBtn}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Fermer le lecteur"
            hitSlop={8}
          >
            <Ionicons name="chevron-down" size={22} color={COLORS.text} />
          </Pressable>
          <View style={styles.topInfo}>
            <Typography variant="bodyBold" numberOfLines={1} style={styles.topTitle}>
              {mangaTitle}
            </Typography>
            <Typography variant="label" numberOfLines={1} color={COLORS.textSecondary}>
              Ch.{chapter}
              {title ? ` · ${title}` : ''}
            </Typography>
          </View>
        </LinearGradient>
      </MotiView>

      <MotiView
        pointerEvents="none"
        animate={{ opacity: visible ? 1 : 0, translateY: visible ? 0 : 16 }}
        transition={{ type: 'timing', duration: 200 }}
        style={[styles.pageIndicatorWrap, { bottom: insets.bottom + SPACING.lg }]}
      >
        <View style={styles.pageIndicator}>
          <Typography variant="label" color="#fff" style={styles.pageIndicatorText}>
            {Math.min(current, total)} / {total}
          </Typography>
        </View>
      </MotiView>
    </>
  );
}

function ReaderMessage({
  loading,
  onBack,
}: {
  loading: boolean;
  onBack: () => void;
}) {
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
        <Ionicons name="chevron-down" size={22} color={COLORS.text} />
      </Pressable>
      {loading ? (
        <>
          <ActivityIndicator color={COLORS.accent} size="large" />
          <Typography variant="body" color={COLORS.textSecondary} style={styles.messageText}>
            Chargement du chapitre…
          </Typography>
        </>
      ) : (
        <>
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.textMuted} />
          <Typography variant="heading" style={styles.messageHeading}>
            Impossible de charger ce chapitre
          </Typography>
          <Pressable style={styles.retryBtn} onPress={onBack}>
            <Typography variant="bodyBold" color={COLORS.accentLight}>
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
  const { id, chapter, title, entryMangaId, source, mangaTitle } = useLocalSearchParams<{
    id: string;
    chapter: string;
    title?: string;
    entryMangaId: string;
    source: string;
    mangaTitle?: string;
  }>();

  const [chromeVisible, setChromeVisible] = useState(true);
  const toggleChrome = useCallback(() => setChromeVisible(v => !v), []);
  const [currentPage, setCurrentPage] = useState(1);
  const hasMarkedRead = useRef(false);

  const toggleChapterRead = useLibraryStore(s => s.toggleChapterRead);
  const getEntry = useLibraryStore(s => s.getEntry);

  const { data: pages, isLoading, isError } = useQuery({
    queryKey: ['chapter-pages', id],
    queryFn: () => getChapterPages(id),
    enabled: !!id,
  });

  const total = pages?.length ?? 0;

  const markReadIfDone = useCallback(() => {
    if (hasMarkedRead.current || !entryMangaId || !source || !chapter) return;
    const entry = getEntry(entryMangaId, source);
    const alreadyRead = entry?.readChapterIds?.includes(id) ?? false;
    hasMarkedRead.current = true;
    if (!alreadyRead) {
      toggleChapterRead(entryMangaId, source, id, parseFloat(chapter));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [entryMangaId, source, chapter, id, getEntry, toggleChapterRead]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const last = viewableItems[viewableItems.length - 1];
      if (last?.index != null) setCurrentPage(last.index + 1);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 }).current;

  useEffect(() => {
    if (total > 0 && currentPage >= total) markReadIfDone();
  }, [currentPage, total, markReadIfDone]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

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
        renderItem={({ item }) => <ReaderPage uri={item} onTap={toggleChrome} />}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReachedThreshold={0.1}
        onEndReached={markReadIfDone}
        windowSize={5}
        removeClippedSubviews
      />

      <ReaderChrome
        mangaTitle={mangaTitle ?? 'Lecture'}
        chapter={chapter ?? ''}
        title={title}
        current={currentPage}
        total={total}
        visible={chromeVisible}
        onBack={handleBack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
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
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: `${COLORS.accent}66`,
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
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
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
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  pageIndicatorText: {
    fontFamily: FONTS.bodyBold,
    letterSpacing: 1,
  },
});
