import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BORDERS, COLORS, RADIUS, themedStyles } from '@/constants/theme';

interface GlassCardProps {
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  borderRadius?: number;
}

export function GlassCard({ style, children, borderRadius = RADIUS.lg }: GlassCardProps) {
  return <View style={[styles.card, { borderRadius }, style]}>{children}</View>;
}

const styles = themedStyles(() => StyleSheet.create({
  card: {
    backgroundColor: COLORS.paperRaised,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
  },
}));
