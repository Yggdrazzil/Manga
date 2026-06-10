import React from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { COLORS, FONTS } from '@/constants/theme';

type TypographyVariant =
  | 'hero'
  | 'title'
  | 'display'
  | 'kicker'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyBold'
  | 'label'
  | 'caption';

interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
}

// Function, not module const: COLORS values change with the active theme.
const getVariantStyles = (): Record<TypographyVariant, TextStyle> => ({
  hero: {
    fontFamily: FONTS.serifBlack,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: COLORS.textInk,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: COLORS.textInk,
  },
  display: {
    fontFamily: FONTS.display,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: 1,
    color: COLORS.textInk,
  },
  kicker: {
    fontFamily: FONTS.display,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.accentRed,
  },
  heading: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: COLORS.textInk,
  },
  subheading: {
    fontFamily: FONTS.headingMedium,
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.textInk,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.textInkSoft,
  },
  bodyBold: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textInk,
  },
  label: {
    fontFamily: FONTS.headingMedium,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textInkMuted,
  },
  caption: {
    fontFamily: FONTS.headingMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.textInkFaint,
  },
});

export function Typography({ variant = 'body', color, style, children, ...rest }: TypographyProps) {
  return (
    <Text style={[getVariantStyles()[variant], color ? { color } : undefined, style]} {...rest}>
      {children}
    </Text>
  );
}
