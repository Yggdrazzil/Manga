import { MotiView } from 'moti';
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS, RADIUS, themedStyles } from '@/constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = RADIUS.sm, style }: SkeletonProps) {
  return (
    <MotiView
      from={{ opacity: 0.4 }}
      animate={{ opacity: 0.8 }}
      transition={{ type: 'timing', duration: 900, loop: true }}
      style={[{ width: width as number, height, borderRadius, backgroundColor: COLORS.paperSunken }, style]}
    />
  );
}

export function MangaCardSkeleton() {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 300 }}
      style={styles.card}
    >
      <Skeleton width={120} height={168} borderRadius={RADIUS.md} />
      <Skeleton width={100} height={12} style={styles.mt8} />
      <Skeleton width={70} height={10} style={styles.mt4} />
    </MotiView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { width: 120, marginRight: 12 },
  mt8: { marginTop: 8 },
  mt4: { marginTop: 4 },
}));
