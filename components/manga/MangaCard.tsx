import * as Haptics from '@/lib/utils/haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, inkScrim, themedStyles } from '@/constants/theme';
import type { Manga } from '@/lib/types';
import { TypeBadge } from '../ui/TypeBadge';
import { Typography } from '../ui/Typography';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface MangaCardProps {
  manga: Manga;
  width?: number;
}

export function MangaCard({ manga, width = 120 }: MangaCardProps) {
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/manga/${manga.id}?source=${manga.source}`);
  };

  const imageHeight = Math.round(width * 1.42);
  const displayTitle = manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred;

  return (
    <AnimatedPressable
      style={[animatedStyle, { width }]}
      onPressIn={() => { scale.value = withSpring(0.95, { stiffness: 500, damping: 22 }); }}
      onPressOut={() => { scale.value = withSpring(1, { stiffness: 400, damping: 20 }); }}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={displayTitle}
    >
      <View style={[styles.imageFrame, { height: imageHeight }]}>
        <Image
          source={{ uri: manga.coverImage }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
          placeholder={{ blurhash: 'LKO2?V%2Tw=w]~RBVZRi};RPxuwH' }}
        />
        <View style={styles.scoreWrap}>
          {manga.averageScore && (
            <View style={styles.scoreBadge}>
              <Typography style={styles.score}>
                ★ {(manga.averageScore / 10).toFixed(1)}
              </Typography>
            </View>
          )}
        </View>
        <View style={styles.typeBadgeWrap}>
          <TypeBadge type={manga.type} />
        </View>
      </View>
      <Typography
        variant="label"
        numberOfLines={2}
        color={COLORS.textInk}
        style={styles.title}
      >
        {displayTitle}
      </Typography>
      {manga.year && (
        <Typography variant="caption" color={COLORS.textInkMuted} style={styles.meta}>
          {manga.year}
        </Typography>
      )}
    </AnimatedPressable>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  imageFrame: {
    overflow: 'hidden',
    backgroundColor: COLORS.paperSunken,
    borderRadius: RADIUS.md,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
  },
  scoreWrap: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
  },
  scoreBadge: {
    backgroundColor: inkScrim(0.82),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  score: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.star,
    lineHeight: 16,
  },
  typeBadgeWrap: {
    position: 'absolute',
    bottom: SPACING.xs,
    left: SPACING.xs,
  },
  title: {
    marginTop: SPACING.sm,
    fontSize: 12,
    lineHeight: 16,
  },
  meta: {
    marginTop: 2,
    fontSize: 10,
    letterSpacing: 0,
    textTransform: 'none',
  },
}));
