import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useDownloadsStore } from '@/lib/store/downloads';
import { downloadChapter, deleteChapterDownload } from '@/lib/utils/downloads';
import { useLibraryStore } from '@/lib/store/library';
import { Panel } from '@/components/ui/Panel';
import { Typography } from '@/components/ui/Typography';
import { ChapterDetailSheet } from './ChapterDetailSheet';
import { compareChapters } from '@/lib/utils/chapter';
import { BORDERS, COLORS, RADIUS, SPACING, themedStyles } from '@/constants/theme';
import type { Manga, MangaChapter } from '@/lib/types';

type ChapterListMode = 'track' | 'read';

interface ChapterListProps {
  chapters: MangaChapter[];
  entryMangaId: string;
  source: string;
  /** Adapter the reader fetches pages from when it differs from the entry
   *  source — e.g. MangaPlus chapters shown under an AniList entry. */
  pagesSource?: string;
  manga: Manga;
  mode: ChapterListMode;
  activeLang?: 'fr' | 'en';
  availableLangs?: Array<'fr' | 'en'>;
  onLangChange?: (lang: 'fr' | 'en') => void;
}

const PAGE_SIZE = 50;

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

export function ChapterList({ chapters, entryMangaId, source, pagesSource, manga, mode, activeLang, availableLangs, onLangChange }: ChapterListProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const isTrack = mode === 'track';
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [selectedChapter, setSelectedChapter] = useState<MangaChapter | null>(null);
  const [page, setPage] = useState(1);

  const entry = useLibraryStore(s => s.entries.find(e => e.mangaId === entryMangaId && e.source === source));
  const toggleChapterRead = useLibraryStore(s => s.toggleChapterRead);
  const markVolumeRead = useLibraryStore(s => s.markVolumeRead);
  const unmarkAllRead = useLibraryStore(s => s.unmarkAllRead);
  const readingPositions = useLibraryStore(s => s.readingPositions);
  const downloads = useDownloadsStore(s => s.downloads);
  const downloadProgress = useDownloadsStore(s => s.progress);

  const mangaTitle = manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred;
  const feedSource = pagesSource ?? source;
  // MangaPlus/Webtoon pages are fetched+cached locally at read time; the generic
  // remote-URL download path doesn't apply, so the offline button is hidden.
  const canDownload = feedSource !== 'mangaplus' && feedSource !== 'webtoon';

  const isChapterRead = (ch: MangaChapter): boolean => {
    const num = parseFloat(ch.chapter);
    const ids = entry?.readChapterIds ?? [];
    if (ids.includes(ch.id)) return true;
    if (Number.isFinite(num) && num <= (entry?.progress ?? 0)) return true;
    return false;
  };

  const openReader = (ch: MangaChapter) => {
    // Synthetic / aggregate-only cards have no readable fr/en upload behind them
    if (!ch.isReadable) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(
      `/reader/${ch.id}?chapter=${encodeURIComponent(ch.chapter)}&title=${encodeURIComponent(ch.title ?? '')}&entryMangaId=${encodeURIComponent(entryMangaId)}&source=${encodeURIComponent(source)}&pagesSource=${encodeURIComponent(feedSource)}&mangaTitle=${encodeURIComponent(mangaTitle)}` as never,
    );
  };

  const toggleRead = (ch: MangaChapter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleChapterRead(entryMangaId, source, ch.id, parseFloat(ch.chapter));
  };

  const handleDownload = (ch: MangaChapter) => {
    if (downloadProgress[ch.id] != null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (downloads[ch.id]) {
      Alert.alert(
        'Supprimer le téléchargement',
        `Retirer le chapitre ${ch.chapter} du stockage hors-ligne ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: () => deleteChapterDownload(ch.id) },
        ],
      );
      return;
    }
    downloadChapter({
      chapterId: ch.id,
      source: feedSource === 'comick' ? 'comick' : 'mangadex',
      mangaTitle,
      chapter: ch.chapter,
      title: ch.title,
    }).then(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }).catch(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Téléchargement échoué', `Impossible de télécharger le chapitre ${ch.chapter}. Vérifiez votre connexion puis réessayez.`);
    });
  };

  const sortedChapters = useMemo(
    () => [...chapters].sort(compareChapters),
    [chapters],
  );

  // Read mode lists only chapters that can actually be opened in the reader;
  // track mode keeps everything (checkable cards include synthetic fillers).
  const readableChapters = useMemo(
    () => (isTrack ? sortedChapters : sortedChapters.filter(ch => ch.isReadable)),
    [sortedChapters, isTrack],
  );

  const totalRead = useMemo(
    () => sortedChapters.filter(ch => isChapterRead(ch)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedChapters, entry?.readChapterIds, entry?.progress],
  );

  const allRead = totalRead === sortedChapters.length && sortedChapters.length > 0;

  const focusChapter = useMemo(() => {
    if (isTrack) return sortedChapters.find(ch => !isChapterRead(ch)) ?? null;
    return readableChapters.find(ch => !isChapterRead(ch)) ?? readableChapters[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedChapters, readableChapters, entry?.readChapterIds, entry?.progress, isTrack]);

  const finishDate = useMemo(() => {
    if (!allRead || !entry?.chapterData) return null;
    const dates = Object.values(entry.chapterData)
      .map(d => d.readAt)
      .filter(Boolean) as string[];
    if (!dates.length) return null;
    const latest = dates.sort().at(-1)!;
    return formatDate(latest) || null;
  }, [allRead, entry?.chapterData]);

  const handleToggleAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (allRead) {
      unmarkAllRead(entryMangaId, source);
    } else {
      markVolumeRead(
        entryMangaId,
        source,
        sortedChapters.map(c => ({ id: c.id, num: parseFloat(c.chapter) })),
      );
    }
  };

  // ── READ MODE: volume accordion (same as before) ──────────────────────────
  const volumeMap = useMemo(() => groupByVolume(readableChapters), [readableChapters]);
  const volumeKeys = useMemo(() => sortedVolumeKeys(volumeMap), [volumeMap]);

  const firstExpandedVolume = focusChapter ? (focusChapter.volume ?? 'Hors volume') : null;

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
      } else {
        next.add(vol);
      }
      return next;
    });
  };

  // ── TRACK MODE: flat paginated list ───────────────────────────────────────
  const visibleChapters = sortedChapters.slice(0, page * PAGE_SIZE);
  const hasMore = page * PAGE_SIZE < sortedChapters.length;

  return (
    <View style={styles.container}>
      {/* Header card */}
      <MotiView
        from={reduceMotion ? { opacity: 1, translateY: 0 } : { opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        {isTrack && allRead ? (
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
        ) : !isTrack && focusChapter ? (
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
                  LECTURE
                </Typography>
                <Typography variant="display" color={COLORS.onInk} style={styles.continueChapterNum}>
                  CH.{focusChapter.chapter}
                </Typography>
                {focusChapter.title ? (
                  <Typography variant="label" color={COLORS.onInkMuted} numberOfLines={1}>
                    {focusChapter.title}
                  </Typography>
                ) : null}
              </View>
              <Pressable
                style={({ pressed }) => [styles.readBtn, pressed && styles.readBtnPressed]}
                onPress={() => openReader(focusChapter)}
                accessibilityRole="button"
                accessibilityLabel={`Lire le chapitre ${focusChapter.chapter}`}
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

      {/* Header row */}
      <View style={styles.listHeader}>
        <View style={styles.listHeaderLeft}>
          <View style={styles.sectionMarker} />
          <Typography variant="title" color={COLORS.textInk}>
            {isTrack ? 'Chapitres' : 'Lecture'}
          </Typography>
          <View style={styles.countBadge}>
            <Typography variant="caption" color={COLORS.textInkMuted}>
              {isTrack ? `${totalRead}/${sortedChapters.length}` : `${readableChapters.length}`}
            </Typography>
          </View>
        </View>
        {isTrack ? (
          <Pressable
            onPress={handleToggleAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={allRead ? 'Tout décocher' : 'Tout marquer comme lu'}
          >
            <Ionicons
              name={allRead ? 'checkmark-done-circle' : 'checkmark-done-circle-outline'}
              size={26}
              color={allRead ? COLORS.statusCompleted : COLORS.accentRed}
            />
          </Pressable>
        ) : availableLangs && availableLangs.length > 1 && onLangChange ? (
          <View style={styles.langToggle}>
            {availableLangs.map(lang => (
              <Pressable
                key={lang}
                style={[styles.langBtn, activeLang === lang && styles.langBtnActive]}
                onPress={() => onLangChange(lang)}
                accessibilityRole="button"
                accessibilityState={{ selected: activeLang === lang }}
                accessibilityLabel={lang === 'fr' ? 'Français' : 'English'}
                hitSlop={4}
              >
                <Typography
                  variant="caption"
                  style={[styles.langBtnLabel, activeLang === lang && styles.langBtnLabelActive]}
                >
                  {lang.toUpperCase()}
                </Typography>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* ── TRACK MODE: flat list ── */}
      {isTrack ? (
        <View style={styles.flatList}>
          {visibleChapters.map((ch, i) => {
            const read = isChapterRead(ch);
            const dateStr = formatDate(ch.publishAt);
            return (
              <MotiView
                key={ch.id}
                from={reduceMotion ? { opacity: 1, translateY: 0 } : { opacity: 0, translateY: 4 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 380,
                  damping: 30,
                  delay: Math.min(i % PAGE_SIZE, 30) * 25,
                }}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.chapterCard,
                    read && styles.chapterCardRead,
                    pressed && styles.chapterCardPressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedChapter(ch);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Chapitre ${ch.chapter}${ch.title ? ` : ${ch.title}` : ''} — afficher les détails`}
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
                    <View style={styles.chapterMeta}>
                      {(dateStr || ch.pages > 0) && (
                        <Typography variant="caption" color={COLORS.textInkFaint} style={styles.chapterDate}>
                          {dateStr}{dateStr && ch.pages > 0 ? ' · ' : ''}{ch.pages > 0 ? `${ch.pages}p` : ''}
                        </Typography>
                      )}
                      {readingPositions[ch.id] != null && !read && (
                        <View style={styles.resumeBadge}>
                          <Ionicons name="bookmark" size={8} color={COLORS.accentRed} />
                          <Typography variant="caption" color={COLORS.accentRed} style={styles.resumeBadgeText}>
                            p.{readingPositions[ch.id]}
                          </Typography>
                        </View>
                      )}
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.checkCircle, pressed && { opacity: 0.6 }]}
                    onPress={e => { e.stopPropagation(); toggleRead(ch); }}
                    hitSlop={8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: read }}
                    accessibilityLabel={`Chapitre ${ch.chapter} — ${read ? 'lu' : 'non lu'}`}
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

          {hasMore && (
            <Pressable
              style={({ pressed }) => [styles.loadMoreBtn, pressed && styles.loadMoreBtnPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPage(p => p + 1);
              }}
            >
              <Ionicons name="chevron-down" size={16} color={COLORS.accentRed} />
              <Typography variant="label" color={COLORS.accentRed}>
                Voir {Math.min(PAGE_SIZE, sortedChapters.length - visibleChapters.length)} chapitres de plus
              </Typography>
            </Pressable>
          )}
        </View>
      ) : (
        /* ── READ MODE: volume accordion ── */
        <View style={styles.volumesContainer}>
          {volumeKeys.map(vol => {
            const volChapters = volumeMap.get(vol) ?? [];
            const expanded = isVolumeExpanded(vol);
            const isActiveVol = focusChapter
              ? (focusChapter.volume ?? 'Hors volume') === vol
              : false;

            return (
              <Panel
                key={vol}
                variant="paper"
                bordered
                style={[styles.volumeGroup, isActiveVol && styles.volumeGroupActive]}
              >
                <Pressable
                  style={styles.volumeHeader}
                  onPress={() => toggleVolume(vol)}
                  accessibilityRole="button"
                  accessibilityLabel={`${vol === 'Hors volume' ? 'Hors volume' : `Volume ${vol}`}, ${volChapters.length} chapitres`}
                >
                  <View style={styles.volumeHeaderLeft}>
                    <Typography variant="subheading" color={COLORS.textInk}>
                      {vol === 'Hors volume' ? 'Chapitres' : `Volume ${vol}`}
                    </Typography>
                    <Typography variant="label" color={COLORS.textInkMuted}>
                      {volChapters.length}
                    </Typography>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={COLORS.textInkMuted}
                  />
                </Pressable>

                {expanded && (
                  <View style={styles.chaptersList}>
                    {volChapters.map((ch, i) => {
                      const dateStr = formatDate(ch.publishAt);
                      return (
                        <MotiView
                          key={ch.id}
                          from={reduceMotion ? { opacity: 1, translateY: 0 } : { opacity: 0, translateY: 6 }}
                          animate={{ opacity: 1, translateY: 0 }}
                          transition={{ type: 'spring', stiffness: 360, damping: 28, delay: Math.min(i * 35, 280) }}
                        >
                          <Pressable
                            style={({ pressed }) => [styles.chapterCard, pressed && styles.chapterCardPressed]}
                            onPress={() => openReader(ch)}
                            onLongPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              setSelectedChapter(ch);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Lire chapitre ${ch.chapter}${ch.title ? ` : ${ch.title}` : ''}`}
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
                              <Typography variant="display" color={COLORS.textInk} style={styles.chapterNum}>
                                CH.{ch.chapter}
                              </Typography>
                              {ch.title ? (
                                <Typography variant="label" color={COLORS.textInkMuted} numberOfLines={2} style={styles.chapterTitle}>
                                  {ch.title}
                                </Typography>
                              ) : null}
                              {(dateStr || ch.pages > 0) && (
                                <Typography variant="caption" color={COLORS.textInkFaint} style={styles.chapterDate}>
                                  {dateStr}{dateStr && ch.pages > 0 ? ' · ' : ''}{ch.pages > 0 ? `${ch.pages}p` : ''}
                                </Typography>
                              )}
                            </View>
                            {canDownload && (
                              <Pressable
                                style={({ pressed }) => [
                                  styles.dlBtn,
                                  downloads[ch.id] != null && styles.dlBtnDone,
                                  pressed && { opacity: 0.7 },
                                ]}
                                onPress={e => { e.stopPropagation(); handleDownload(ch); }}
                                hitSlop={6}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  downloadProgress[ch.id] != null
                                    ? `Téléchargement du chapitre ${ch.chapter} en cours`
                                    : downloads[ch.id]
                                      ? `Chapitre ${ch.chapter} téléchargé — appuyer pour supprimer`
                                      : `Télécharger le chapitre ${ch.chapter}`
                                }
                                accessibilityState={{ busy: downloadProgress[ch.id] != null }}
                              >
                                {downloadProgress[ch.id] != null ? (
                                  <ActivityIndicator size="small" color={COLORS.accentRed} />
                                ) : (
                                  <Ionicons
                                    name={downloads[ch.id] ? 'checkmark-done' : 'arrow-down'}
                                    size={15}
                                    color={downloads[ch.id] ? COLORS.statusCompleted : COLORS.textInkMuted}
                                  />
                                )}
                              </Pressable>
                            )}
                            <View style={styles.readChip}>
                              <Ionicons name="book-outline" size={16} color={COLORS.accentRed} />
                            </View>
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
      )}

      <ChapterDetailSheet
        chapter={selectedChapter}
        manga={manga}
        entryMangaId={entryMangaId}
        source={source}
        pagesSource={feedSource}
        onClose={() => setSelectedChapter(null)}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
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
  continueCover: { width: 64, height: 92, backgroundColor: COLORS.inkSoft },
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
  readBtnPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  readBtnText: { letterSpacing: 1.5, fontSize: 12 },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  listHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionMarker: { width: 4, height: 20, backgroundColor: COLORS.accentRed, borderRadius: 2 },
  countBadge: {
    backgroundColor: COLORS.paperSunken,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },

  // ── FLAT LIST (track mode) ──
  flatList: { gap: SPACING.xs },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: BORDERS.hair,
    borderColor: `${COLORS.accentRed}44`,
    backgroundColor: COLORS.accentSoft,
    marginTop: SPACING.xs,
  },
  loadMoreBtnPressed: { opacity: 0.75 },

  // ── VOLUME ACCORDION (read mode) ──
  volumesContainer: { gap: SPACING.sm },
  volumeGroup: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  volumeGroupActive: { borderColor: `${COLORS.accentRed}66` },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  volumeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  chaptersList: { paddingHorizontal: SPACING.sm, paddingBottom: SPACING.sm, gap: SPACING.xs, paddingTop: SPACING.sm },

  // ── SHARED CHAPTER CARD ──
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
  chapterCardRead: { backgroundColor: COLORS.paperSunken },
  chapterCardPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  chapterCoverFrame: {
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  chapterThumb: { width: 52, height: 74, backgroundColor: COLORS.paperSunken },
  chapterInfo: { flex: 1, gap: 2 },
  chapterNum: { fontSize: 18, lineHeight: 20, letterSpacing: 0.5 },
  chapterTitle: { fontSize: 12, lineHeight: 16 },
  chapterMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  chapterDate: { textTransform: 'none', letterSpacing: 0, fontSize: 10 },
  resumeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: SPACING.xs + 1,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentSoft,
    borderWidth: BORDERS.hair,
    borderColor: `${COLORS.accentRed}44`,
  },
  resumeBadgeText: { fontSize: 9, letterSpacing: 0.3, textTransform: 'none', lineHeight: 12 },
  checkCircle: { width: 36, alignItems: 'center', justifyContent: 'center' },
  readChip: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
    borderWidth: BORDERS.hair,
    borderColor: `${COLORS.accentRed}44`,
  },
  dlBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  dlBtnDone: {
    backgroundColor: `${COLORS.statusCompleted}22`,
    borderColor: `${COLORS.statusCompleted}66`,
  },
  langToggle: {
    flexDirection: 'row',
    borderRadius: RADIUS.full,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
    overflow: 'hidden',
    backgroundColor: COLORS.paperSunken,
  },
  langBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBtnActive: {
    backgroundColor: COLORS.ink,
  },
  langBtnLabel: {
    letterSpacing: 0.8,
    fontSize: 10,
    color: COLORS.textInkMuted,
  },
  langBtnLabelActive: {
    color: COLORS.onInk,
  },
}));
