import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLibraryStore } from '@/lib/store/library';
import { GlassCard } from '@/components/ui/GlassCard';
import { Typography } from '@/components/ui/Typography';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import type { Manga, MangaChapter } from '@/lib/types';

interface ChapterListProps {
  chapters: MangaChapter[];
  entryMangaId: string;
  source: string;
  manga: Manga;
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

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: fr });
  } catch {
    return '';
  }
}

export function ChapterList({ chapters, entryMangaId, source, manga }: ChapterListProps) {
  const router = useRouter();
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());

  const entry = useLibraryStore(s => s.entries.find(e => e.mangaId === entryMangaId && e.source === source));
  const toggleChapterRead = useLibraryStore(s => s.toggleChapterRead);
  const markVolumeRead = useLibraryStore(s => s.markVolumeRead);

  const mangaTitle = manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred;

  const isChapterRead = (ch: MangaChapter): boolean => {
    const ids = entry?.readChapterIds ?? [];
    if (ids.includes(ch.id)) return true;
    if (ids.length === 0 && parseFloat(ch.chapter) <= (entry?.progress ?? 0)) return true;
    return false;
  };

  const isVolumeFullyRead = (vol: MangaChapter[]): boolean =>
    vol.length > 0 && vol.every(ch => isChapterRead(ch));

  const volumeReadCount = (vol: MangaChapter[]): number =>
    vol.filter(ch => isChapterRead(ch)).length;

  const openReader = (ch: MangaChapter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(
      `/reader/${ch.id}?chapter=${encodeURIComponent(ch.chapter)}&title=${encodeURIComponent(ch.title ?? '')}&entryMangaId=${encodeURIComponent(entryMangaId)}&source=${encodeURIComponent(source)}&mangaTitle=${encodeURIComponent(mangaTitle)}` as never,
    );
  };

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter)),
    [chapters],
  );

  const volumeMap = useMemo(() => groupByVolume(sortedChapters), [sortedChapters]);
  const volumeKeys = useMemo(() => sortedVolumeKeys(volumeMap), [volumeMap]);

  const nextChapter = useMemo(
    () => sortedChapters.find(ch => !isChapterRead(ch)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedChapters, entry?.readChapterIds, entry?.progress],
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
    Haptics.selectionAsync();
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
    [sortedChapters, entry?.readChapterIds, entry?.progress],
  );

  const allRead = totalRead === sortedChapters.length && sortedChapters.length > 0;

  const finishDate = useMemo(() => {
    if (!allRead || !entry?.chapterData) return null;
    const dates = Object.values(entry.chapterData)
      .map(d => d.readAt)
      .filter(Boolean) as string[];
    if (!dates.length) return null;
    const latest = dates.sort().at(-1)!;
    return formatDate(latest) || null;
  }, [allRead, entry?.chapterData]);

  const markAllRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markVolumeRead(
      entryMangaId,
      source,
      sortedChapters.map(c => ({ id: c.id, num: parseFloat(c.chapter) })),
    );
  };

  return (
    <View style={styles.container}>
      {/* Continue card */}
      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        {allRead ? (
          <GlassCard style={styles.continueCard}>
            <View style={styles.continueInner}>
              <Ionicons name="checkmark-circle" size={30} color={COLORS.success} />
              <View style={styles.continueCenter}>
                <Typography variant="bodyBold" style={styles.allReadText}>
                  Tout lu !
                </Typography>
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
              <View style={styles.continueCenter}>
                <Typography variant="caption" color={COLORS.accentLight} style={styles.continueKicker}>
                  Continuer
                </Typography>
                <Typography variant="heading" style={styles.continueChapter}>
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
              </View>
              <Pressable
                style={({ pressed }) => [styles.readBtn, pressed && styles.readBtnPressed]}
                onPress={() => openReader(nextChapter)}
                accessibilityRole="button"
                accessibilityLabel={`Lire le chapitre ${nextChapter.chapter}`}
              >
                <Ionicons name="book" size={18} color="#fff" />
                <Typography variant="label" style={styles.readBtnText}>
                  LIRE
                </Typography>
              </Pressable>
            </View>
          </GlassCard>
        ) : null}
      </MotiView>

      {/* Header */}
      <View style={styles.listHeader}>
        <View style={styles.listHeaderLeft}>
          <Typography variant="heading" style={styles.heading}>
            Tous les chapitres
          </Typography>
          <View style={styles.countBadge}>
            <Typography variant="caption" style={styles.countText}>
              {totalRead}/{sortedChapters.length}
            </Typography>
          </View>
        </View>
        <Pressable
          onPress={markAllRead}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Tout marquer comme lu"
        >
          <Ionicons name="checkmark-circle-outline" size={26} color={COLORS.accentLight} />
        </Pressable>
      </View>

      {/* Volume groups */}
      <View style={styles.volumesContainer}>
        {volumeKeys.map(vol => {
          const volChapters = volumeMap.get(vol) ?? [];
          const expanded = isVolumeExpanded(vol);
          const fullyRead = isVolumeFullyRead(volChapters);
          const readCount = volumeReadCount(volChapters);
          const progressPct = volChapters.length
            ? (readCount / volChapters.length) * 100
            : 0;
          const isActiveVol = nextChapter
            ? (nextChapter.volume ?? 'Hors volume') === vol
            : false;

          return (
            <View key={vol} style={styles.volumeGroup}>
              {/* Volume header */}
              <Pressable
                style={[styles.volumeHeader, isActiveVol && styles.volumeHeaderActive]}
                onPress={() => toggleVolume(vol)}
                accessibilityRole="button"
                accessibilityLabel={`${vol === 'Hors volume' ? 'Hors volume' : `Volume ${vol}`}, ${readCount}/${volChapters.length} lus`}
              >
                <View style={styles.volumeHeaderLeft}>
                  <Typography variant="bodyBold" style={styles.volumeTitle}>
                    {vol === 'Hors volume' ? 'Hors volume' : `Volume ${vol}`}
                  </Typography>
                  <Typography variant="label" style={styles.volumeCount}>
                    {readCount}/{volChapters.length}
                  </Typography>
                </View>

                <View style={styles.volumeHeaderRight}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (fullyRead) {
                        for (const ch of volChapters) {
                          if (isChapterRead(ch)) {
                            toggleChapterRead(entryMangaId, source, ch.id, parseFloat(ch.chapter));
                          }
                        }
                      } else {
                        markVolumeRead(
                          entryMangaId,
                          source,
                          volChapters.map(ch => ({ id: ch.id, num: parseFloat(ch.chapter) })),
                        );
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={fullyRead ? 'Décocher le volume' : 'Marquer le volume comme lu'}
                  >
                    <Ionicons
                      name={fullyRead ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
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

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>

              {/* Chapter cards */}
              {expanded && (
                <View style={styles.chaptersList}>
                  {volChapters.map((ch, i) => {
                    const read = isChapterRead(ch);
                    const dateStr = formatDate(ch.publishAt);
                    return (
                      <MotiView
                        key={ch.id}
                        from={{ opacity: 0, translateY: 6 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 360,
                          damping: 28,
                          delay: Math.min(i * 35, 280),
                        }}
                      >
                        <GlassCard style={styles.chapterCard} borderRadius={RADIUS.md}>
                          <View style={styles.chapterCardInner}>
                            <Image
                              source={{ uri: manga.coverImage }}
                              style={styles.chapterThumb}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                            />

                            <Pressable
                              style={styles.chapterInfo}
                              onPress={() => openReader(ch)}
                              accessibilityRole="button"
                              accessibilityLabel={`Lire le chapitre ${ch.chapter}`}
                            >
                              <Typography
                                variant="bodyBold"
                                style={[styles.chapterNum, read && styles.chapterNumRead]}
                              >
                                Ch.{ch.chapter}
                              </Typography>
                              {ch.title ? (
                                <Typography
                                  variant="label"
                                  numberOfLines={2}
                                  style={styles.chapterTitle}
                                >
                                  {ch.title}
                                </Typography>
                              ) : null}
                              <Typography variant="caption" style={styles.chapterDate}>
                                {dateStr}
                                {dateStr ? ' · ' : ''}
                                {ch.pages}p
                              </Typography>
                            </Pressable>

                            <Pressable
                              style={styles.checkCircle}
                              hitSlop={8}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                toggleChapterRead(entryMangaId, source, ch.id, parseFloat(ch.chapter));
                              }}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: read }}
                              accessibilityLabel={`${read ? 'Marquer non lu' : 'Marquer lu'}: chapitre ${ch.chapter}`}
                            >
                              <Ionicons
                                name={read ? 'checkmark-circle' : 'ellipse-outline'}
                                size={30}
                                color={read ? COLORS.success : COLORS.textMuted}
                              />
                            </Pressable>
                          </View>
                        </GlassCard>
                      </MotiView>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>
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
    width: 64,
    height: 92,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceRaised,
  },
  continueCenter: { flex: 1, gap: 2 },
  continueKicker: { color: COLORS.accentLight },
  continueChapter: { fontSize: 19, lineHeight: 24 },
  continueTitle: { color: COLORS.textMuted },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'stretch',
    paddingHorizontal: SPACING.base,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
  },
  readBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  readBtnText: {
    color: '#fff',
    fontFamily: FONTS.bodyBold,
    letterSpacing: 1,
    fontSize: 12,
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
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.surfaceRaised,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
  },
  chaptersList: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  chapterCard: {},
  chapterCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.surfaceRaised,
  },
  chapterThumb: {
    width: 56,
    height: 80,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  chapterInfo: { flex: 1, gap: 2 },
  chapterNum: { fontSize: 15 },
  chapterNumRead: { color: COLORS.textMuted },
  chapterTitle: { color: COLORS.textMuted, fontSize: 12 },
  chapterDate: {
    marginTop: 2,
    color: COLORS.textMuted,
    fontSize: 10,
    textTransform: 'none',
    letterSpacing: 0,
  },
  checkCircle: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
