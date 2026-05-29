import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as anilist from '@/lib/api/anilist';
import * as mangadex from '@/lib/api/mangadex';
import { MediaRow } from '@/components/manga/MediaRow';
import { Halftone } from '@/components/ui/Halftone';
import { Typography } from '@/components/ui/Typography';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { BORDERS, COLORS, RADIUS, SPACING } from '@/constants/theme';

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

  const title = hero.title.english ?? hero.title.romaji ?? hero.title.userPreferred;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
    >
      <Pressable
        style={styles.heroCard}
        onPress={() => router.push(`/manga/${hero.id}?source=${hero.source}`)}
        accessibilityRole="button"
        accessibilityLabel={`Voir ${title}`}
      >
        <Image
          source={{ uri: hero.bannerImage ?? hero.coverImage }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={['rgba(22,19,14,0.1)', 'rgba(22,19,14,0.65)', COLORS.ink]}
          locations={[0.3, 0.65, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <Halftone opacity={0.03} />
        <View style={styles.heroContent}>
          <View style={styles.heroMeta}>
            <TypeBadge type={hero.type} />
            {hero.year && (
              <Typography variant="kicker" color={COLORS.onInkMuted}>
                {hero.year}
              </Typography>
            )}
          </View>
          <Typography variant="hero" color={COLORS.onInk} style={styles.heroTitle} numberOfLines={2}>
            {title}
          </Typography>
          {hero.genres.slice(0, 3).length > 0 && (
            <View style={styles.heroGenres}>
              {hero.genres.slice(0, 3).map(g => (
                <View key={g} style={styles.genreChip}>
                  <Typography variant="label" color={COLORS.onInkMuted}>{g}</Typography>
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
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['trending'] });
    await queryClient.invalidateQueries({ queryKey: ['manhwa'] });
    await queryClient.invalidateQueries({ queryKey: ['popular'] });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accentRed}
            colors={[COLORS.accentRed]}
          />
        }
      >
        <MotiView
          from={{ opacity: 0, translateY: -12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          style={styles.header}
        >
          <Typography variant="kicker" color={COLORS.accentRed}>
            MANGA TRACKER
          </Typography>
          <Typography variant="hero" color={COLORS.textInk} style={styles.appTitle}>
            Découvrir
          </Typography>
        </MotiView>

        <HeroCard />

        <View style={styles.rows}>
          <MediaRow
            title="TENDANCES"
            mangas={trending?.items}
            isLoading={trendingLoading}
          />
          <MediaRow
            title="MANHWA"
            mangas={manhwa?.items}
            isLoading={manhwaLoading}
          />
          <MediaRow
            title="WEBTOONS"
            mangas={webtoons?.items}
            isLoading={webtoonsLoading}
          />
          <MediaRow
            title="TOP MANGA"
            mangas={popular?.items}
            isLoading={popularLoading}
            cardWidth={130}
          />
          {manhua && (
            <MediaRow
              title="MANHUA"
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
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { paddingTop: SPACING.md },
  header: {
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.lg,
    gap: 4,
  },
  appTitle: {
    fontSize: 38,
    lineHeight: 40,
  },
  heroCard: {
    height: 260,
    marginHorizontal: SPACING.base,
    borderRadius: RADIUS.lg,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.ink,
    justifyContent: 'flex-end',
  },
  heroPlaceholder: {
    height: 260,
    marginHorizontal: SPACING.base,
    borderRadius: RADIUS.lg,
    borderWidth: BORDERS.bold,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.ink,
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
    fontSize: 30,
    lineHeight: 32,
  },
  heroGenres: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  genreChip: {
    backgroundColor: COLORS.lineOnInk,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.lineOnInk,
  },
  rows: { gap: 0 },
});
