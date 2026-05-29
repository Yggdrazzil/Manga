import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BORDERS, COLORS, HARD_SHADOW, RADIUS } from '@/constants/theme';

interface PanelProps {
  variant?: 'paper' | 'ink' | 'outline';
  bordered?: boolean;
  hardShadow?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Panel({
  variant = 'paper',
  bordered = true,
  hardShadow = false,
  radius = RADIUS.lg,
  style,
  children,
}: PanelProps) {
  const backgroundColor =
    variant === 'paper'
      ? COLORS.paperRaised
      : variant === 'ink'
        ? COLORS.ink
        : 'transparent';

  const borderColor = variant === 'ink' ? COLORS.lineOnInk : COLORS.ink;
  const showBorder = variant === 'outline' ? true : bordered;

  const panelStyle: ViewStyle = {
    backgroundColor,
    borderRadius: radius,
    ...(showBorder ? { borderWidth: BORDERS.bold, borderColor } : null),
  };

  // The hard shadow needs to overflow the container, so we don't clip it.
  // When shadowed, the inner view carries overflow:hidden instead.
  if (hardShadow) {
    return (
      <View style={[{ borderRadius: radius }, HARD_SHADOW, style]}>
        <View style={[panelStyle, styles.clip]}>{children}</View>
      </View>
    );
  }

  return <View style={[panelStyle, styles.clip, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
