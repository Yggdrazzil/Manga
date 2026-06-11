import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import { MotiView } from 'moti';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
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
  const reduceMotion = useReducedMotion();
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
        {STARS.map(star => {
          const isFilled = star <= filled;
          return (
            <Pressable
              key={star}
              onPress={() => handlePress(star)}
              hitSlop={6}
              accessibilityRole={readonly ? 'image' : 'button'}
              accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''} sur 5`}
              accessibilityState={readonly ? undefined : { selected: star === filled }}
              disabled={readonly}
            >
              {/* Remounts when the star flips filled/empty → cascading pop */}
              <MotiView
                key={`${star}-${isFilled}`}
                from={reduceMotion || !isFilled ? { scale: 1 } : { scale: 0.3 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 520,
                  damping: 16,
                  delay: reduceMotion ? 0 : (star - 1) * 40,
                }}
              >
                <Ionicons
                  name={isFilled ? 'star' : 'star-outline'}
                  size={size}
                  color={isFilled ? COLORS.star : COLORS.textInkMuted}
                />
              </MotiView>
            </Pressable>
          );
        })}
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
