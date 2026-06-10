import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLibraryStore } from '@/lib/store/library';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, FONTS, RADIUS, SPACING, inkScrim, themedStyles } from '@/constants/theme';
import type { Manga, MangaChapter } from '@/lib/types';

interface ChapterDetailSheetProps {
  chapter: MangaChapter | null;
  manga: Manga;
  entryMangaId: string;
  source: string;
  onClose: () => void;
}

const PLATFORMS = ['MangaDex', 'Manga Plus', 'Crunchyroll', 'Webtoon', 'Viz', 'Tapas', 'Autre'];

const RATINGS: Array<{ value: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { value: 1, label: 'BOF' },
  { value: 2, label: 'OK' },
  { value: 3, label: 'BIEN' },
  { value: 4, label: 'SUPER' },
  { value: 5, label: 'GÉNIAL' },
];

const REACTIONS = [
  { emoji: '😲', label: 'CHOQUÉ', key: 'shocked' },
  { emoji: '😢', label: 'TRISTE', key: 'sad' },
  { emoji: '🤯', label: 'ÉPOUSTOUFLÉ', key: 'blown' },
  { emoji: '❤️', label: 'TOUCHANT', key: 'touching' },
  { emoji: '😤', label: 'FRUSTRANT', key: 'frustrating' },
  { emoji: '😂', label: 'HILARANT', key: 'funny' },
];

export function ChapterDetailSheet({
  chapter,
  manga,
  entryMangaId,
  source,
  onClose,
}: ChapterDetailSheetProps) {
  const { height } = useWindowDimensions();
  const router = useRouter();

  const entry = useLibraryStore(s => s.entries.find(e => e.mangaId === entryMangaId && e.source === source));
  const toggleChapterRead = useLibraryStore(s => s.toggleChapterRead);
  const updateChapterNote = useLibraryStore(s => s.updateChapterNote);

  if (!chapter) return null;

  const chapterData = entry?.chapterData?.[chapter.id];
  const readChapterIds = entry?.readChapterIds ?? [];
  const num = parseFloat(chapter.chapter);
  const isRead = readChapterIds.includes(chapter.id) ||
    (Number.isFinite(num) && num <= (entry?.progress ?? 0));

  const readAt = chapterData?.readAt;
  const currentPlatform = chapterData?.platform;
  const currentRating = chapterData?.rating;
  const currentReaction = chapterData?.reaction;

  const publishDate = (() => {
    try {
      return format(parseISO(chapter.publishAt), 'd MMM yyyy', { locale: fr });
    } catch {
      return '—';
    }
  })();

  const readDate = readAt
    ? (() => {
        try {
          return format(parseISO(readAt), 'd MMM yyyy', { locale: fr });
        } catch {
          return '—';
        }
      })()
    : '—';

  const displayTitle = manga.title.english ?? manga.title.romaji ?? manga.title.userPreferred;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={!!chapter}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={[styles.sheet, { maxHeight: height * 0.88 }]}>
        <View style={styles.dragIndicator} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.coverFrame}>
              <Image
                source={{ uri: manga.coverImage }}
                style={styles.cover}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>

            <View style={styles.headerCenter}>
              <Pressable
                style={styles.mangaTitleRow}
                onPress={onClose}
                accessibilityLabel="Retour"
              >
                <Typography variant="label" numberOfLines={1} color={COLORS.accentRed} style={styles.mangaTitle}>
                  {displayTitle}
                </Typography>
                <Typography variant="label" color={COLORS.accentRed}>›</Typography>
              </Pressable>

              <Typography variant="display" color={COLORS.textInk} style={styles.chapterNum}>
                {`CH.${chapter.chapter}${chapter.volume ? ` · Vol.${chapter.volume}` : ''}`}
              </Typography>

              {chapter.title ? (
                <Typography variant="body" color={COLORS.textInkMuted} numberOfLines={2}>
                  {chapter.title}
                </Typography>
              ) : null}

              <View style={styles.dateRow}>
                <Typography variant="caption" color={COLORS.textInkFaint}>
                  {`📅 ${publishDate}`}
                </Typography>
                <Typography variant="caption" color={COLORS.line}>|</Typography>
                <Typography variant="caption" color={COLORS.textInkFaint}>
                  {`👁 ${readDate}`}
                </Typography>
              </View>
            </View>

            <Pressable
              style={[styles.checkBtn, isRead && styles.checkBtnRead]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                toggleChapterRead(entryMangaId, source, chapter.id, parseFloat(chapter.chapter));
              }}
              accessibilityLabel={isRead ? 'Marquer comme non lu' : 'Marquer comme lu'}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isRead }}
            >
              <Ionicons
                name={isRead ? 'checkmark-circle' : 'ellipse-outline'}
                size={34}
                color={isRead ? COLORS.statusCompleted : COLORS.textInkMuted}
              />
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* Read button */}
          {chapter.isReadable !== false && (
            <Pressable
              style={({ pressed }) => [styles.readBtn, pressed && styles.readBtnPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onClose();
                router.push(
                  `/reader/${chapter.id}?chapter=${encodeURIComponent(chapter.chapter)}&title=${encodeURIComponent(chapter.title ?? '')}&entryMangaId=${encodeURIComponent(entryMangaId)}&source=${encodeURIComponent(source)}&mangaTitle=${encodeURIComponent(displayTitle)}` as never,
                );
              }}
              accessibilityRole="button"
              accessibilityLabel={`Lire le chapitre ${chapter.chapter}`}
            >
              <Ionicons name="book" size={18} color={COLORS.onInk} />
              <Typography variant="kicker" color={COLORS.onInk} style={styles.readBtnText}>
                LIRE LE CHAPITRE
              </Typography>
            </Pressable>
          )}

          {/* Platform */}
          <View style={styles.section}>
            <Typography variant="kicker" color={COLORS.textInkMuted}>OÙ AVEZ-VOUS LU ?</Typography>
            <View style={styles.pillsRow}>
              {PLATFORMS.map(platform => {
                const isActive = currentPlatform === platform;
                return (
                  <Pressable
                    key={platform}
                    style={[styles.pill, isActive && styles.pillActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      updateChapterNote(entryMangaId, source, chapter.id, { platform });
                    }}
                    accessibilityLabel={platform}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Typography
                      variant="label"
                      color={isActive ? COLORS.accentRed : COLORS.textInkMuted}
                    >
                      {platform}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Rating */}
          <View style={styles.section}>
            <Typography variant="kicker" color={COLORS.textInkMuted}>NOTER CE CHAPITRE</Typography>
            <View style={styles.ratingsRow}>
              {RATINGS.map(({ value, label }) => {
                const isActive = currentRating === value;
                return (
                  <Pressable
                    key={value}
                    style={[styles.ratingBtn, isActive && styles.ratingBtnActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      updateChapterNote(entryMangaId, source, chapter.id, { rating: value });
                    }}
                    accessibilityLabel={`${label}, note ${value}/5`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Ionicons
                      name={isActive ? 'star' : 'star-outline'}
                      size={24}
                      color={isActive ? COLORS.star : COLORS.textInkMuted}
                    />
                    <Typography
                      variant="caption"
                      color={isActive ? COLORS.accentRed : COLORS.textInkMuted}
                    >
                      {label}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Reactions */}
          <View style={styles.section}>
            <Typography variant="kicker" color={COLORS.textInkMuted}>RESSENTIS</Typography>
            <View style={styles.reactionsRow}>
              {REACTIONS.map(({ emoji, label, key }) => {
                const isActive = currentReaction === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.reactionBtn, isActive && styles.reactionBtnActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      updateChapterNote(entryMangaId, source, chapter.id, {
                        reaction: isActive ? undefined : key,
                      });
                    }}
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Typography style={styles.reactionEmoji}>{emoji}</Typography>
                    <Typography
                      variant="caption"
                      color={isActive ? COLORS.accentRed : COLORS.textInkMuted}
                      style={styles.reactionLabel}
                    >
                      {label}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Info */}
          <View style={styles.section}>
            <Typography variant="kicker" color={COLORS.textInkMuted}>INFORMATIONS</Typography>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Typography variant="caption" color={COLORS.textInkMuted}>PAGES</Typography>
                <Typography variant="subheading" color={COLORS.textInk}>
                  {chapter.pages} pages
                </Typography>
              </View>
              <View style={styles.infoItem}>
                <Typography variant="caption" color={COLORS.textInkMuted}>LANGUE</Typography>
                <Typography variant="subheading" color={COLORS.textInk}>
                  {chapter.translatedLanguage === 'fr' ? 'Français' : 'Anglais'}
                </Typography>
              </View>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            onPress={onClose}
            accessibilityLabel="Fermer"
            accessibilityRole="button"
          >
            <Typography variant="kicker" color={COLORS.textInk} style={styles.closeBtnText}>
              FERMER
            </Typography>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: inkScrim(0.72),
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.paper,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    borderTopWidth: BORDERS.bold,
    borderLeftWidth: BORDERS.bold,
    borderRightWidth: BORDERS.bold,
    borderColor: COLORS.ink,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.lineStrong,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.base,
  },
  coverFrame: {
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  cover: {
    width: 56,
    height: 80,
    backgroundColor: COLORS.paperSunken,
  },
  headerCenter: {
    flex: 1,
    gap: SPACING.xs,
  },
  mangaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  mangaTitle: {
    flex: 1,
  },
  chapterNum: {
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  checkBtn: {
    padding: SPACING.xs,
    marginTop: -SPACING.xs,
  },
  checkBtnRead: {},
  divider: {
    height: BORDERS.hair,
    backgroundColor: COLORS.line,
    marginHorizontal: SPACING.base,
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.base,
    marginTop: SPACING.base,
    paddingVertical: SPACING.base,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.accentRed,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.accentDeep,
    minHeight: 52,
  },
  readBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  readBtnText: {
    letterSpacing: 1.5,
    fontSize: 13,
  },
  section: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.base,
    gap: SPACING.md,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  pill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  pillActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentRed,
  },
  ratingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingBtn: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  ratingBtnActive: {
    backgroundColor: COLORS.accentSoft,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reactionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  reactionBtnActive: {
    backgroundColor: COLORS.accentSoft,
  },
  reactionEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  reactionLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: FONTS.headingMedium,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: SPACING.base,
  },
  infoItem: {
    flex: 1,
    gap: SPACING.xs,
  },
  closeBtn: {
    marginHorizontal: SPACING.base,
    marginTop: SPACING.md,
    paddingVertical: SPACING.base,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    alignItems: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  closeBtnText: {
    letterSpacing: 1.5,
  },
}));
