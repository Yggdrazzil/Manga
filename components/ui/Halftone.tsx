import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { COLORS } from '@/constants/theme';

interface HalftoneProps {
  opacity?: number;
  dotRadius?: number;
  gap?: number;
  color?: string;
}

export function Halftone({
  opacity = 0.06,
  dotRadius = 1.4,
  gap = 10,
  color = COLORS.halftone,
}: HalftoneProps) {
  return (
    <Svg
      style={[StyleSheet.absoluteFillObject, { opacity }]}
      pointerEvents="none"
      width="100%"
      height="100%"
    >
      <Defs>
        <Pattern
          id="halftone"
          patternUnits="userSpaceOnUse"
          width={gap}
          height={gap}
        >
          <Circle cx={gap / 2} cy={gap / 2} r={dotRadius} fill={color} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#halftone)" />
    </Svg>
  );
}
