import React from 'react';
import { Text, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { COLORS, FONTS } from '@/constants/theme';

interface TypographyProps extends TextProps {
  variant?: 'display' | 'heading' | 'subheading' | 'body' | 'bodyBold' | 'caption' | 'label';
  color?: string;
  style?: StyleProp<TextStyle>;
}

const variantStyles: Record<NonNullable<TypographyProps['variant']>, TextStyle> = {
  display: {
    fontFamily: FONTS.display,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: 1,
    color: COLORS.text,
  },
  heading: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: COLORS.text,
  },
  subheading: {
    fontFamily: FONTS.headingMedium,
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.text,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },
  bodyBold: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },
  caption: {
    fontFamily: FONTS.body,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
  },
  label: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
};

export function Typography({ variant = 'body', color, style, children, ...rest }: TypographyProps) {
  return (
    <Text
      style={[variantStyles[variant], color ? { color } : undefined, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}
