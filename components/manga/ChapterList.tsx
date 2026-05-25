import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getMangaChapters } from '@/lib/api/mangadex';
import { useLibraryStore } from '@/lib/store/library';
import { ChapterDetailSheet } from '@/components/manga/ChapterDetailSheet';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Typography } from '@/components/ui/Typography';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import type { Manga, MangaChapter } from '@/lib/types';

interface ChapterListProps {
  mangadexId: string;
  entryMangaId: string;
  source: string;
  manga: Manga;
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

function groupByVolume(chapters: MangaChapter[]): Map<string, MangaChapter[]> {
  const map = new Map<string, MangaChapter[]>();
  for (const ch of chapters) {
    const key = ch.volume ?? 'Hors volume';
    const existing = map.get(key) ?? [];
    existing.push(ch);
    map.set(key, existing);
  }
  return map;
}

function sortedVolumeKeys(map: Map<string, MangaChapter[]>): string[] {
  return Array.from(map.keys()).sort((a, b) => {
    if (a === 'Hors volume') return 1;
    if (b === 'Hors volume') return -1;
    return parseFloat(a) - parseFloat(b);
  });
}

export function ChapterList({ mangadexId, entryMangaId, source, manga }: ChapterListProps) {
  const [page, setPage] = useState(1);
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [selectedChapter, setSelectedChapter] = useState<MangaChapter | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['chapters', mangadexId, page],
    queryFn: () => getMangaChapters(mangadexId, { page, perPage: 100 }),
    staleTime: 1000 * 60 * 5,
  });

  const entry = useLibraryStore(s => s.entries.find(e => e.mangaId === entryMangaId && e.source === source));
  const toggleChapterRead = useLibraryStore(s => s.toggleChapterRead);
  const markVolumeRead = useLibraryStore(s => s.markVolumeRead);

  const isChapterRead = (ch: MangaChapter): boolean => {
    const ids = entry?.readChapterIds ?? [];
    if (ids.includes(ch.id)) return true;
    if (ids.length === 0 && parseFloat(ch.chapter) <= (entry?.progress ?? 0)) return true;
    return false;
  };

  const isVolumeFullyRead = (chapters: MangaChapter[]): boolean =>
    chapters.length > 0 && chapters.every(ch => isChapterRead(ch));

  const volumeReadCount = (chapters: MangaChapter[]): number =>
    chapters.filter(ch => isChapterRead(ch)).length;

  const sortedChapters = useMemo(() => {
    if (!data?.chapters) return [];
    return [...data.chapters].sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
  }, [data?.chapters]);

  const volumeMap = useMemo(() => groupByVolume(sortedChapters), [sortedChapters]);
  const volumeKeys = useMemo(() => sortedVolumeKeys(volumeMap), [volumeMap]);

  const nextChapter = useMemo(
    () => sortedChapters.find(ch => !isChapterRead(ch)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedChapters, entry?.readChapterIds, entry?.progress]
  );

  const firstExpandedVolume = useMemo(() => {
    if (!nextChapter) return null;
    return nextChapter.volume ?? 'Hors volume';
  }, [nextChapter]);

  const isVolumeExpanded = (vol: string) => {
    if (expandedVolumes.has(vol)) return true;
    if (!expandedVolumes.size && vol === firstExpandedVolume) return true;
    return false;
  };

  const toggleVolume = (vol: string) => {
    setExpandedVolumes(prev => {
      const next = new Set(prev);
      if (isVolumeExpanded(vol)) {
        next.add('__initialized__');
        next.delete(vol);
        volumeKeys.forEach(k => {
          if (k !== vol) next.delete(k);
        });
      } else {
        next.add(vol);
      }
      return next;
    });
  };

  const totalRead = useMemo(
    () => sortedChapters.filter(ch => isChapterRead(ch)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedChapters, entry?.readChapterIds, entry?.progress]
  );

  const allChapters = sortedChapters.map(ch => ({ id: ch.id, num: parseFloat(ch.chapter) }));

  const allRead = totalRead === sortedChapters.length && sortedChapters.length > 0;

  const finishDate = useMemo(() => {
    if (!allRead || !entry?.chapterData) return null;
    const dates = Object.values(entry.chapterData)
      .map(d => d.readAt)
      .filter(Boolean) as string[];
    if (!dates.length) return null;
    const latest = dates.sort().at(-1)!;
    try {
      return format(parseISO(latest), 'd MMM yyyy', { locale: fr });
    } catch {
      return null;
    }
  }, [allRead, entry?.chapterData]);

  return (
    <View style={styles.container}>
      {/* Continue card */}
      {entry && (
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        >
          {allRead ? (
            <GlassCard style={styles.continueCard}>
              <View style={styles.continueInner}>
                <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
                <View style={styles.continueCenter}>
                  <Typography variant="bodyBold" style={styles.allReadText}>Tout lu !</Typography>
                  {finishDate && (
                    <Typography variant="label" style={styles.allReadDate}>
                      Terminé le {finishDate}
                    </Typography>
                  )}
                </View>
              </View>
            </GlassCard>
          ) : nextChapter ? (
            <GlassCard style={styles.continueCard}>
              <View style={styles.continueInner}>
                <Image
                  source={{ uri: manga.coverImage }}
                  style={styles.continueCover}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <Pressable
                  style={styles.continueCenter}
                  onPress={() => setSelectedChapter(nextChapter)}
                  accessibilityLabel={`Ouvrir chapitre ${nextChapter.chapter}`}
                >
                  <Typography variant="bodyBold" style={styles.continueChapter}>
                    Chapitre {nextChapter.chapter}
                  </Typography>
                  {nextChapter.title ? (
                    <Typography variant="label" style={styles.continueTitle} numberOfLines={1}>
                      {nextChapter.title}
                    </Typography>
                  ) : null}
                  {nextChapter.volume ? (
                    <Typography variant="caption">Vol.{nextChapter.volume}</Typography>
                  ) : null}
                </Pressable>
                <Pressable
                  style={styles.playBtn}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    toggleChapterRead(entryMangaId, source, nextChapter.id, parseFloat(nextChapter.chapter));
                  }}
                  accessibilityLabel="Marquer comme lu"
                  accessibilityRole="button"
                >
                  <Ionicons name="play" size={18} color={COLORS.accentLight} />
                </Pressable>
              </View>
            </GlassCard>
          ) : null}
        </MotiView>
      )}

      {/* Header */}
      <View style={styles.listHeader}>
        <View style={styles.listHeaderLeft}>
          <Typography variant="heading" style={styles.heading}>Tous les chapitres</Typography>
          {data && (
            <View style={styles.countBadge}>
              <Typography variant="caption" style={styles.countText}>
                {totalRead}/{data.total}
              </Typography>
            </View>
          )}
        </View>
        {data && sortedChapters.length > 0 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              markVolumeRead(entryMangaId, source, allChapters);
            }}
            accessibilityLabel="Tout marquer comme lu"
          >
            <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.accentLight} />
          </Pressable>
        )}
      </View>

      {data && page > 1 && (
        <Typography variant="caption" style={styles.pageHint}>(page {page})</Typography>
      )}

      {/* Loading */}
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

      {/* Error */}
      {isError && (
        <EmptyState
          icon="📭"
          title="Impossible de charger les chapitres"
          subtitle="Vérifiez votre connexion et réessayez."
        />
      )}

      {/* Empty */}
      {!isLoading && !isError && data && data.chapters.length === 0 && (
        <EmptyState
          icon="📖"
          title="Aucun chapitre disponible"
          subtitle="Les chapitres n'ont pas encore été importés sur MangaDex."
        />
      )}

      {/* Volume groups */}
      {!isLoading && !isError && data && data.chapters.length > 0 && (
        <View style={styles.volumesContainer}>
          {volumeKeys.map(vol => {
            const chapters = volumeMap.get(vol) ?? [];
            const expanded = isVolumeExpanded(vol);
            const fullyRead = isVolumeFullyRead(chapters);
            const readCount = volumeReadCount(chapters);
            const isActiveVol = nextChapter ? (nextChapter.volume ?? 'Hors volume') === vol : false;

            return (
              <View key={vol} style={styles.volumeGroup}>
                {/* Volume header */}
                <Pressable
                  style={[styles.volumeHeader, isActiveVol && styles.volumeHeaderActive]}
                  onPress={() => toggleVolume(vol)}
                  accessibilityLabel={`${vol === 'Hors volume' ? 'Hors volume' : `Volume ${vol}`}, ${readCount}/${chapters.length} lus`}
                >
                  <View style={styles.volumeHeaderLeft}>
                    <Typography variant="bodyBold" style={styles.volumeTitle}>
                      {vol === 'Hors volume' ? 'Hors volume' : `Volume ${vol}`}
                    </Typography>
                    <Typography variant="label" style={styles.volumeCount}>
                      {readCount}/{chapters.length}
                    </Typography>
                  </View>

                  <View style={styles.volumeHeaderRight}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (fullyRead) {
                          // Deselect all chapters in volume — toggle each one to unread
                          for (const ch of chapters) {
                            if (isChapterRead(ch)) {
                              toggleChapterRead(entryMangaId, source, ch.id, parseFloat(ch.chapter));
                            }
                          }
                        } else {
                          markVolumeRead(
                            entryMangaId,
                            source,
                            chapters.map(ch => ({ id: ch.id, num: parseFloat(ch.chapter) }))
                          );
                        }
                      }}
                      accessibilityLabel={fullyRead ? 'Décocher le volume' : 'Marquer le volume comme lu'}
                    >
                      <Ionicons
                        name={fullyRead ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={fullyRead ? COLORS.success : COLORS.textMuted}
                      />
                    </Pressable>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={COLORS.textMuted}
                    />
                  </View>
                </Pressable>

                {/* Chapter rows */}
                {expanded && (
                  <View style={styles.chaptersList}>
                    {chapters.map((ch, i) => {
                      const read = isChapterRead(ch);
                      const dateStr = (() => {
                        try {
                          return format(parseISO(ch.publishAt), 'd MMM yyyy', { locale: fr });
                        } catch {
                          return '';
                        }
                      })();

                      return (
                        <View key={ch.id}>
                          <View style={styles.chapterRow}>
                            {/* Check circle */}
                            <Pressable
                              style={styles.checkCircle}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                toggleChapterRead(entryMangaId, source, ch.id, parseFloat(ch.chapter));
                              }}
                              accessibilityLabel={`${read ? 'Marquer non lu' : 'Marquer lu'}: chapitre ${ch.chapter}`}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: read }}
                            >
                              <Ionicons
                                name={read ? 'checkmark-circle' : 'ellipse-outline'}
                                size={26}
                                color={read ? COLORS.accent : COLORS.textMuted}
                              />
                            </Pressable>

                            {/* Chapter info (opens sheet) */}
                            <Pressable
                              style={styles.chapterInfo}
                              onPress={() => setSelectedChapter(ch)}
                              accessibilityLabel={`Détails du chapitre ${ch.chapter}`}
                            >
                              <Typography
                                variant="bodyBold"
                                style={[styles.chapterNum, read && styles.chapterNumRead]}
                              >
                                Ch.{ch.chapter}
                              </Typography>
                              {ch.title ? (
                                <Typography variant="label" numberOfLines={1} style={styles.chapterTitle}>
                                  {ch.title}
                                </Typography>
                              ) : null}
                              <Typography variant="caption" style={styles.chapterDate}>
                                {dateStr}
                              </Typography>
                            </Pressable>

                            {/* Pages */}
                            <Typography variant="caption" style={styles.pagesText}>
                              {ch.pages}p
                            </Typography>
                          </View>

                          {/* Divider (except last) */}
                          {i < chapters.length - 1 && (
                            <View style={styles.rowDivider} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Pagination */}
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

      <ChapterDetailSheet
        chapter={selectedChapter}
        manga={manga}
        entryMangaId={entryMangaId}
        source={source}
        onClose={() => setSelectedChapter(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.md },
  continueCard: { borderRadius: RADIUS.xl },
  continueInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
  },
  continueCover: {
    width: 56,
    height: 80,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceRaised,
  },
  continueCenter: { flex: 1, gap: SPACING.xs },
  continueChapter: { fontSize: 15 },
  continueTitle: { color: COLORS.textMuted },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: `${COLORS.accent}66`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allReadText: { color: COLORS.success, fontSize: 15 },
  allReadDate: { color: COLORS.textMuted },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heading: { fontSize: 18 },
  countBadge: {
    backgroundColor: COLORS.surfaceRaised,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  countText: { color: COLORS.textMuted },
  pageHint: {
    color: COLORS.textMuted,
    marginTop: -SPACING.xs,
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
  volumesContainer: { gap: SPACING.sm },
  volumeGroup: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  volumeHeaderActive: {
    backgroundColor: COLORS.surfaceRaised,
  },
  volumeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  volumeTitle: { fontSize: 14 },
  volumeCount: { color: COLORS.textMuted },
  volumeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  chaptersList: { paddingBottom: SPACING.xs },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
  },
  checkCircle: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterInfo: { flex: 1, gap: 2 },
  chapterNum: { fontSize: 14 },
  chapterNumRead: { color: COLORS.textMuted },
  chapterTitle: { color: COLORS.textMuted, fontSize: 12 },
  chapterDate: { marginTop: 2, color: COLORS.textMuted, fontSize: 10, textTransform: 'none', letterSpacing: 0 },
  pagesText: { color: COLORS.textMuted, fontSize: 10, textTransform: 'none', letterSpacing: 0 },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: SPACING.base + 30 + SPACING.md,
  },
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
