import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, RADIUS, SPACING, themedStyles } from '@/constants/theme';
import { TYPE_LABELS } from '@/constants/theme';
import type { MediaType } from '@/lib/types';
import { Typography } from './Typography';

// Function, not module const: COLORS values change with the active theme.
const typeColor = (t: MediaType): string =>
  ({
    MANGA: COLORS.typeMANGA,
    MANHWA: COLORS.typeMANHWA,
    MANHUA: COLORS.typeMANHUA,
    WEBTOON: COLORS.typeWEBTOON,
    BD: COLORS.typeBD,
  })[t];

interface TypeBadgeProps {
  type: MediaType;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  const color = typeColor(type);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      <Typography variant="label" color={color} style={styles.text}>
        {TYPE_LABELS[type]}
      </Typography>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  text: { fontWeight: '700', fontSize: 10 },
}));
