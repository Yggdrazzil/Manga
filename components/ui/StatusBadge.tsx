import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, RADIUS, SPACING, themedStyles } from '@/constants/theme';
import { STATUS_LABELS } from '@/constants/theme';
import type { ReadingStatus } from '@/lib/types';
import { Typography } from './Typography';

// Function, not module const: COLORS values change with the active theme.
const statusColor = (s: ReadingStatus): string =>
  ({
    READING: COLORS.statusReading,
    COMPLETED: COLORS.statusCompleted,
    PLAN_TO_READ: COLORS.statusPlan,
    DROPPED: COLORS.statusDropped,
    PAUSED: COLORS.statusPaused,
  })[s];

interface StatusBadgeProps {
  status: ReadingStatus;
  compact?: boolean;
}

export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const color = statusColor(status);
  return (
    // En mode compact le statut n'est plus qu'une pastille de couleur : sans
    // libellé accessible, il est invisible pour un lecteur d'écran — et pour
    // qui distingue mal les couleurs.
    <View
      style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={STATUS_LABELS[status]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      {!compact && (
        <Typography variant="label" color={color} style={styles.text}>
          {STATUS_LABELS[status]}
        </Typography>
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: { fontWeight: '600' },
}));
