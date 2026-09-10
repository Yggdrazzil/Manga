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
import { Panel } from '@/components/ui/Panel';
import { Typography } from '@/components/ui/Typography';
import { ChapterDetailSheet } from './ChapterDetailSheet';
import { compareChapters } from '@/lib/utils/chapter';
import { BORDERS, COLORS, RADIUS, SPACING } from '@/constants/theme';
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
  const [selectedChapter, setSelectedChapter] = useState<MangaChapter | null>(null);

  const entry = useLibraryStore(s => s.entries.find(e => e.mangaId === entryMangaId && e.source === source));
  const toggleChapterRead = useLibraryStore(s => s.toggleChapterRead);
  const markVolumeRead = useLibraryStore(s => s.markVolumeRead);

  const mangaTitle = manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred;

  const isChapterRead = (ch: MangaChapter): boolean => {
    const num = parseFloat(ch.chapter);
    const ids = entry?.readChapterIds ?? [];
    if (ids.includes(ch.id)) return true;
    if (Number.isFinite(num) && num <= (entry?.progress ?? 0)) return true;
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
    () => [...chapters].sort(compareChapters),
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
        volumeKeys.forEach(k => { if (k !== vol) next.delete(k); });
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
          <Panel variant="ink" style={styles.continueCard}>
            <View style={styles.continueInner}>
              <Ionicons name="checkmark-circle" size={30} color={COLORS.statusCompleted} />
              <View style={styles.continueCenter}>
                <Typography variant="kicker" color={COLORS.onInkMuted} style={styles.continueKicker}>
                  TERMINÉ
                </Typography>
                <Typography variant="heading" color={COLORS.onInk}>
                  Tout lu !
                </Typography>
                {finishDate && (
                  <Typography variant="label" color={COLORS.onInkMuted}>
                    Terminé le {finishDate}
                  </Typography>
                )}
              </View>
            </View>
          </Panel>
        ) : nextChapter ? (
          <Panel variant="ink" hardShadow style={styles.continueCard}>
            <View style={styles.continueInner}>
              <View style={styles.continueCoverFrame}>
                <Image
                  source={{ uri: manga.coverImage }}
                  style={styles.continueCover}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              </View>
              <View style={styles.continueCenter}>
                <Typography variant="kicker" color={COLORS.accentRed} style={styles.continueKicker}>
                  CONTINUER
                </Typography>
                <Typography variant="display" color={COLORS.onInk} style={styles.continueChapterNum}>
                  CH.{nextChapter.chapter}
                </Typography>
                {nextChapter.title ? (
                  <Typography variant="label" color={COLORS.onInkMuted} numberOfLines={1}>
                    {nextChapter.title}
                  </Typography>
                ) : null}
                {nextChapter.volume ? (
                  <Typography variant="caption" color={COLORS.onInkMuted}>
                    Vol.{nextChapter.volume}
                  </Typography>
                ) : null}
              </View>
              <Pressable
                style={({ pressed }) => [styles.readBtn, pressed && styles.readBtnPressed]}
                onPress={() => openReader(nextChapter)}
                accessibilityRole="button"
                accessibilityLabel={`Lire le chapitre ${nextChapter.chapter}`}
              >
                <Ionicons name="book" size={16} color={COLORS.onInk} />
                <Typography variant="kicker" color={COLORS.onInk} style={styles.readBtnText}>
                  LIRE
                </Typography>
              </Pressable>
            </View>
          </Panel>
        ) : null}
      </MotiView>

      {/* Header */}
      <View style={styles.listHeader}>
        <View style={styles.listHeaderLeft}>
          <View style={styles.sectionMarker} />
          <Typography variant="title" color={COLORS.textInk}>
            Chapitres
          </Typography>
          <View style={styles.countBadge}>
            <Typography variant="caption" color={COLORS.textInkMuted}>
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
          <Ionicons name="checkmark-circle-outline" size={26} color={COLORS.accentRed} />
        </Pressable>
      </View>

      {/* Volume groups */}
      <View style={styles.volumesContainer}>
        {volumeKeys.map(vol => {
          const volChapters = volumeMap.get(vol) ?? [];
          const expanded = isVolumeExpanded(vol);
          const fullyRead = isVolumeFullyRead(volChapters);
          const readCount = volumeReadCount(volChapters);
          const progressPct = volChapters.length ? (readCount / volChapters.length) * 100 : 0;
          const isActiveVol = nextChapter
            ? (nextChapter.volume ?? 'Hors volume') === vol
            : false;

          return (
            <Panel
              key={vol}
              variant="paper"
              bordered
              style={[styles.volumeGroup, isActiveVol && styles.volumeGroupActive]}
            >
              {/* Volume header */}
              <Pressable
                style={styles.volumeHeader}
                onPress={() => toggleVolume(vol)}
                accessibilityRole="button"
                accessibilityLabel={`${vol === 'Hors volume' ? 'Hors volume' : `Volume ${vol}`}, ${readCount}/${volChapters.length} lus`}
              >
                <View style={styles.volumeHeaderLeft}>
                  <Typography variant="subheading" color={COLORS.textInk}>
                    {vol === 'Hors volume' ? 'Hors volume' : `Volume ${vol}`}
                  </Typography>
                  <Typography variant="label" color={COLORS.textInkMuted}>
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
                      color={fullyRead ? COLORS.statusCompleted : COLORS.textInkMuted}
                    />
                  </Pressable>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={COLORS.textInkMuted}
                  />
                </View>
              </Pressable>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%` }]} />
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
                        <Pressable
                          style={({ pressed }) => [
                            styles.chapterCard,
                            read && styles.chapterCardRead,
                            pressed && styles.chapterCardPressed,
                          ]}
                          onPress={() => openReader(ch)}
                          onLongPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setSelectedChapter(ch);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${read ? 'Lu — ' : ''}Chapitre ${ch.chapter}${ch.title ? ` : ${ch.title}` : ''}`}
                        >
                          <View style={styles.chapterCoverFrame}>
                            <Image
                              source={{ uri: manga.coverImage }}
                              style={styles.chapterThumb}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                            />
                          </View>

                          <View style={styles.chapterInfo}>
                            <Typography
                              variant="display"
                              color={read ? COLORS.textInkMuted : COLORS.textInk}
                              style={styles.chapterNum}
                            >
                              CH.{ch.chapter}
                            </Typography>
                            {ch.title ? (
                              <Typography
                                variant="label"
                                color={COLORS.textInkMuted}
                                numberOfLines={2}
                                style={styles.chapterTitle}
                              >
                                {ch.title}
                              </Typography>
                            ) : null}
                            <Typography variant="caption" color={COLORS.textInkFaint} style={styles.chapterDate}>
                              {dateStr}
                              {dateStr ? ' · ' : ''}
                              {ch.pages}p
                            </Typography>
                          </View>

                          <Pressable
                            style={[styles.checkCircle, read && styles.checkCircleRead]}
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
                              color={read ? COLORS.statusCompleted : COLORS.textInkMuted}
                            />
                          </Pressable>
                        </Pressable>
                      </MotiView>
                    );
                  })}
                </View>
              )}
            </Panel>
          );
        })}
      </View>

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
  continueCard: { borderRadius: RADIUS.xl, overflow: 'visible' },
  continueInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
  },
  continueCoverFrame: {
    borderWidth: BORDERS.bold,
    borderColor: COLORS.onInkMuted,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  continueCover: {
    width: 64,
    height: 92,
    backgroundColor: COLORS.inkSoft,
  },
  continueCenter: { flex: 1, gap: 2 },
  continueKicker: { marginBottom: 2 },
  continueChapterNum: { fontSize: 28, lineHeight: 30, letterSpacing: 1 },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'stretch',
    paddingHorizontal: SPACING.base,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.accentRed,
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.accentDeep,
  },
  readBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  readBtnText: { letterSpacing: 1.5, fontSize: 12 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  listHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionMarker: {
    width: 4,
    height: 20,
    backgroundColor: COLORS.accentRed,
    borderRadius: 2,
  },
  countBadge: {
    backgroundColor: COLORS.paperSunken,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  volumesContainer: { gap: SPACING.sm },
  volumeGroup: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  volumeGroupActive: {
    borderColor: `${COLORS.accentRed}66`,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  volumeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  volumeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.paperSunken,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.full,
  },
  chaptersList: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.paperRaised,
    borderRadius: RADIUS.md,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  chapterCardRead: {
    backgroundColor: COLORS.paperSunken,
  },
  chapterCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  chapterCoverFrame: {
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  chapterThumb: {
    width: 52,
    height: 74,
    backgroundColor: COLORS.paperSunken,
  },
  chapterInfo: { flex: 1, gap: 2 },
  chapterNum: { fontSize: 18, lineHeight: 20, letterSpacing: 0.5 },
  chapterTitle: { fontSize: 12, lineHeight: 16 },
  chapterDate: {
    marginTop: 2,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 10,
  },
  checkCircle: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleRead: {},
});
