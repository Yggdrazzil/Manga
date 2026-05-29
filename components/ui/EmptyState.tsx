import { MotiView } from 'moti';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BORDERS, COLORS, RADIUS, SPACING } from '@/constants/theme';
import { Halftone } from './Halftone';
import { Typography } from './Typography';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 100 }}
      style={styles.container}
    >
      <View style={styles.iconWrap}>
        <Halftone opacity={0.12} color={COLORS.onInk} />
        <Typography style={styles.emoji}>{icon}</Typography>
      </View>
      <Typography variant="title" style={styles.title}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body" style={styles.subtitle}>
          {subtitle}
        </Typography>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.xxl,
    backgroundColor: COLORS.ink,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  emoji: { fontSize: 40, lineHeight: 46 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', maxWidth: 280 },
  action: { marginTop: SPACING.md },
});
