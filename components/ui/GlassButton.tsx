import * as Haptics from '@/lib/utils/haptics';
import React from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, themedStyles } from '@/constants/theme';
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
    scale.value = withSpring(0.97, { stiffness: 600, damping: 25 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
  };

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const textColor = variant === 'primary' ? COLORS.onInk : COLORS.textInk;

  return (
    <AnimatedPressable
      style={[animatedStyle, styles.base, styles[variant], styles[size], disabled && styles.disabled, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      {...rest}
    >
      {icon}
      <Typography variant="heading" color={textColor} style={styles.label}>
        {label}
      </Typography>
    </AnimatedPressable>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  primary: {
    backgroundColor: COLORS.accentRed,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
  },
  ghost: {
    backgroundColor: COLORS.accentSoft,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.accentRed,
  },
  sm: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, height: 36 },
  md: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, height: 44 },
  lg: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.base, height: 52 },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: FONTS.heading,
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
}));
