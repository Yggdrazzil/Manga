import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from '@/lib/utils/haptics';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  getReadingActivity,
  getReadingStreak,
  type ReadingStreak,
  getWeekActivity,
  getAnnualStats,
  type DayActivity,
} from '@/lib/utils/readingActivity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDERS, COLORS, FONTS, RADIUS, SCRIMS, SPACING, STATUS_LABELS, inkScrim, themedStyles } from '@/constants/theme';
import { StarRating } from '@/components/ui/StarRating';
import { useLibraryStore } from '@/lib/store/library';
import { useComicsStore } from '@/lib/store/comics';
import { confirmAction } from '@/lib/utils/confirm';
import type { BDSeriesEntry, LibraryEntry, ReadingStatus } from '@/lib/types';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Typography } from '@/components/ui/Typography';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { BannerPicker } from '@/components/profile/BannerPicker';
import { Ionicons } from '@expo/vector-icons';
import { coverSource } from '@/lib/utils/images';

const TAB_BAR_HEIGHT = 88;

// Functions, not module consts: COLORS values change with the active theme,
// so capturing them at import time would freeze the default palette.
const statusColor = (s: ReadingStatus): string =>
  ({
    READING: COLORS.statusReading,
    COMPLETED: COLORS.statusCompleted,
    PLAN_TO_READ: COLORS.statusPlan,
    DROPPED: COLORS.statusDropped,
    PAUSED: COLORS.statusPaused,
  })[s];

type Filter = 'ALL' | ReadingStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Tout' },
  { key: 'READING', label: STATUS_LABELS.READING },
  { key: 'PLAN_TO_READ', label: STATUS_LABELS.PLAN_TO_READ },
  { key: 'COMPLETED', label: STATUS_LABELS.COMPLETED },
  { key: 'PAUSED', label: STATUS_LABELS.PAUSED },
  { key: 'DROPPED', label: STATUS_LABELS.DROPPED },
];

function StatPill({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statPill}>
      <Typography variant="display" color={COLORS.onInk} style={styles.statValue}>{value}</Typography>
      <Typography variant="caption" color={COLORS.onInkMuted} style={styles.statLabel}>{label}</Typography>
    </View>
  );
}

function StatusBar({ status, count, total }: { status: ReadingStatus; count: number; total: number }) {
  const percent = total > 0 ? count / total : 0;
  const color = statusColor(status);
  return (
    <View style={styles.statusBarRow}>
      <View style={styles.statusBarLabel}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Typography variant="label" color={COLORS.textInk}>{STATUS_LABELS[status]}</Typography>
      </View>
      <View style={styles.statusBarTrack}>
        <View style={[styles.statusBarFill, { backgroundColor: color, flex: percent }]} />
        {percent < 1 && <View style={{ flex: 1 - percent }} />}
      </View>
      <Typography variant="label" color={COLORS.textInkMuted} style={styles.statusCount}>{count}</Typography>
    </View>
  );
}

function WeeklyActivityChart({ weekData, streak }: { weekData: DayActivity[]; streak: ReadingStreak }) {
  const maxCount = Math.max(1, ...weekData.map(d => d.count));

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Typography variant="kicker" color={COLORS.textInkMuted} style={styles.chartTitle}>
          ACTIVITÉ (7 JOURS)
        </Typography>
        {streak.current > 0 ? (
          <View style={styles.streakChip}>
            <Typography variant="label" color={COLORS.star} style={styles.streakLabel}>
              🔥 {streak.current} jour{streak.current > 1 ? 's' : ''}
              {streak.best > streak.current ? ` · record ${streak.best}` : ''}
            </Typography>
          </View>
        ) : streak.best > 1 ? (
          <View style={styles.streakChip}>
            <Typography variant="label" color={COLORS.textInkMuted} style={styles.streakLabel}>
              Record : {streak.best} jours
            </Typography>
          </View>
        ) : null}
      </View>
      <View style={styles.barsRow}>
        {weekData.map(day => {
          const fillH = day.count > 0 ? Math.max(8, Math.round((day.count / maxCount) * 44)) : 0;
          const barColor = day.isToday ? COLORS.accentRed : `${COLORS.accentRed}66`;
          return (
            <View key={day.dateStr} style={styles.barCol}>
              <View style={styles.barTrack}>
                {fillH > 0 && <View style={[styles.barFill, { height: fillH, backgroundColor: barColor }]} />}
              </View>
              {day.count > 0 && (
                <Typography variant="caption" color={day.isToday ? COLORS.accentRed : COLORS.textInkMuted} style={styles.barCount}>
                  {day.count}
                </Typography>
              )}
              <Typography
                variant="caption"
                color={day.isToday ? COLORS.accentRed : COLORS.textInkMuted}
                style={[styles.barLabel, day.isToday && styles.barLabelToday]}
              >
                {day.label}
              </Typography>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function AnnualStatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.annualItem}>
      <Typography variant="display" color={COLORS.textInk} style={styles.annualValue}>{value}</Typography>
      <Typography variant="caption" color={COLORS.textInkMuted} style={styles.annualLabel}>{label}</Typography>
    </View>
  );
}

function HistoryRow({ entry }: { entry: LibraryEntry }) {
  const router = useRouter();
  const updateProgress = useLibraryStore(s => s.updateProgress);
  const updateStatus = useLibraryStore(s => s.updateStatus);
  const removeEntry = useLibraryStore(s => s.removeEntry);

  const maxChapters = entry.manga.chapters;
  const isCaughtUp = maxChapters != null && entry.progress >= maxChapters;

  const handlePlusOne = () => {
    if (isCaughtUp) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newProgress = entry.progress + 1;
    updateProgress(entry.mangaId, entry.source, newProgress);
    // Finishing the last chapter of a finished series completes the entry
    if (maxChapters != null && newProgress >= maxChapters && entry.manga.status === 'COMPLETED') {
      updateStatus(entry.mangaId, entry.source, 'COMPLETED');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const title = entry.manga.title.english ?? entry.manga.title.romaji ?? entry.manga.title.userPreferred;
  const percent = entry.manga.chapters ? Math.min(entry.progress / entry.manga.chapters, 1) : 0;
  const relative = formatDistanceToNow(new Date(entry.updatedAt), { addSuffix: true, locale: fr });

  const confirmRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    confirmAction({
      title,
      message: 'Retirer cette œuvre de votre historique ?',
      confirmLabel: 'Retirer',
      destructive: true,
      onConfirm: () => removeEntry(entry.mangaId, entry.source),
    });
  };

  return (
    <Pressable
      onPress={() => router.push(`/manga/${encodeURIComponent(entry.mangaId)}?source=${encodeURIComponent(entry.source)}`)}
      onLongPress={confirmRemove}
    >
      <Panel variant="paper" bordered style={styles.row}>
        <View style={styles.rowInner}>
          <View style={styles.rowCoverFrame}>
            <Image
              source={coverSource(entry.manga.coverImage)}
              style={styles.rowCover}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
          <View style={styles.rowInfo}>
            <Typography variant="subheading" numberOfLines={2} color={COLORS.textInk} style={styles.rowTitle}>{title}</Typography>
            <View style={styles.rowMeta}>
              <StatusBadge status={entry.status} compact />
              <Typography variant="label" color={COLORS.textInkMuted}>{relative}</Typography>
              {entry.score ? (
                <StarRating score={entry.score} readonly size={14} showLabel={false} />
              ) : null}
            </View>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percent * 100}%` as `${number}%` }]} />
              </View>
              <Typography variant="label" color={COLORS.textInkMuted} style={styles.progressText}>
                {entry.progress}{entry.manga.chapters ? `/${entry.manga.chapters}` : ''} ch.
              </Typography>
            </View>
          </View>
          {isCaughtUp ? (
            <View style={styles.plusBtnDone}>
              <Ionicons name="checkmark" size={16} color={COLORS.statusCompleted} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.plusBtn}
              onPress={handlePlusOne}
              accessibilityRole="button"
              accessibilityLabel="Marquer le prochain chapitre comme lu"
            >
              <Typography style={styles.plusLabel}>+1</Typography>
            </TouchableOpacity>
          )}
        </View>
      </Panel>
    </Pressable>
  );
}

const bdStatusColor = (s: ReadingStatus): string =>
  ({
    READING: COLORS.cyan,
    COMPLETED: COLORS.statusCompleted,
    PLAN_TO_READ: COLORS.textInkMuted,
    PAUSED: COLORS.statusPaused,
    DROPPED: COLORS.statusDropped,
  })[s];

function BDHistoryRow({ entry }: { entry: BDSeriesEntry }) {
  const router = useRouter();
  const toggleVolumeRead = useComicsStore(s => s.toggleVolumeRead);
  const readCount = entry.readVolumes.length;
  const total = entry.series.totalVolumes;

  // Numéros réels des tomes plutôt qu'une plage 1..total : toutes les séries
  // ne commencent pas au tome 1 et certaines ont des trous.
  const nextVolume = (() => {
    const read = new Set(entry.readVolumes);
    return entry.series.volumes
      .map(v => v.num)
      .sort((a, b) => a - b)
      .find(n => !read.has(n)) ?? null;
  })();

  const handlePlusOne = () => {
    if (nextVolume == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleVolumeRead(entry.seriesId, nextVolume);
  };
  const percent = total > 0 ? Math.min(readCount / total, 1) : 0;
  const relative = formatDistanceToNow(new Date(entry.updatedAt), { addSuffix: true, locale: fr });
  const entryColor = bdStatusColor(entry.status);

  return (
    <Pressable onPress={() => router.push(`/comic/${entry.seriesId}` as never)}>
      <Panel variant="paper" bordered style={styles.row}>
        <View style={styles.rowInner}>
          <View style={styles.rowCoverFrame}>
            {entry.series.coverImage ? (
              <Image source={{ uri: entry.series.coverImage }} style={styles.rowCover} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.rowCover, { backgroundColor: COLORS.paperSunken, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="book" size={18} color={COLORS.textInkMuted} />
              </View>
            )}
          </View>
          <View style={styles.rowInfo}>
            <Typography variant="subheading" numberOfLines={2} color={COLORS.textInk} style={styles.rowTitle}>{entry.series.title}</Typography>
            <View style={styles.rowMeta}>
              <View style={[styles.bdStatusPill, { backgroundColor: `${entryColor}22`, borderColor: `${entryColor}44` }]}>
                <View style={[styles.bdStatusDot, { backgroundColor: entryColor }]} />
                <Typography variant="label" style={[styles.bdStatusLabel, { color: entryColor }]}>
                  {STATUS_LABELS[entry.status]}
                </Typography>
              </View>
              <Typography variant="label" color={COLORS.textInkMuted}>{relative}</Typography>
            </View>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percent * 100}%` as `${number}%`, backgroundColor: entryColor }]} />
              </View>
              <Typography variant="label" color={COLORS.textInkMuted} style={styles.progressText}>
                {readCount}{total > 0 ? `/${total}` : ''} t.
              </Typography>
            </View>
          </View>
          {nextVolume != null ? (
            <TouchableOpacity
              style={[styles.plusBtn, { backgroundColor: COLORS.cyan }]}
              onPress={handlePlusOne}
              accessibilityRole="button"
              accessibilityLabel={`Marquer le tome ${nextVolume} comme lu`}
            >
              <Typography style={styles.plusLabel}>+1</Typography>
            </TouchableOpacity>
          ) : (
            <View style={styles.plusBtnDone}>
              <Ionicons name="checkmark" size={16} color={COLORS.statusCompleted} />
            </View>
          )}
        </View>
      </Panel>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const entries = useLibraryStore(s => s.entries);
  const bdEntries = useComicsStore(s => s.entries);
  const avatar = useLibraryStore(s => s.avatar);
  const setAvatar = useLibraryStore(s => s.setAvatar);
  const banner = useLibraryStore(s => s.banner);
  const setBanner = useLibraryStore(s => s.setBanner);
  const getStats = useLibraryStore(s => s.getStats);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bannerPickerOpen, setBannerPickerOpen] = useState(false);

  // Memoized: getStats builds genre histograms — too heavy for every keystroke.
  // entries is the getter's hidden input, so it must stay in the deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stats = useMemo(() => getStats(), [entries, getStats]);

  const activity = useMemo(() => getReadingActivity(entries), [entries]);
  const streak = useMemo(() => getReadingStreak(activity), [activity]);
  const weekData = useMemo(() => getWeekActivity(activity), [activity]);
  const annualStats = useMemo(() => getAnnualStats(entries), [entries]);
  const currentYear = new Date().getFullYear();

  const featured = entries.find(e => e.manga.bannerImage) ?? entries[0];
  const autoBanner = featured?.manga.bannerImage ?? featured?.manga.coverImage;
  const backdrop = banner ?? autoBanner;

  const visible = useMemo(
    () => entries
      .filter(e => (filter === 'ALL' ? true : e.status === filter))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [entries, filter],
  );

  // Copy of the array before sort — .sort() mutates, and bdEntries IS the
  // persisted Zustand array
  const sortedBdEntries = useMemo(
    () => [...bdEntries].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [bdEntries],
  );

  // TV Time-style time spent: ~4 min per manga chapter, ~30 min per BD album
  const readingTime = useMemo(() => {
    const chapterMinutes = entries.reduce((acc, e) => acc + Math.max(e.progress, e.readChapterIds?.length ?? 0), 0) * 4;
    const volumeMinutes = bdEntries.reduce((acc, e) => acc + e.readVolumes.length, 0) * 30;
    const totalMin = chapterMinutes + volumeMinutes;
    return {
      days: Math.floor(totalMin / 1440),
      hours: Math.floor((totalMin % 1440) / 60),
      minutes: totalMin % 60,
    };
  }, [entries, bdEntries]);

  // Mixed manga + BD favorites, most recently touched first
  const favorites = useMemo(() => {
    const mangaFavs = entries
      .filter(e => e.favorite)
      .map(e => ({
        key: `m-${e.mangaId}-${e.source}`,
        title: e.manga.title.english ?? e.manga.title.userPreferred,
        cover: e.manga.coverImage as string | undefined,
        href: `/manga/${encodeURIComponent(e.mangaId)}?source=${encodeURIComponent(e.source)}`,
        updatedAt: e.updatedAt,
      }));
    const bdFavs = bdEntries
      .filter(e => e.favorite)
      .map(e => ({
        key: `bd-${e.seriesId}`,
        title: e.series.title,
        cover: e.series.coverImage,
        href: `/comic/${e.seriesId}`,
        updatedAt: e.updatedAt,
      }));
    return [...mangaFavs, ...bdFavs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [entries, bdEntries]);

  const statuses: ReadingStatus[] = ['READING', 'COMPLETED', 'PLAN_TO_READ', 'PAUSED', 'DROPPED'];

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom }}
      >
        {/* Ink hero */}
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" />
          ) : null}
          <LinearGradient
            colors={[inkScrim(0.3), inkScrim(0.8), COLORS.ink]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <Pressable
            style={[styles.settingsBtn, { top: insets.top + SPACING.sm }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings' as never);
            }}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les paramètres"
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={16} color={COLORS.onInk} />
          </Pressable>
          <Pressable
            style={[styles.bannerEditBtn, { top: insets.top + SPACING.sm }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setBannerPickerOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Changer le fond de profil"
            hitSlop={8}
          >
            <Ionicons name="image-outline" size={15} color={COLORS.onInk} />
            <Typography variant="kicker" color={COLORS.onInk} style={styles.bannerEditLabel}>
              FOND
            </Typography>
          </Pressable>
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={styles.heroContent}
          >
            <Pressable
              style={styles.avatar}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPickerOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Changer la photo de profil"
            >
              <View style={styles.avatarClip}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <Typography style={styles.avatarEmoji}>📖</Typography>
                )}
              </View>
              <View style={styles.avatarEditBadge}>
                <Ionicons name="pencil" size={13} color={COLORS.onInk} />
              </View>
            </Pressable>
            <Typography variant="kicker" color={COLORS.accentRed}>LECTEUR MANGA</Typography>
            <Typography variant="hero" color={COLORS.onInk} style={styles.username}>
              Ma Bibliothèque
            </Typography>
          </MotiView>
        </View>

        {/* Stats strip — ink world */}
        <View style={styles.statStrip}>
          <StatPill value={stats.totalEntries} label="MANGA" />
          <View style={styles.statDivider} />
          <StatPill value={bdEntries.length} label="SÉRIES BD" />
          <View style={styles.statDivider} />
          <StatPill value={stats.chaptersRead} label="CHAPITRES" />
        </View>

        {/* TV Time-style reading time */}
        {(readingTime.days > 0 || readingTime.hours > 0 || readingTime.minutes > 0) && (
          <View style={styles.timeStrip}>
            <Typography variant="kicker" color={COLORS.onInkMuted} style={styles.timeStripLabel}>
              TEMPS PASSÉ À LIRE
            </Typography>
            <View style={styles.timeStripRow}>
              {readingTime.days > 0 && (
                <View style={styles.timeUnit}>
                  <Typography variant="display" color={COLORS.onInk} style={styles.timeValue}>{readingTime.days}</Typography>
                  <Typography variant="caption" color={COLORS.onInkMuted}>JOURS</Typography>
                </View>
              )}
              <View style={styles.timeUnit}>
                <Typography variant="display" color={COLORS.onInk} style={styles.timeValue}>{readingTime.hours}</Typography>
                <Typography variant="caption" color={COLORS.onInkMuted}>HEURES</Typography>
              </View>
              <View style={styles.timeUnit}>
                <Typography variant="display" color={COLORS.onInk} style={styles.timeValue}>{readingTime.minutes}</Typography>
                <Typography variant="caption" color={COLORS.onInkMuted}>MINUTES</Typography>
              </View>
            </View>
          </View>
        )}

        <View style={styles.body}>
          {favorites.length > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 160 }}
            >
              <View style={styles.libraryHeaderRow}>
                <Ionicons name="heart" size={16} color={COLORS.accentRed} />
                <Typography variant="title" color={COLORS.textInk}>Préférés</Typography>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favRail}>
                {favorites.map(fav => (
                  <Pressable
                    key={fav.key}
                    style={({ pressed }) => [styles.favCard, pressed && { opacity: 0.8 }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(fav.href as never);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={fav.title}
                  >
                    <View style={styles.favCoverFrame}>
                      {fav.cover ? (
                        <Image source={coverSource(fav.cover)} style={styles.favCover} contentFit="cover" cachePolicy="memory-disk" />
                      ) : (
                        <View style={[styles.favCover, styles.favCoverEmpty]}>
                          <Ionicons name="book" size={20} color={COLORS.textInkMuted} />
                        </View>
                      )}
                    </View>
                    <Typography variant="caption" color={COLORS.textInk} numberOfLines={1} style={styles.favTitle}>
                      {fav.title}
                    </Typography>
                  </Pressable>
                ))}
              </ScrollView>
            </MotiView>
          )}
          {stats.totalEntries > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 200 }}
            >
              <Panel variant="paper" bordered style={styles.section}>
                <View style={styles.sectionInner}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionMarker} />
                    <Typography variant="title" color={COLORS.textInk}>Statistiques</Typography>
                  </View>

                  {/* Weekly activity bar chart + reading streak */}
                  <WeeklyActivityChart weekData={weekData} streak={streak} />

                  {/* Annual recap */}
                  {(annualStats.chaptersThisYear > 0 || annualStats.seriesStarted > 0) && (
                    <View>
                      <View style={[styles.sectionHeaderRow, styles.annualHeaderRow]}>
                        <View style={[styles.sectionMarker, { backgroundColor: COLORS.cyan }]} />
                        <Typography variant="label" color={COLORS.textInkMuted} style={styles.annualYearLabel}>
                          BILAN {currentYear}
                        </Typography>
                      </View>
                      <View style={styles.annualRow}>
                        {annualStats.chaptersThisYear > 0 && (
                          <AnnualStatItem value={annualStats.chaptersThisYear} label="chapitres" />
                        )}
                        {annualStats.seriesStarted > 0 && (
                          <AnnualStatItem value={annualStats.seriesStarted} label="démarrées" />
                        )}
                        {annualStats.seriesCompleted > 0 && (
                          <AnnualStatItem value={annualStats.seriesCompleted} label="terminées" />
                        )}
                        {annualStats.averageScore > 0 && (
                          <AnnualStatItem
                            value={`${(annualStats.averageScore / 20).toFixed(1)}★`}
                            label="note moy."
                          />
                        )}
                      </View>
                    </View>
                  )}

                  <View style={styles.statusBars}>
                    {statuses.map(s => (
                      stats.byStatus[s] > 0 && (
                        <StatusBar key={s} status={s} count={stats.byStatus[s]} total={stats.totalEntries} />
                      )
                    ))}
                  </View>
                  {stats.topGenres.length > 0 && (
                    <View style={styles.genresWrap}>
                      {stats.topGenres.slice(0, 6).map(({ genre, count }) => (
                        <View key={genre} style={styles.genreChip}>
                          <Typography variant="label" color={COLORS.accentRed}>{genre}</Typography>
                          <Typography variant="label" color={COLORS.textInkMuted}>{count}</Typography>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </Panel>
            </MotiView>
          )}

          <View style={styles.libraryHeaderRow}>
            <View style={styles.sectionMarker} />
            <Typography variant="title" color={COLORS.textInk}>Ma bibliothèque</Typography>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabs}
            style={styles.filterScroll}
          >
            {FILTERS.map(({ key, label }) => (
              <Pressable
                key={key}
                style={[styles.filterTab, filter === key && styles.filterTabActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFilter(key);
                }}
              >
                <Typography
                  variant="label"
                  color={filter === key ? COLORS.accentRed : COLORS.textInkMuted}
                >
                  {label}
                </Typography>
              </Pressable>
            ))}
          </ScrollView>

          {visible.length === 0 ? (
            <Panel variant="paper" bordered style={styles.emptyCard}>
              <View style={styles.emptyInner}>
                <Typography style={styles.emptyEmoji}>🌸</Typography>
                <Typography variant="heading" color={COLORS.textInk} style={styles.emptyTitle}>
                  {entries.length === 0 ? 'Votre aventure commence ici' : 'Aucune œuvre ici'}
                </Typography>
                <Typography variant="body" color={COLORS.textInkMuted} style={styles.emptyText}>
                  {entries.length === 0
                    ? "Ajoutez des œuvres à votre bibliothèque depuis l'onglet Rechercher."
                    : 'Aucune œuvre ne correspond à ce filtre pour le moment.'}
                </Typography>
              </View>
            </Panel>
          ) : (
            <View style={styles.list}>
              {visible.map((entry, index) => (
                <MotiView
                  key={`${entry.source}-${entry.mangaId}`}
                  from={{ opacity: 0, translateY: 12 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: Math.min(index, 8) * 45 }}
                >
                  <HistoryRow entry={entry} />
                </MotiView>
              ))}
            </View>
          )}

          {/* BD & Comics section */}
          {bdEntries.length > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 100 }}
            >
              <View style={[styles.libraryHeaderRow, styles.bdHeaderRow]}>
                <View style={[styles.sectionMarker, { backgroundColor: COLORS.cyan }]} />
                <Typography variant="title" color={COLORS.textInk}>BD & Comics</Typography>
                <View style={styles.bdCountBadge}>
                  <Typography variant="caption" color={COLORS.onInk} style={styles.bdCountText}>
                    {bdEntries.reduce((acc, e) => acc + e.readVolumes.length, 0)} tomes lus
                  </Typography>
                </View>
              </View>
              <View style={styles.list}>
                {sortedBdEntries.map((entry, index) => (
                    <MotiView
                      key={entry.seriesId}
                      from={{ opacity: 0, translateY: 12 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: Math.min(index, 8) * 45 }}
                    >
                      <BDHistoryRow entry={entry} />
                    </MotiView>
                ))}
              </View>
            </MotiView>
          )}
        </View>
      </ScrollView>

      <AvatarPicker
        visible={pickerOpen}
        current={avatar}
        onSelect={setAvatar}
        onClose={() => setPickerOpen(false)}
      />

      <BannerPicker
        visible={bannerPickerOpen}
        current={banner}
        entries={entries}
        onSelect={setBanner}
        onClose={() => setBannerPickerOpen(false)}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  hero: {
    height: 280,
    backgroundColor: COLORS.ink,
    justifyContent: 'flex-end',
  },
  heroContent: {
    alignItems: 'center',
    gap: SPACING.xs,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.base,
  },
  avatar: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  avatarClip: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.inkSoft,
    borderWidth: BORDERS.heavy,
    borderColor: COLORS.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
  },
  avatarEmoji: { fontSize: 38, lineHeight: 44 },
  username: { fontSize: 28, lineHeight: 30 },
  bannerEditBtn: {
    position: 'absolute',
    right: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: SCRIMS.medium,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: BORDERS.hair,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  bannerEditLabel: { letterSpacing: 1.2, fontSize: 9 },
  settingsBtn: {
    position: 'absolute',
    left: SPACING.base,
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: SCRIMS.medium,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.lineOnInk,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.ink,
  },
  statPill: { alignItems: 'center', gap: 4, flex: 1 },
  statValue: { fontSize: 32, lineHeight: 34, letterSpacing: 1 },
  statLabel: { letterSpacing: 1, fontSize: 10 },
  statDivider: { width: BORDERS.hair, height: 32, backgroundColor: COLORS.lineOnInk },

  timeStrip: {
    backgroundColor: COLORS.ink,
    borderTopWidth: BORDERS.hair,
    borderTopColor: COLORS.lineOnInk,
    paddingVertical: SPACING.base,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeStripLabel: { letterSpacing: 2, fontSize: 10 },
  timeStripRow: { flexDirection: 'row', gap: SPACING.xl },
  timeUnit: { alignItems: 'center', gap: 2 },
  timeValue: { fontSize: 28, lineHeight: 30, letterSpacing: 1 },

  // Weekly activity chart
  chartContainer: { gap: SPACING.sm },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { letterSpacing: 1.2, fontSize: 10 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.star}1A`,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
    borderWidth: BORDERS.hair,
    borderColor: `${COLORS.star}44`,
  },
  streakLabel: { fontSize: 12 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 76 },
  barCol: { flex: 1, alignItems: 'center', gap: 3, justifyContent: 'flex-end' },
  barTrack: {
    width: '100%',
    height: 44,
    justifyContent: 'flex-end',
    borderRadius: 3,
    backgroundColor: COLORS.paperSunken,
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 3 },
  barCount: { fontSize: 9, letterSpacing: 0 },
  barLabel: { fontSize: 10, letterSpacing: 0 },
  barLabelToday: { fontFamily: FONTS.bodyBold },
  // Annual recap
  annualHeaderRow: { marginTop: SPACING.xs },
  annualYearLabel: { letterSpacing: 1.5, fontSize: 10 },
  annualRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  annualItem: { minWidth: 64, gap: 2 },
  annualValue: { fontSize: 22, lineHeight: 24, letterSpacing: 0.5 },
  annualLabel: { fontSize: 10, letterSpacing: 0.5 },

  favRail: { gap: SPACING.md, paddingTop: SPACING.base },
  favCard: { width: 92, gap: SPACING.xs },
  favCoverFrame: {
    borderRadius: RADIUS.sm,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
  },
  favCover: { width: 88, height: 124 },
  favCoverEmpty: { backgroundColor: COLORS.paperSunken, alignItems: 'center', justifyContent: 'center' },
  favTitle: { textAlign: 'center' },

  body: { paddingHorizontal: SPACING.base, paddingTop: SPACING.lg, gap: SPACING.lg },
  section: { borderRadius: RADIUS.lg },
  sectionInner: { padding: SPACING.base, gap: SPACING.md },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionMarker: { width: 4, height: 20, backgroundColor: COLORS.accentRed, borderRadius: 2 },
  statusBars: { gap: SPACING.md },
  statusBarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusBarLabel: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, width: 96 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: COLORS.paperSunken,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  statusBarFill: { borderRadius: 3 },
  statusCount: { width: 24, textAlign: 'right', fontSize: 12 },
  genresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentSoft,
    borderWidth: BORDERS.hair,
    borderColor: `${COLORS.accentRed}44`,
  },
  libraryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: -SPACING.sm,
    flexWrap: 'wrap',
  },
  // Inside the BD MotiView there is no parent gap to absorb the negative
  // margin above — without this override the first card overlaps the title.
  bdHeaderRow: { marginBottom: SPACING.md },
  bdCountBadge: {
    backgroundColor: COLORS.cyan,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginLeft: SPACING.xs,
  },
  bdCountText: { fontSize: 9, letterSpacing: 0.6 },
  bdStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  bdStatusDot: { width: 6, height: 6, borderRadius: 3 },
  bdStatusLabel: { fontSize: 11, fontWeight: '600' },
  filterScroll: { flexGrow: 0, marginHorizontal: -SPACING.base },
  filterTabs: { paddingHorizontal: SPACING.base, gap: SPACING.sm },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.line,
  },
  filterTabActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentRed,
  },
  list: { gap: SPACING.md },
  row: { borderRadius: RADIUS.lg },
  rowInner: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.md, alignItems: 'center' },
  rowCoverFrame: {
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  rowCover: { width: 52, height: 74, backgroundColor: COLORS.paperSunken },
  rowInfo: { flex: 1, gap: SPACING.xs },
  rowTitle: { fontSize: 14, lineHeight: 18 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.paperSunken,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.accentRed, borderRadius: 2 },
  progressText: { fontSize: 11, minWidth: 56 },
  plusBtn: {
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusLabel: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.onInk, letterSpacing: 0.5 },
  plusBtnDone: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: { borderRadius: RADIUS.xl },
  emptyInner: { padding: SPACING.xl, alignItems: 'center', gap: SPACING.md },
  emptyEmoji: { fontSize: 48, lineHeight: 56 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center' },
}));
