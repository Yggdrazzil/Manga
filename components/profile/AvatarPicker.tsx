import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getPopularCharacters, type CharacterAvatar } from '@/lib/api/anilist';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, RADIUS, SCRIMS, SPACING, themedStyles } from '@/constants/theme';

interface AvatarPickerProps {
  visible: boolean;
  current?: string;
  onSelect: (uri: string) => void;
  onClose: () => void;
}

const GUTTER = SPACING.md;
const H_PADDING = SPACING.base;

export function AvatarPicker({ visible, current, onSelect, onClose }: AvatarPickerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const { data: characters, isLoading, isError, refetch } = useQuery({
    queryKey: ['popular-characters'],
    queryFn: () => getPopularCharacters(48),
    enabled: visible,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const columns = Math.max(3, Math.floor((width - H_PADDING * 2 + GUTTER) / (96 + GUTTER)));
  const size = Math.floor((width - H_PADDING * 2 - GUTTER * (columns - 1)) / columns);

  const renderItem = ({ item, index }: { item: CharacterAvatar; index: number }) => {
    const selected = current === item.image;
    return (
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26, delay: Math.min(index, 12) * 30 }}
      >
        <Pressable
          style={[styles.avatarItem, { width: size }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onSelect(item.image);
            onClose();
          }}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={item.name}
        >
          <View
            style={[
              styles.avatarFrame,
              { width: size, height: size, borderRadius: size / 2 },
              selected && styles.avatarFrameSelected,
            ]}
          >
            <Image
              source={{ uri: item.image }}
              style={styles.avatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            {selected && (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark" size={16} color={COLORS.onInk} />
              </View>
            )}
          </View>
          <Typography variant="caption" color={COLORS.textInkMuted} numberOfLines={1} style={styles.avatarName}>
            {item.name}
          </Typography>
        </Pressable>
      </MotiView>
    );
  };

  return (
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <MotiView
        from={reduceMotion ? { translateY: 0, opacity: 1 } : { translateY: 80, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        style={[styles.sheet, { maxHeight: height * 0.82 }]}
      >
        <View style={styles.dragIndicator} />

        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.marker} />
            <Typography variant="title" color={COLORS.textInk}>Choisir un avatar</Typography>
          </View>
          <Typography variant="label" color={COLORS.textInkMuted}>
            Personnages emblématiques de mangas & animes
          </Typography>
        </View>

        {isLoading && (
          <View style={styles.stateBox}>
            <ActivityIndicator color={COLORS.accentRed} size="large" />
            <Typography variant="label" color={COLORS.textInkMuted}>Chargement des personnages…</Typography>
          </View>
        )}

        {isError && (
          <View style={styles.stateBox}>
            <Ionicons name="cloud-offline-outline" size={40} color={COLORS.textInkMuted} />
            <Typography variant="body" color={COLORS.textInkMuted} style={styles.stateText}>
              Impossible de charger les personnages.
            </Typography>
            <Pressable style={styles.retryBtn} onPress={() => refetch()} accessibilityRole="button">
              <Typography variant="kicker" color={COLORS.onInk} style={styles.retryText}>RÉESSAYER</Typography>
            </Pressable>
          </View>
        )}

        {characters && characters.length > 0 && (
          <FlatList
            key={columns}
            data={characters}
            renderItem={renderItem}
            keyExtractor={item => String(item.id)}
            numColumns={columns}
            columnWrapperStyle={styles.row}
            contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + SPACING.xl }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </MotiView>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SCRIMS.full,
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
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.md,
    gap: SPACING.xs,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  marker: { width: 4, height: 20, backgroundColor: COLORS.accentRed, borderRadius: 2 },
  stateBox: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.md,
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
  grid: { paddingHorizontal: H_PADDING, paddingBottom: SPACING.xxl, paddingTop: SPACING.xs },
  row: { gap: GUTTER, marginBottom: SPACING.md },
  avatarItem: { alignItems: 'center', gap: SPACING.xs },
  avatarFrame: {
    overflow: 'hidden',
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
  },
  avatarFrameSelected: {
    borderColor: COLORS.accentRed,
    borderWidth: BORDERS.heavy,
  },
  avatarImage: { width: '100%', height: '100%' },
  selectedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDERS.bold,
    borderColor: COLORS.paper,
  },
  avatarName: { fontSize: 10, textAlign: 'center', maxWidth: '100%' },
}));
