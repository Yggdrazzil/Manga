import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getPopularBanners } from '@/lib/api/anilist';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, RADIUS, SPACING } from '@/constants/theme';
import type { LibraryEntry } from '@/lib/types';

interface BannerPickerProps {
  visible: boolean;
  current?: string;
  entries: LibraryEntry[];
  onSelect: (uri: string) => void;
  onClose: () => void;
}

const CARD_RATIO = 16 / 7;
const H_PAD = SPACING.base;

function BannerCard({
  uri,
  title,
  selected,
  index,
  cardWidth,
  onPress,
}: {
  uri: string;
  title: string;
  selected: boolean;
  index: number;
  cardWidth: number;
  onPress: () => void;
}) {
  const cardHeight = cardWidth / CARD_RATIO;
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: Math.min(index, 10) * 40 }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { width: cardWidth, height: cardHeight },
          selected && styles.cardSelected,
          pressed && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Fond : ${title}`}
      >
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={['transparent', 'rgba(22,19,14,0.72)']}
          style={styles.cardGradient}
        />
        <View style={styles.cardFooter}>
          <Typography variant="label" color={COLORS.onInk} numberOfLines={1} style={styles.cardTitle}>
            {title}
          </Typography>
        </View>
        {selected && (
          <View style={styles.selectedBadge}>
            <Ionicons name="checkmark" size={14} color={COLORS.onInk} />
          </View>
        )}
      </Pressable>
    </MotiView>
  );
}

export function BannerPicker({ visible, current, entries, onSelect, onClose }: BannerPickerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = width - H_PAD * 2;

  const { data: popularBanners, isLoading, isError, refetch } = useQuery({
    queryKey: ['popular-banners'],
    queryFn: () => getPopularBanners(40),
    enabled: visible,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const libraryBanners = entries
    .map(e => ({
      id: `lib-${e.mangaId}`,
      title: e.manga.title.english ?? e.manga.title.romaji ?? e.manga.title.userPreferred,
      uri: e.manga.bannerImage ?? e.manga.coverImage,
    }))
    .filter((b, i, arr) => b.uri && arr.findIndex(x => x.uri === b.uri) === i);

  const handleSelect = (uri: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(uri);
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={[styles.sheet, { maxHeight: height * 0.88 }]}>
        <View style={styles.dragIndicator} />

        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.marker} />
            <Typography variant="title" color={COLORS.textInk}>Choisir un fond</Typography>
          </View>
          <Typography variant="label" color={COLORS.textInkMuted}>
            Arrière-plans de mangas et animes
          </Typography>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xl }]}
        >
          {libraryBanners.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="library-outline" size={14} color={COLORS.accentRed} />
                <Typography variant="kicker" color={COLORS.accentRed} style={styles.sectionLabel}>
                  MA BIBLIOTHÈQUE
                </Typography>
              </View>
              <View style={styles.cardsList}>
                {libraryBanners.map((b, i) => (
                  <BannerCard
                    key={b.id}
                    uri={b.uri}
                    title={b.title}
                    selected={current === b.uri}
                    index={i}
                    cardWidth={cardWidth}
                    onPress={() => handleSelect(b.uri)}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="flame-outline" size={14} color={COLORS.accentRed} />
              <Typography variant="kicker" color={COLORS.accentRed} style={styles.sectionLabel}>
                MONDES POPULAIRES
              </Typography>
            </View>

            {isLoading && (
              <View style={styles.stateBox}>
                <ActivityIndicator color={COLORS.accentRed} size="large" />
                <Typography variant="label" color={COLORS.textInkMuted}>Chargement…</Typography>
              </View>
            )}

            {isError && (
              <View style={styles.stateBox}>
                <Ionicons name="cloud-offline-outline" size={36} color={COLORS.textInkMuted} />
                <Typography variant="body" color={COLORS.textInkMuted} style={styles.stateText}>
                  Impossible de charger les fonds.
                </Typography>
                <Pressable style={styles.retryBtn} onPress={() => refetch()} accessibilityRole="button">
                  <Typography variant="kicker" color={COLORS.onInk} style={styles.retryText}>RÉESSAYER</Typography>
                </Pressable>
              </View>
            )}

            {popularBanners && popularBanners.length > 0 && (
              <View style={styles.cardsList}>
                {popularBanners.map((b, i) => (
                  <BannerCard
                    key={b.id}
                    uri={b.uri}
                    title={b.title}
                    selected={current === b.uri}
                    index={i + (libraryBanners.length)}
                    cardWidth={cardWidth}
                    onPress={() => handleSelect(b.uri)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22,19,14,0.92)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.paper,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    borderTopWidth: BORDERS.bold,
    borderLeftWidth: BORDERS.bold,
    borderRightWidth: BORDERS.bold,
    borderColor: COLORS.ink,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.lineStrong,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  header: {
    paddingHorizontal: H_PAD,
    paddingBottom: SPACING.md,
    gap: SPACING.xs,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  marker: { width: 4, height: 20, backgroundColor: COLORS.accentRed, borderRadius: 2 },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  section: {
    gap: SPACING.md,
    paddingTop: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: H_PAD,
  },
  sectionLabel: { letterSpacing: 1.5, fontSize: 10 },
  cardsList: {
    gap: SPACING.md,
    paddingHorizontal: H_PAD,
  },
  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.inkSoft,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
  },
  cardSelected: {
    borderColor: COLORS.accentRed,
    borderWidth: BORDERS.heavy,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  cardFooter: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.md,
    right: SPACING.lg,
  },
  cardTitle: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  selectedBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDERS.bold,
    borderColor: COLORS.paper,
  },
  stateBox: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: H_PAD,
  },
  stateText: { textAlign: 'center' },
  retryBtn: {
    backgroundColor: COLORS.accentRed,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.accentDeep,
  },
  retryText: { letterSpacing: 1.5 },
});
