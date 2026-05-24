import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getMangaChapters } from '@/lib/api/mangadex';
import { useLibraryStore } from '@/lib/store/library';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Typography } from '@/components/ui/Typography';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import type { MangaChapter } from '@/lib/types';

interface ChapterListProps {
  mangadexId: string;
  entryMangaId: string;
  source: string;
}

function ChapterSkeleton() {
  return (
    <View style={styles.skeletonRow}>
      <Skeleton width={24} height={24} borderRadius={12} />
      <View style={styles.skeletonContent}>
        <Skeleton width={80} height={14} />
        <Skeleton width={140} height={11} style={{ marginTop: 4 }} />
      </View>
      <Skeleton width={36} height={11} />
    </View>
  );
}

function ChapterRow({
  chapter,
  isRead,
  onToggle,
  index,
}: {
  chapter: MangaChapter;
  isRead: boolean;
  onToggle: () => void;
  index: number;
}) {
  const timeAgo = formatDistanceToNow(parseISO(chapter.publishAt), {
    addSuffix: true,
    locale: fr,
  });

  return (
    <MotiView
      from={{ opacity: 0, translateX: -8 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: Math.min(index * 30, 300) }}
    >
      <Pressable
        style={({ pressed }) => [styles.chapterRow, pressed && styles.chapterRowPressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle();
        }}
        accessibilityLabel={`Chapitre ${chapter.chapter}${isRead ? ', lu' : ', non lu'}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isRead }}
      >
        <View style={styles.checkCircle}>
          <Ionicons
            name={isRead ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isRead ? COLORS.accent : COLORS.textMuted}
          />
        </View>

        <View style={styles.chapterInfo}>
          <Typography variant="bodyBold" style={[styles.chapterNum, isRead && styles.chapterNumRead]}>
            Ch.{chapter.chapter}
            {chapter.volume ? ` · Vol.${chapter.volume}` : ''}
          </Typography>
          {chapter.title ? (
            <Typography variant="label" numberOfLines={1} style={styles.chapterTitle}>
              {chapter.title}
            </Typography>
          ) : null}
          <Typography variant="caption" style={styles.chapterDate}>{timeAgo}</Typography>
        </View>

        <View style={styles.pagesBadge}>
          <Typography variant="caption" style={styles.pagesText}>
            {chapter.pages}p
          </Typography>
        </View>
      </Pressable>
    </MotiView>
  );
}

export function ChapterList({ mangadexId, entryMangaId, source }: ChapterListProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['chapters', mangadexId, page],
    queryFn: () => getMangaChapters(mangadexId, { page, perPage: 100 }),
    staleTime: 1000 * 60 * 5,
  });

  const entry = useLibraryStore(s => s.entries.find(e => e.mangaId === entryMangaId && e.source === source));
  const toggleChapterRead = useLibraryStore(s => s.toggleChapterRead);

  const readChapterIds = entry?.readChapterIds ?? [];
  const currentProgress = entry?.progress ?? 0;

  const isChapterRead = (ch: MangaChapter): boolean => {
    if (readChapterIds.includes(ch.id)) return true;
    if (readChapterIds.length === 0 && parseFloat(ch.chapter) <= currentProgress) return true;
    return false;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="heading" style={styles.heading}>Chapitres</Typography>
        {data && (
          <View style={styles.headerMeta}>
            <Typography variant="caption">
              {data.chapters.length} / {data.total}
            </Typography>
          </View>
        )}
      </View>

      {isLoading && (
        <GlassCard style={styles.card}>
          <View style={styles.cardInner}>
            <ChapterSkeleton />
            <View style={styles.divider} />
            <ChapterSkeleton />
            <View style={styles.divider} />
            <ChapterSkeleton />
          </View>
        </GlassCard>
      )}

      {isError && (
        <EmptyState
          icon="📭"
          title="Impossible de charger les chapitres"
          subtitle="Vérifiez votre connexion et réessayez."
        />
      )}

      {!isLoading && !isError && data && data.chapters.length === 0 && (
        <EmptyState
          icon="📖"
          title="Aucun chapitre disponible"
          subtitle="Les chapitres n'ont pas encore été importés sur MangaDex."
        />
      )}

      {!isLoading && !isError && data && data.chapters.length > 0 && (
        <GlassCard style={styles.card}>
          <View style={styles.cardInner}>
            {data.chapters.map((ch, i) => (
              <View key={ch.id}>
                {i > 0 && <View style={styles.divider} />}
                <ChapterRow
                  chapter={ch}
                  isRead={isChapterRead(ch)}
                  onToggle={() =>
                    toggleChapterRead(entryMangaId, source, ch.id, parseFloat(ch.chapter))
                  }
                  index={i}
                />
              </View>
            ))}
          </View>
        </GlassCard>
      )}

      {data && (page > 1 || data.hasNext) && (
        <View style={styles.pagination}>
          {page > 1 && (
            <Pressable
              style={styles.pageBtn}
              onPress={() => {
                Haptics.selectionAsync();
                setPage(p => p - 1);
              }}
              accessibilityLabel="Page précédente"
            >
              <Ionicons name="chevron-back" size={16} color={COLORS.accentLight} />
              <Typography variant="label" color={COLORS.accentLight}>Précédent</Typography>
            </Pressable>
          )}
          <Typography variant="caption" style={styles.pageLabel}>
            Page {page}
          </Typography>
          {data.hasNext && (
            <Pressable
              style={styles.pageBtn}
              onPress={() => {
                Haptics.selectionAsync();
                setPage(p => p + 1);
              }}
              accessibilityLabel="Page suivante"
            >
              <Typography variant="label" color={COLORS.accentLight}>Suivant</Typography>
              <Ionicons name="chevron-forward" size={16} color={COLORS.accentLight} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { fontSize: 18 },
  headerMeta: {
    backgroundColor: COLORS.surfaceRaised,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  card: { borderRadius: RADIUS.xl },
  cardInner: { paddingVertical: SPACING.xs },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
  },
  skeletonContent: { flex: 1 },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.base,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
  },
  chapterRowPressed: { opacity: 0.65 },
  checkCircle: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterInfo: { flex: 1, gap: 2 },
  chapterNum: { fontSize: 14 },
  chapterNumRead: { color: COLORS.textMuted },
  chapterTitle: { color: COLORS.textMuted, fontSize: 12 },
  chapterDate: { marginTop: 2, color: COLORS.textMuted, fontSize: 10 },
  pagesBadge: {
    backgroundColor: COLORS.surfaceRaised,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  pagesText: { color: COLORS.textMuted, fontSize: 10 },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.accentMuted,
    borderRadius: RADIUS.full,
  },
  pageLabel: { color: COLORS.textMuted },
});
