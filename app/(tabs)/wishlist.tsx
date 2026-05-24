import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import React from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import type { LibraryEntry } from '@/lib/types';
import { useLibraryStore } from '@/lib/store/library';
import { Typography } from '@/components/ui/Typography';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { EmptyState } from '@/components/ui/EmptyState';

const TAB_BAR_HEIGHT = 88;
const COLUMNS = 3;
const GUTTER = SPACING.md;
const CARD_WIDTH = Math.floor(
  (Dimensions.get('window').width - SPACING.base * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS
);

function WishlistCard({ entry, index }: { entry: LibraryEntry; index: number }) {
  const router = useRouter();
  const updateStatus = useLibraryStore(s => s.updateStatus);

  const title = entry.manga.title.english ?? entry.manga.title.romaji ?? entry.manga.title.userPreferred;
  const imageHeight = Math.round(CARD_WIDTH * 1.42);

  const startReading = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateStatus(entry.mangaId, entry.source, 'READING');
  };

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24, delay: (index % 9) * 45 }}
      style={{ width: CARD_WIDTH }}
    >
      <Pressable onPress={() => router.push(`/manga/${entry.mangaId}?source=${entry.source}`)}>
        <View style={[styles.poster, { height: imageHeight }]}>
          <Image
            source={{ uri: entry.manga.coverImage }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'LKO2?V%2Tw=w]~RBVZRi};RPxuwH' }}
          />
          <View style={styles.typeBadgeWrap}>
            <TypeBadge type={entry.manga.type} />
          </View>
          <Pressable
            style={styles.startBtn}
            hitSlop={8}
            onPress={startReading}
            accessibilityLabel={`Commencer ${title}`}
          >
            <Ionicons name="play" size={14} color={COLORS.bg} />
          </Pressable>
        </View>
      </Pressable>
      <Typography variant="bodyBold" numberOfLines={2} style={styles.cardTitle}>
        {title}
      </Typography>
    </MotiView>
  );
}

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const entries = useLibraryStore(s => s.entries);

  const wishlist = entries
    .filter(e => e.status === 'PLAN_TO_READ')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Typography variant="display" style={styles.title}>À lire</Typography>
        <Typography variant="body">
          {wishlist.length > 0
            ? `${wishlist.length} œuvre${wishlist.length > 1 ? 's' : ''} dans votre liste`
            : 'Votre liste de lecture'}
        </Typography>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
      >
        {wishlist.length === 0 ? (
          <EmptyState
            icon="🔖"
            title="Rien à lire pour l'instant"
            subtitle="Ajoutez des œuvres à votre liste « À lire » depuis l'écran Découvrir pour les retrouver ici en un clic."
          />
        ) : (
          <View style={styles.grid}>
            {wishlist.map((entry, index) => (
              <WishlistCard key={`${entry.source}-${entry.mangaId}`} entry={entry} index={index} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.base,
    gap: 4,
  },
  title: { color: COLORS.text, fontSize: 36, lineHeight: 38 },
  scroll: { paddingHorizontal: SPACING.base, paddingTop: SPACING.xs, flexGrow: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GUTTER,
  },
  poster: {
    width: '100%',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceRaised,
  },
  typeBadgeWrap: {
    position: 'absolute',
    bottom: SPACING.xs,
    left: SPACING.xs,
  },
  startBtn: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: {
    marginTop: SPACING.sm,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.text,
  },
});
