import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as anilist from '@/lib/api/anilist';
import * as mangadex from '@/lib/api/mangadex';
import { MediaRow } from '@/components/manga/MediaRow';
import { Typography } from '@/components/ui/Typography';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { COLORS, SPACING } from '@/constants/theme';

const TAB_BAR_HEIGHT = 88;

function HeroCard() {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ['trending', 1, 1],
    queryFn: () => anilist.getTrending(1, 6),
  });

  const hero = data?.items[0];
  if (!hero) {
    return <View style={styles.heroPlaceholder} />;
  }

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
    >
      <Pressable
        style={styles.heroCard}
        onPress={() => router.push(`/manga/${hero.id}?source=${hero.source}`)}
      >
        <Image
          source={{ uri: hero.bannerImage ?? hero.coverImage }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={['transparent', 'rgba(10,11,20,0.7)', COLORS.bg]}
          locations={[0.3, 0.7, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroMeta}>
            <TypeBadge type={hero.type} />
            {hero.year && (
              <Typography variant="caption" color="rgba(255,255,255,0.7)">
                {hero.year}
              </Typography>
            )}
          </View>
          <Typography variant="display" style={styles.heroTitle} numberOfLines={2}>
            {hero.title.english ?? hero.title.romaji ?? hero.title.userPreferred}
          </Typography>
          {hero.genres.slice(0, 3).length > 0 && (
            <View style={styles.heroGenres}>
              {hero.genres.slice(0, 3).map(g => (
                <View key={g} style={styles.genreChip}>
                  <Typography variant="label" color="rgba(255,255,255,0.75)">{g}</Typography>
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </MotiView>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending', 1, 20],
    queryFn: () => anilist.getTrending(1, 20),
  });

  const { data: manhwa, isLoading: manhwaLoading } = useQuery({
    queryKey: ['manhwa'],
    queryFn: () => anilist.getManhwa(1, 20),
  });

  const { data: webtoons, isLoading: webtoonsLoading } = useQuery({
    queryKey: ['webtoons'],
    queryFn: () => mangadex.getWebtoons(1, 20),
  });

  const { data: popular, isLoading: popularLoading } = useQuery({
    queryKey: ['popular'],
    queryFn: () => anilist.getPopular(1, 20),
  });

  const { data: manhua } = useQuery({
    queryKey: ['manhua'],
    queryFn: () => anilist.getManhua(1, 20),
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
      >
        <MotiView
          from={{ opacity: 0, translateY: -12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          style={styles.header}
        >
          <Typography variant="display" style={styles.appTitle}>MangaTrack</Typography>
          <Typography variant="body">Découvrez · Suivez · Lisez</Typography>
        </MotiView>

        <HeroCard />

        <View style={styles.rows}>
          <MediaRow
            title="Tendances"
            emoji="🔥"
            mangas={trending?.items}
            isLoading={trendingLoading}
          />
          <MediaRow
            title="Manhwa Populaires"
            emoji="🇰🇷"
            mangas={manhwa?.items}
            isLoading={manhwaLoading}
          />
          <MediaRow
            title="Webtoons"
            emoji="📱"
            mangas={webtoons?.items}
            isLoading={webtoonsLoading}
          />
          <MediaRow
            title="Top Manga"
            emoji="⭐"
            mangas={popular?.items}
            isLoading={popularLoading}
            cardWidth={130}
          />
          {manhua && (
            <MediaRow
              title="Manhua"
              emoji="🇨🇳"
              mangas={manhua.items}
              cardWidth={110}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingTop: SPACING.md },
  header: {
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.lg,
    gap: 4,
  },
  appTitle: {
    fontSize: 36,
    lineHeight: 38,
    color: COLORS.accent,
    letterSpacing: 2,
  },
  heroCard: {
    height: 240,
    marginHorizontal: SPACING.base,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.surfaceRaised,
    justifyContent: 'flex-end',
  },
  heroPlaceholder: {
    height: 240,
    marginHorizontal: SPACING.base,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceRaised,
    marginBottom: SPACING.xl,
  },
  heroContent: {
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.5,
    color: COLORS.text,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroGenres: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  genreChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  rows: { gap: 0 },
});
