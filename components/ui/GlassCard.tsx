import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS, RADIUS } from '@/constants/theme';

interface GlassCardProps {
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  borderRadius?: number;
}

export function GlassCard({ intensity = 35, style, children, borderRadius = RADIUS.lg }: GlassCardProps) {
  const baseStyle = { borderRadius, overflow: 'hidden' as const };

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint="dark" style={[baseStyle, style]}>
        <View style={[styles.iosBorder, { borderRadius }]}>{children}</View>
      </BlurView>
    );
  }

  return <View style={[baseStyle, styles.android, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  iosBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  android: {
    backgroundColor: 'rgba(17, 18, 46, 0.88)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
});
