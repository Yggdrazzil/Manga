import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as anilist from '@/lib/api/anilist';
import * as mangadex from '@/lib/api/mangadex';
import { findMangadexId } from '@/lib/api/mangadex';
import * as comick from '@/lib/api/comick';
import * as mangaplus from '@/lib/api/mangaplus';
import * as webtoon from '@/lib/api/webtoon';
import * as jikan from '@/lib/api/jikan';
import { resolveFallbackFeed } from '@/lib/api/readingFallback';
import { findLocalManga, findLocalWebtoon } from '@/lib/catalogue/manga';
import { useLibraryStore } from '@/lib/store/library';
import { useSettingsStore } from '@/lib/store/settings';
import { confirmAction } from '@/lib/utils/confirm';
import { Panel } from '@/components/ui/Panel';
import { Halftone } from '@/components/ui/Halftone';
import { StarRating } from '@/components/ui/StarRating';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { Typography } from '@/components/ui/Typography';
import { ChapterList } from '@/components/manga/ChapterList';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, STATUS_LABELS, inkScrim, themedStyles } from '@/constants/theme';
import type { Manga, MangaChapter, MangaCharacter, ReadingStatus } from '@/lib/types';
import { coverSource } from '@/lib/utils/images';

const STATUSES: ReadingStatus[] = ['READING', 'PLAN_TO_READ', 'COMPLETED', 'PAUSED', 'DROPPED'];

type ActiveTab = 'about' | 'chapters';

const SPRING = { stiffness: 300, damping: 26 };

function DescriptionText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const maxChars = 240;
  const shouldTruncate = text.length > maxChars;
  const displayed = shouldTruncate && !expanded ? `${text.slice(0, maxChars)}…` : text;

  return (
    <View>
      <Typography variant="body" color={COLORS.textInkMuted} style={styles.description}>
        {displayed}
      </Typography>
      {shouldTruncate && (
        <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandBtn} hitSlop={8}>
          <Typography variant="label" color={COLORS.accentRed}>
            {expanded ? 'Voir moins ↑' : 'Voir plus ↓'}
          </Typography>
        </Pressable>
      )}
    </View>
  );
}

function TrackingPanel({ manga, totalChapters, readCount }: {
  manga: Manga;
  totalChapters: number;
  readCount: number;
}) {
  const addEntry = useLibraryStore(s => s.addEntry);
  const updateStatus = useLibraryStore(s => s.updateStatus);
  const updateScore = useLibraryStore(s => s.updateScore);
  const updateEntry = useLibraryStore(s => s.updateEntry);
  const removeEntry = useLibraryStore(s => s.removeEntry);
  const entry = useLibraryStore(s =>
    s.entries.find(e => e.mangaId === manga.id && e.source === manga.source),
  );
  const [notes, setNotes] = useState(entry?.notes ?? '');
  // Keep local notes in sync when entry changes (e.g. entry removed then re-added)
  React.useEffect(() => { setNotes(entry?.notes ?? ''); }, [entry?.notes]);

  const handleAddWithStatus = (status: ReadingStatus) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (entry) {
      updateStatus(manga.id, manga.source, status);
    } else {
      addEntry(manga, status);
    }
  };

  const progressPct = totalChapters > 0 ? Math.min(readCount / totalChapters, 1) : 0;

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    confirmAction({
      title: 'Retirer',
      message: 'Retirer de votre bibliothèque ?',
      confirmLabel: 'Retirer',
      destructive: true,
      onConfirm: () => {
        removeEntry(manga.id, manga.source);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      },
    });
  };

  return (
    <Panel variant="paper" bordered hardShadow style={styles.trackingCard}>
      <View style={styles.trackingInner}>
        <View style={styles.trackingTitleRow}>
          <View style={styles.sectionMarker} />
          <Typography variant="heading" color={COLORS.textInk}>
            {entry ? 'Votre suivi' : 'Ajouter à la bibliothèque'}
          </Typography>
        </View>

        <View style={styles.statusPicker}>
          {STATUSES.map(status => (
            <Pressable
              key={status}
              style={[
                styles.statusBtn,
                entry?.status === status && styles.statusBtnActive,
              ]}
              onPress={() => handleAddWithStatus(status)}
            >
              <Typography
                variant="label"
                style={[
                  styles.statusBtnLabel,
                  entry?.status === status && styles.statusBtnLabelActive,
                ]}
              >
                {STATUS_LABELS[status]}
              </Typography>
            </Pressable>
          ))}
        </View>

        {entry && (
          <>
            {/* Work-level rating (Kitsu-style — one score per œuvre, no per-chapter) */}
            <View style={styles.ratingSection}>
              <View style={styles.ratingSectionHeader}>
                <View style={styles.sectionMarker} />
                <Typography variant="subheading" color={COLORS.textInk}>Ma note</Typography>
              </View>
              <StarRating
                score={entry.score}
                onRate={score => updateScore(manga.id, manga.source, score)}
              />
            </View>

            {totalChapters > 0 && (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Typography variant="subheading" color={COLORS.textInk}>
                    Progression
                  </Typography>
                  <Typography variant="label" color={COLORS.textInkMuted}>
                    {readCount} / {totalChapters} chapitres
                  </Typography>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPct * 100}%` as `${number}%` }]} />
                </View>
              </View>
            )}

            {/* Journal de lecture */}
            <View style={styles.notesSection}>
              <View style={styles.ratingSectionHeader}>
                <View style={styles.sectionMarker} />
                <Typography variant="subheading" color={COLORS.textInk}>Notes</Typography>
              </View>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                onBlur={() => updateEntry(manga.id, manga.source, { notes })}
                placeholder="Vos impressions sur cette œuvre…"
                placeholderTextColor={COLORS.textInkMuted}
                multiline
                numberOfLines={3}
                accessibilityLabel="Journal de lecture"
              />
            </View>

            <Pressable onPress={handleRemove} style={styles.removeBtn} hitSlop={8}>
              <Typography variant="label" color={COLORS.error}>
                Retirer de la bibliothèque
              </Typography>
            </Pressable>
          </>
        )}
      </View>
    </Panel>
  );
}

function LoadingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <View style={styles.backBtnInner}>
          <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
        </View>
      </Pressable>
      <ActivityIndicator color={COLORS.accentRed} size="large" style={{ flex: 1 }} />
    </View>
  );
}


export default function MangaDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { id, source } = useLocalSearchParams<{ id: string; source: string }>();
  const [activeTab, setActiveTab] = useState<ActiveTab>('about');
  // Seeded from the user's preferred scan language (Paramètres > Lecture)
  const preferredLang = useSettingsStore(s => s.scanLang);
  const [readLang, setReadLang] = useState<'fr' | 'en'>(preferredLang);

  // Référentiellement stable : une fonction recréée à chaque render forcerait
  // TanStack Query à la rappeler à chaque fois, donc à matérialiser le
  // catalogue de 4 Mo pendant l'animation de navigation.
  const cataloguePlaceholder = useMemo(() => {
    if (!id) return undefined;
    if (source === 'webtoon') return findLocalWebtoon(id) ?? undefined;
    if (!source || source === 'anilist') return findLocalManga(id) ?? undefined;
    return undefined;
  }, [id, source]);

  const { data: manga, isLoading, isError } = useQuery({
    queryKey: ['manga-detail', id, source],
    queryFn: async () => {
      if (!id) throw new Error('No ID');
      if (source === 'mangadex') return mangadex.getMangaById(id);
      if (source === 'comick') return comick.getMangaById(id);
      if (source === 'mangaplus') return mangaplus.getMangaById(id);
      if (source === 'webtoon') return webtoon.getMangaById(id);
      if (source === 'jikan') return jikan.getMangaById(id);
      return anilist.getMangaById(id);
    },
    enabled: !!id,
    // Instant first paint from the bundled catalogue (title, cover, synopsis)
    // while the live API loads the authoritative record.
    placeholderData: cataloguePlaceholder,
  });

  const searchTitle = manga
    ? (manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred)
    : '';

  // For non-MangaDex/Comick sources, try to resolve a MangaDex ID for chapter data
  const directMdId = manga
    ? (manga.source === 'mangadex' ? manga.id : manga.mangadexId ?? null)
    : null;
  const isComick = manga?.source === 'comick';
  const isMangaPlus = manga?.source === 'mangaplus';
  const isWebtoon = manga?.source === 'webtoon';
  // Sources that ship their own chapter feed don't need a MangaDex fallback.
  const isSelfSourced = isComick || isMangaPlus || isWebtoon;

  const mdResolveQuery = useQuery({
    queryKey: ['resolve-mdid', manga?.source, manga?.id, manga?.year],
    queryFn: () => findMangadexId(searchTitle, manga?.year ? { year: manga.year } : undefined),
    enabled: !!manga && !directMdId && !isSelfSourced && !!searchTitle,
    staleTime: 1000 * 60 * 60,
  });
  const resolvedMdId = mdResolveQuery.data;
  const effectiveMdId = directMdId ?? resolvedMdId ?? null;
  const mdResolveDone =
    !!directMdId || isSelfSourced || mdResolveQuery.isSuccess || mdResolveQuery.isError;

  // Available reading languages: from MangaDex/Comick metadata when known
  const mangaReadLangs = useMemo<Array<'fr' | 'en'>>(() => {
    const fromManga = (manga?.availableReadingLanguages ?? []) as Array<'fr' | 'en'>;
    return fromManga.filter(l => l === 'fr' || l === 'en');
  }, [manga?.availableReadingLanguages]);

  // When user explicitly picked a language, fetch only that lang so readable flags reflect choice.
  // Otherwise: preferred language first, the other as fallback for missing chapters.
  const langParam = useMemo<string[] | undefined>(() => {
    if (mangaReadLangs.length <= 1) {
      return preferredLang === 'en' ? ['en', 'fr'] : undefined;
    }
    return readLang === 'fr' ? ['fr', 'en'] : ['en', 'fr'];
  }, [readLang, mangaReadLangs, preferredLang]);

  // Comick, MangaPlus and Webtoon have their own chapter feeds; others use MangaDex
  const selfKey = isComick ? `ck-${id}` : isMangaPlus ? `mp-${id}` : isWebtoon ? `wt-${id}` : effectiveMdId;
  const chaptersEnabled = isSelfSourced ? !!manga : !!effectiveMdId;
  const { data: chapters } = useQuery({
    queryKey: ['tracking-chapters', selfKey, readLang, mangaReadLangs.length],
    queryFn: () => {
      if (isComick) return comick.getTrackingChapters(id!, langParam);
      if (isMangaPlus) return mangaplus.getTrackingChapters(id!);
      if (isWebtoon) return webtoon.getTrackingChapters(id!);
      return mangadex.getTrackingChapters(effectiveMdId!, langParam);
    },
    enabled: chaptersEnabled,
    staleTime: 1000 * 60 * 5,
  });

  // MangaDex came back with nothing readable (or no MangaDex entry exists at
  // all — One Piece, Solo Leveling, …): look the work up on MangaPlus /
  // Comick / Webtoon and read from there instead.
  const primaryHasReadable = (chapters ?? []).some(c => c.isReadable);
  const needFallback =
    !!manga &&
    !isSelfSourced &&
    mdResolveDone &&
    (effectiveMdId ? chapters != null && !primaryHasReadable : true);
  const fallbackQuery = useQuery({
    queryKey: ['reading-fallback', manga?.source, manga?.id, readLang],
    queryFn: () => resolveFallbackFeed(manga!, langParam),
    enabled: needFallback,
    staleTime: 1000 * 60 * 30,
  });
  const fallbackFeed = fallbackQuery.data;
  const fallbackInUse = needFallback && !!fallbackFeed;
  // Resolved with `null` (nothing found) ≠ still loading — only the latter
  // should hold the tab open.
  const fallbackPending =
    needFallback && fallbackFeed === undefined && !fallbackQuery.isError;

  // Characters + recommendations rails (AniList catalogue only)
  const { data: extras } = useQuery({
    queryKey: ['manga-extras', id],
    queryFn: () => anilist.getMangaExtras(id!),
    enabled: !!id && source === 'anilist',
    staleTime: 1000 * 60 * 30,
  });

  // Build the chapter list: real readable chapters when available, otherwise
  // synthesize one card per chapter from the API's total count (TV-Time style).
  const displayChapters = useMemo<MangaChapter[]>(() => {
    if (chapters?.some(c => c.isReadable)) return chapters;
    if (fallbackInUse && fallbackFeed.chapters.length > 0) return fallbackFeed.chapters;
    if (chapters && chapters.length > 0) return chapters;
    const count = manga?.chapters ?? 0;
    if (!manga || count <= 0) return [];
    return Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      return {
        id: `${manga.id}-syn-${n}`,
        mangaId: manga.id,
        chapter: String(n),
        pages: 0,
        publishAt: '',
        translatedLanguage: '',
        isReadable: false,
      } satisfies MangaChapter;
    });
  }, [chapters, fallbackInUse, fallbackFeed, manga]);

  // Which adapter the reader fetches pages from. Undefined = entry source
  // (self-sourced feeds) or the MangaDex default.
  const pagesSource = fallbackInUse ? fallbackFeed.source : undefined;

  const entry = useLibraryStore(s =>
    manga ? s.entries.find(e => e.mangaId === manga.id && e.source === manga.source) : undefined,
  );
  const toggleFavorite = useLibraryStore(s => s.toggleFavorite);
  const readCount = useMemo(() => {
    if (!entry) return 0;
    const ids = entry.readChapterIds ?? [];
    if (displayChapters.length > 0) {
      return displayChapters.filter(
        ch => ids.includes(ch.id) || (Number.isFinite(parseFloat(ch.chapter)) && parseFloat(ch.chapter) <= entry.progress),
      ).length;
    }
    return entry.progress;
  }, [entry, displayChapters]);

  // Detect available reading languages from loaded chapters as fallback (covers AniList/Jikan sources)
  const detectedReadLangs = useMemo<Array<'fr' | 'en'>>(() => {
    if (mangaReadLangs.length > 0) return mangaReadLangs;
    const loaded = fallbackInUse ? fallbackFeed.chapters : chapters;
    if (!loaded) return [];
    const langs = new Set(
      loaded.filter(c => c.isReadable).map(c => c.translatedLanguage)
    );
    return (['fr', 'en'] as const).filter(l => langs.has(l));
  }, [mangaReadLangs, chapters, fallbackInUse, fallbackFeed]);

  // The read tab only shows chapters that open in the reader (fr/en uploads).
  // Hide it when nothing is readable — synthetic/aggregate-only cards stay
  // checkable from the À propos tab but must never reach the reader.
  // Keep it visible while the primary feed or the fallback lookup is running,
  // so it doesn't flash in and out before settling.
  const showChaptersTab = displayChapters.some(ch => ch.isReadable)
    || (chaptersEnabled && chapters == null)
    || (!!manga && !isSelfSourced && !mdResolveDone)
    || fallbackPending;
  const totalChapters = displayChapters.length || manga?.chapters || 0;

  if (isLoading) return <LoadingScreen />;

  if (isError || !manga) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Pressable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
          </View>
        </Pressable>
        <View style={styles.errorState}>
          <Halftone opacity={0.04} />
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.textInkMuted} />
          <Typography variant="heading" color={COLORS.textInk}>Impossible de charger</Typography>
          <Typography variant="body" color={COLORS.textInkMuted}>Une erreur s&apos;est produite. Réessayez.</Typography>
        </View>
      </View>
    );
  }

  const displayTitle = manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred;
  const currentTab: ActiveTab = showChaptersTab ? activeTab : 'about';

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => router.back()}
      >
        <View style={styles.backBtnInner}>
          <Ionicons name="chevron-down" size={22} color={COLORS.onInk} />
        </View>
      </Pressable>

      {entry && (
        <Pressable
          style={[styles.favBtn, { top: insets.top + 8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleFavorite(manga.id, manga.source);
          }}
          accessibilityRole="button"
          accessibilityLabel={entry.favorite ? 'Retirer des préférés' : 'Ajouter aux préférés'}
          accessibilityState={{ selected: !!entry.favorite }}
        >
          <View style={styles.backBtnInner}>
            <Ionicons
              name={entry.favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={entry.favorite ? COLORS.accentBright : COLORS.onInk}
            />
          </View>
        </Pressable>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Ink hero */}
        <View style={styles.hero}>
          <Image
            source={coverSource(manga.bannerImage ?? manga.coverImage)}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={[inkScrim(0.15), inkScrim(0.7), COLORS.ink]}
            locations={[0.2, 0.6, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.heroBottom, { paddingTop: insets.top + 56 }]}>
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 100 }}
            >
              <View style={styles.heroMeta}>
                <TypeBadge type={manga.type} />
                <Typography variant="kicker" color={COLORS.onInkMuted}>
                  {manga.year ?? '—'} · {manga.status === 'ONGOING' ? 'En cours' : manga.status === 'COMPLETED' ? 'Terminé' : manga.status}
                </Typography>
              </View>
              <Typography variant="hero" color={COLORS.onInk} style={styles.heroTitle} numberOfLines={3}>
                {displayTitle}
              </Typography>
            </MotiView>
          </View>
        </View>

        {/* Underline tab bar */}
        {showChaptersTab && (
          <View style={styles.tabBar}>
            {(['about', 'chapters'] as const).map(tab => {
              const isActive = currentTab === tab;
              const label = tab === 'about' ? 'À PROPOS' : 'CHAPITRES';
              return (
                <Pressable
                  key={tab}
                  style={styles.tabItem}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveTab(tab);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={label}
                >
                  <Typography
                    variant="kicker"
                    style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                  >
                    {label}
                  </Typography>
                </Pressable>
              );
            })}
            <View style={styles.tabUnderline}>
              <TabUnderlineIndicator activeTab={currentTab} />
            </View>
          </View>
        )}

        {/* À PROPOS */}
        {currentTab === 'about' && (
          <MotiView
            key="tab-about"
            from={reduceMotion ? { opacity: 1, translateX: 0 } : { opacity: 0, translateX: -16 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            style={styles.content}
          >
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 140 }}
            >
              <Panel variant="paper" bordered style={styles.infoCard}>
                <View style={styles.infoGrid}>
                  <InfoItem label="Auteur(s)" value={manga.authors.join(', ') || '—'} />
                  <InfoItem label="Chapitres" value={manga.chapters ? String(manga.chapters) : '—'} />
                  <InfoItem label="Volumes" value={manga.volumes ? String(manga.volumes) : '—'} />
                  <InfoItem
                    label="Score"
                    value={manga.averageScore ? `${(manga.averageScore / 10).toFixed(1)}/10` : '—'}
                    highlight
                  />
                </View>
              </Panel>
            </MotiView>

            {manga.genres.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 200 }}
              >
                <View style={styles.genresWrap}>
                  {manga.genres.map(g => (
                    <View key={g} style={styles.genreChip}>
                      <Typography variant="label" color={COLORS.accentRed}>{g}</Typography>
                    </View>
                  ))}
                </View>
              </MotiView>
            )}

            {manga.description && (
              <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 260 }}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionMarker} />
                  <Typography variant="title" color={COLORS.textInk}>Synopsis</Typography>
                </View>
                <DescriptionText text={manga.description} />
              </MotiView>
            )}

            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 320 }}
            >
              <TrackingPanel
                manga={manga}
                totalChapters={totalChapters}
                readCount={readCount}
              />
            </MotiView>

            {manga.externalLinks && manga.externalLinks.length > 0 && (
              <View>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionMarker} />
                  <Typography variant="title" color={COLORS.textInk}>Où lire</Typography>
                </View>
                <View style={styles.readLinksWrap}>
                  {manga.externalLinks.map(link => (
                    <Pressable
                      key={link.url}
                      style={({ pressed }) => [styles.readLinkChip, pressed && { opacity: 0.7 }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Linking.openURL(link.url);
                      }}
                      accessibilityRole="link"
                      accessibilityLabel={`Lire sur ${link.site}`}
                    >
                      <Ionicons name="open-outline" size={13} color={COLORS.onInk} />
                      <Typography variant="label" color={COLORS.onInk}>{link.site}</Typography>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {extras && extras.characters.length > 0 && (
              <CharacterRail characters={extras.characters} />
            )}

            {extras && extras.recommendations.length > 0 && (
              <RecommendationRail recommendations={extras.recommendations} />
            )}

            {entry && displayChapters.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 25, delay: 380 }}
              >
                <ChapterList
                  chapters={displayChapters}
                  entryMangaId={manga.id}
                  source={manga.source}
                  pagesSource={pagesSource}
                  manga={manga}
                  mode="track"
                />
              </MotiView>
            )}
          </MotiView>
        )}

        {/* CHAPITRES */}
        {currentTab === 'chapters' && (
          <MotiView
            key="tab-chapters"
            from={reduceMotion ? { opacity: 1, translateX: 0 } : { opacity: 0, translateX: 16 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            style={[styles.chaptersContent, { paddingBottom: insets.bottom + 88 }]}
          >
            <ChapterList
              chapters={displayChapters}
              entryMangaId={manga.id}
              source={manga.source}
              pagesSource={pagesSource}
              manga={manga}
              mode="read"
              activeLang={readLang}
              availableLangs={detectedReadLangs.length > 1 ? detectedReadLangs : undefined}
              onLangChange={setReadLang}
            />
          </MotiView>
        )}
      </ScrollView>
    </View>
  );
}

function TabUnderlineIndicator({ activeTab }: { activeTab: ActiveTab }) {
  const x = useSharedValue(0);
  x.value = withSpring(activeTab === 'chapters' ? 1 : 0, SPRING);
  const style = useAnimatedStyle(() => ({
    left: `${x.value * 50}%` as `${number}%`,
    width: '50%',
  }));
  return <Animated.View style={[styles.tabLineIndicator, style]} />;
}

// TV Time-style "Distribution" rail — main cast of the work
function CharacterRail({ characters }: { characters: MangaCharacter[] }) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionMarker} />
        <Typography variant="title" color={COLORS.textInk}>Personnages</Typography>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
        {characters.map(c => (
          <View key={c.id} style={styles.characterCard}>
            <View style={styles.characterImageFrame}>
              {c.image ? (
                <Image source={{ uri: c.image }} style={styles.characterImage} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.characterImage, styles.characterImageEmpty]}>
                  <Ionicons name="person" size={22} color={COLORS.textInkMuted} />
                </View>
              )}
            </View>
            <Typography variant="caption" color={COLORS.textInk} numberOfLines={2} style={styles.characterName}>
              {c.name}
            </Typography>
            {c.role === 'MAIN' && (
              <Typography variant="caption" color={COLORS.accentRed} style={styles.characterRole}>
                PRINCIPAL
              </Typography>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// TV Time-style "users also watched" — AniList community recommendations
function RecommendationRail({ recommendations }: { recommendations: Manga[] }) {
  const router = useRouter();
  return (
    <View>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionMarker} />
        <Typography variant="title" color={COLORS.textInk}>On a aussi lu</Typography>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
        {recommendations.map(rec => (
          <Pressable
            key={rec.id}
            style={({ pressed }) => [styles.recCard, pressed && { opacity: 0.8 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/manga/${encodeURIComponent(rec.id)}?source=${encodeURIComponent(rec.source)}` as never);
            }}
            accessibilityRole="button"
            accessibilityLabel={rec.title.userPreferred}
          >
            <View style={styles.recCoverFrame}>
              <Image source={coverSource(rec.coverImage)} style={styles.recCover} contentFit="cover" cachePolicy="memory-disk" />
            </View>
            <Typography variant="caption" color={COLORS.textInk} numberOfLines={2} style={styles.recTitle}>
              {rec.title.english ?? rec.title.userPreferred}
            </Typography>
            {rec.averageScore != null && (
              <Typography variant="caption" color={COLORS.star}>★ {(rec.averageScore / 10).toFixed(1)}</Typography>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function InfoItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoItem}>
      <Typography variant="caption" color={COLORS.textInkMuted}>{label}</Typography>
      <Typography
        variant="subheading"
        color={highlight ? COLORS.warning : COLORS.textInk}
        style={styles.infoValue}
      >
        {value}
      </Typography>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  scroll: {},
  backBtn: {
    position: 'absolute',
    left: SPACING.base,
    zIndex: 100,
  },
  favBtn: {
    position: 'absolute',
    right: SPACING.base,
    zIndex: 100,
  },
  readLinksWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  readLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 44,
  },
  railContent: { gap: SPACING.md, paddingRight: SPACING.base },
  characterCard: { width: 84, alignItems: 'center', gap: SPACING.xs },
  characterImageFrame: {
    borderRadius: RADIUS.full,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
  },
  characterImage: { width: 72, height: 72 },
  characterImageEmpty: { backgroundColor: COLORS.paperSunken, alignItems: 'center', justifyContent: 'center' },
  characterName: { textAlign: 'center' },
  characterRole: { fontSize: 8, letterSpacing: 1 },
  recCard: { width: 110, gap: SPACING.xs },
  recCoverFrame: {
    borderRadius: RADIUS.sm,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
  },
  recCover: { width: 106, height: 150 },
  recTitle: { lineHeight: 14 },
  backBtnInner: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.ink,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.lineOnInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 340,
    backgroundColor: COLORS.ink,
    justifyContent: 'flex-end',
  },
  heroBottom: {
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 36,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.ink,
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.base,
  },
  tabLabel: {
    color: COLORS.onInkMuted,
    letterSpacing: 1.5,
    fontSize: 11,
  },
  tabLabelActive: {
    color: COLORS.onInk,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  tabLineActive: {},
  tabLineIndicator: {
    position: 'absolute',
    height: 2,
    backgroundColor: COLORS.accentRed,
    borderRadius: 1,
  },
  content: {
    padding: SPACING.base,
    gap: SPACING.lg,
    backgroundColor: COLORS.paper,
  },
  chaptersContent: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.lg,
    backgroundColor: COLORS.paper,
  },
  infoCard: { borderRadius: RADIUS.lg },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.base,
    gap: SPACING.base,
  },
  infoItem: { width: '45%', gap: 4, flexGrow: 1 },
  infoValue: { fontSize: 15 },
  genresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  genreChip: {
    backgroundColor: COLORS.accentSoft,
    borderWidth: BORDERS.hair,
    borderColor: `${COLORS.accentRed}44`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionMarker: {
    width: 4,
    height: 20,
    backgroundColor: COLORS.accentRed,
    borderRadius: 2,
  },
  description: { lineHeight: 24 },
  expandBtn: { marginTop: SPACING.sm, alignSelf: 'flex-start' },
  trackingCard: { borderRadius: RADIUS.lg, overflow: 'visible' },
  trackingInner: { padding: SPACING.base, gap: SPACING.lg },
  trackingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statusBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  statusBtnActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: `${COLORS.accentRed}66`,
  },
  statusBtnLabel: { color: COLORS.textInkMuted, fontSize: 12 },
  statusBtnLabelActive: { color: COLORS.accentRed },
  progressSection: { gap: SPACING.sm },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.paperSunken,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.full,
  },
  removeBtn: {
    alignSelf: 'center',
    paddingVertical: SPACING.sm,
  },
  ratingSection: { gap: SPACING.sm },
  ratingSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  notesSection: { gap: SPACING.sm },
  notesInput: {
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.line,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    color: COLORS.textInk,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
  },
}));

