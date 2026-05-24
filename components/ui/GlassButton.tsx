import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { Typography } from './Typography';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface GlassButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export function GlassButton({
  label,
  variant = 'primary',
  size = 'md',
  style,
  icon,
  onPress,
  disabled,
  ...rest
}: GlassButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { stiffness: 600, damping: 25 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
  };

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  return (
    <AnimatedPressable
      style={[animatedStyle, styles.base, styles[variant], styles[size], disabled && styles.disabled, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      {...rest}
    >
      {icon}
      <Typography
        variant="bodyBold"
        color={variant === 'primary' ? '#fff' : COLORS.text}
        style={styles.label}
      >
        {label}
      </Typography>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: COLORS.accent,
  },
  secondary: {
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ghost: {
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: `${COLORS.accent}44`,
  },
  sm: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, height: 36 },
  md: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, height: 44 },
  lg: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.base, height: 52 },
  disabled: { opacity: 0.4 },
  label: { fontFamily: FONTS.bodyBold, letterSpacing: 0.2 },
});
