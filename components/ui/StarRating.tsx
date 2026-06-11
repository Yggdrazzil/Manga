import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS, SPACING } from '@/constants/theme';
import { Typography } from './Typography';

interface StarRatingProps {
  /** 0–100 score (0 = unrated). Maps to 1–5 stars (each star = 20 pts). */
  score?: number;
  onRate?: (newScore: number) => void;
  size?: number;
  readonly?: boolean;
  showLabel?: boolean;
}

const STARS = [1, 2, 3, 4, 5] as const;

export function StarRating({
  score,
  onRate,
  size = 28,
  readonly = false,
  showLabel = true,
}: StarRatingProps) {
  const filled = score ? Math.round(score / 20) : 0;

  const handlePress = (star: number) => {
    if (readonly || !onRate) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Tapping the same filled star clears the rating
    onRate(filled === star ? 0 : star * 20);
  };

  return (
    <View style={styles.row}>
      <View style={styles.stars}>
        {STARS.map(star => (
          <Pressable
            key={star}
            onPress={() => handlePress(star)}
            hitSlop={6}
            accessibilityRole={readonly ? 'image' : 'button'}
            accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''} sur 5`}
            accessibilityState={readonly ? undefined : { selected: star === filled }}
            disabled={readonly}
          >
            <Ionicons
              name={star <= filled ? 'star' : 'star-outline'}
              size={size}
              color={star <= filled ? COLORS.star : COLORS.textInkMuted}
            />
          </Pressable>
        ))}
      </View>
      {showLabel && filled > 0 && (
        <Typography variant="label" color={COLORS.star} style={styles.label}>
          {filled}/5
        </Typography>
      )}
      {showLabel && filled === 0 && !readonly && (
        <Typography variant="label" color={COLORS.textInkMuted} style={styles.label}>
          Non noté
        </Typography>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  stars: { flexDirection: 'row', gap: 4 },
  label: { fontSize: 13 },
});
