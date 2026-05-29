import { MotiView } from 'moti';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { COLORS, SPACING } from '@/constants/theme';
import type { Manga } from '@/lib/types';
import { MangaCardSkeleton } from '../ui/Skeleton';
import { Typography } from '../ui/Typography';
import { MangaCard } from './MangaCard';

interface MediaRowProps {
  title: string;
  mangas: Manga[] | undefined;
  isLoading?: boolean;
  cardWidth?: number;
}

export function MediaRow({ title, mangas, isLoading, cardWidth = 120 }: MediaRowProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.marker} />
        <Typography variant="title" color={COLORS.textInk} style={styles.title}>
          {title}
        </Typography>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <MangaCardSkeleton key={i} />)
          : mangas?.map((manga, index) => (
              <MotiView
                key={`${manga.source}-${manga.id}`}
                from={{ opacity: 0, translateX: 20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 55 }}
              >
                <MangaCard manga={manga} width={cardWidth} />
              </MotiView>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: SPACING.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.md,
  },
  marker: {
    width: 4,
    height: 20,
    backgroundColor: COLORS.accentRed,
    borderRadius: 2,
  },
  title: {
    fontSize: 20,
  },
  scroll: {
    paddingHorizontal: SPACING.base,
    gap: SPACING.md,
  },
});
