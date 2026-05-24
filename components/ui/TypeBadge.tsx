import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { TYPE_LABELS } from '@/constants/theme';
import type { MediaType } from '@/lib/types';
import { Typography } from './Typography';

const TYPE_COLORS: Record<MediaType, string> = {
  MANGA: COLORS.typeMANGA,
  MANHWA: COLORS.typeMANHWA,
  MANHUA: COLORS.typeMANHUA,
  WEBTOON: COLORS.typeWEBTOON,
  BD: COLORS.typeBD,
};

interface TypeBadgeProps {
  type: MediaType;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  const color = TYPE_COLORS[type];
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      <Typography variant="label" color={color} style={styles.text}>
        {TYPE_LABELS[type]}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  text: { fontWeight: '700', fontSize: 10 },
});
