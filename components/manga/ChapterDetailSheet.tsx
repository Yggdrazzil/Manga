import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
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
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
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

  const entry = useLibraryStore(s => s.entries.find(e => e.mangaId === entryMangaId && e.source === source));
  const toggleChapterRead = useLibraryStore(s => s.toggleChapterRead);
  const updateChapterNote = useLibraryStore(s => s.updateChapterNote);

  if (!chapter) return null;

  const chapterData = entry?.chapterData?.[chapter.id];
  const readChapterIds = entry?.readChapterIds ?? [];
  const isRead = readChapterIds.includes(chapter.id) ||
    (readChapterIds.length === 0 && parseFloat(chapter.chapter) <= (entry?.progress ?? 0));

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
          {/* Section 1 — Header */}
          <View style={styles.header}>
            <Image
              source={{ uri: manga.coverImage }}
              style={styles.cover}
              contentFit="cover"
              cachePolicy="memory-disk"
            />

            <View style={styles.headerCenter}>
              <Pressable
                style={styles.mangaTitleRow}
                onPress={onClose}
                accessibilityLabel="Retour"
              >
                <Typography variant="label" numberOfLines={1} style={styles.mangaTitle}>
                  {displayTitle}
                </Typography>
                <Typography variant="label" style={styles.chevronIcon}>›</Typography>
              </Pressable>

              <Typography variant="bodyBold" style={styles.chapterNum}>
                {`Ch.${chapter.chapter}${chapter.volume ? ` · Vol.${chapter.volume}` : ''}`}
              </Typography>

              {chapter.title ? (
                <Typography variant="label" numberOfLines={2} style={styles.chapterTitle}>
                  {chapter.title}
                </Typography>
              ) : null}

              <View style={styles.dateRow}>
                <Typography variant="caption" style={styles.dateText}>
                  {`📅 ${publishDate}`}
                </Typography>
                <Typography variant="caption" style={styles.dateSep}>|</Typography>
                <Typography variant="caption" style={styles.dateText}>
                  {`👁 ${readDate}`}
                </Typography>
              </View>
            </View>

            <Pressable
              style={styles.checkBtn}
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
                size={36}
                color={isRead ? COLORS.accent : COLORS.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* Section 2 — Platform */}
          <View style={styles.section}>
            <Typography variant="caption" style={styles.sectionLabel}>OÙ AVEZ-VOUS LU ?</Typography>
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
                      style={[styles.pillText, isActive && styles.pillTextActive]}
                    >
                      {platform}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Section 3 — Rating */}
          <View style={styles.section}>
            <Typography variant="caption" style={styles.sectionLabel}>NOTER CE CHAPITRE</Typography>
            <View style={styles.ratingsRow}>
              {RATINGS.map(({ value, label }) => {
                const isActive = currentRating === value;
                return (
                  <Pressable
                    key={value}
                    style={styles.ratingBtn}
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
                      color={isActive ? '#F59E0B' : COLORS.textMuted}
                    />
                    <Typography
                      variant="caption"
                      style={[styles.ratingLabel, isActive && styles.ratingLabelActive]}
                    >
                      {label}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Section 4 — Reactions */}
          <View style={styles.section}>
            <Typography variant="caption" style={styles.sectionLabel}>RESSENTIS</Typography>
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
                      style={[styles.reactionLabel, isActive && styles.reactionLabelActive]}
                    >
                      {label}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Section 5 — Info */}
          <View style={styles.section}>
            <Typography variant="caption" style={styles.sectionLabel}>INFORMATIONS</Typography>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Typography variant="caption">PAGES</Typography>
                <Typography variant="bodyBold" style={styles.infoValue}>
                  {chapter.pages} pages
                </Typography>
              </View>
              <View style={styles.infoItem}>
                <Typography variant="caption">LANGUE</Typography>
                <Typography variant="bodyBold" style={styles.infoValue}>
                  {chapter.translatedLanguage === 'fr' ? 'Français' : 'Anglais'}
                </Typography>
              </View>
            </View>
          </View>

          {/* Close button */}
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            onPress={onClose}
            accessibilityLabel="Fermer"
            accessibilityRole="button"
          >
            <Typography variant="label" style={styles.closeBtnText}>FERMER</Typography>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 11, 20, 0.97)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
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
  cover: {
    width: 56,
    height: 80,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceRaised,
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
    color: COLORS.accentLight,
    flex: 1,
    fontFamily: FONTS.bodyBold,
  },
  chevronIcon: {
    color: COLORS.accentLight,
    fontSize: 16,
  },
  chapterNum: {
    fontSize: 18,
    lineHeight: 24,
  },
  chapterTitle: {
    color: COLORS.textMuted,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  dateText: {
    color: COLORS.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
  },
  dateSep: {
    color: COLORS.border,
  },
  checkBtn: {
    padding: SPACING.xs,
    marginTop: -SPACING.xs,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.base,
  },
  section: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.base,
    gap: SPACING.md,
  },
  sectionLabel: {
    color: COLORS.textMuted,
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
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: {
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.accent,
  },
  pillText: {
    color: COLORS.textMuted,
  },
  pillTextActive: {
    color: COLORS.accentLight,
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
  },
  ratingLabel: {
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  ratingLabelActive: {
    color: COLORS.accent,
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
    backgroundColor: COLORS.accentMuted,
  },
  reactionEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  reactionLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: FONTS.body,
  },
  reactionLabelActive: {
    color: COLORS.accentLight,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: SPACING.base,
  },
  infoItem: {
    flex: 1,
    gap: SPACING.xs,
  },
  infoValue: {
    fontSize: 15,
  },
  closeBtn: {
    marginHorizontal: SPACING.base,
    marginTop: SPACING.md,
    paddingVertical: SPACING.base,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accentMuted,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  closeBtnText: {
    color: COLORS.accentLight,
    fontFamily: FONTS.bodyBold,
    letterSpacing: 1,
  },
});
