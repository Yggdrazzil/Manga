import { MotiView } from 'moti';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, SPACING } from '@/constants/theme';
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
        <Typography style={styles.emoji}>{icon}</Typography>
      </View>
      <Typography variant="heading" style={styles.title}>{title}</Typography>
      {subtitle && (
        <Typography variant="body" style={styles.subtitle}>{subtitle}</Typography>
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emoji: { fontSize: 36, lineHeight: 42 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', color: COLORS.textMuted },
  action: { marginTop: SPACING.md },
});
