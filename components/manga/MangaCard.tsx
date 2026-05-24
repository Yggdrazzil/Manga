import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
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
    >
      <View style={[styles.imageWrap, { height: imageHeight, borderRadius: RADIUS.md }]}>
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
        variant="bodyBold"
        numberOfLines={2}
        style={styles.title}
      >
        {displayTitle}
      </Typography>
      {manga.year && (
        <Typography variant="label" style={styles.meta}>
          {manga.year}
        </Typography>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceRaised,
  },
  scoreWrap: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
  },
  scoreBadge: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  score: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: '#FCD34D',
    lineHeight: 16,
  },
  typeBadgeWrap: {
    position: 'absolute',
    bottom: SPACING.xs,
    left: SPACING.xs,
  },
  title: {
    marginTop: SPACING.sm,
    fontSize: 13,
    lineHeight: 17,
    color: COLORS.text,
  },
  meta: {
    marginTop: 2,
    color: COLORS.textMuted,
  },
});
