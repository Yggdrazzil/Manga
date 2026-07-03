import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { EpisodeDto, MediaDto } from '@/lib/types';
import { episodeCode } from '@/lib/format';
import { COLORS, RADIUS, SHADOW } from '@/lib/theme';
import { TopTabs, CheckCircle, Loading, EmptyState } from '@/components/ui';

const INTEREST = ['LES ACTEURS', 'LA PRÉMISSE', 'LES CRÉATEURS', 'LA CHAÎNE/LA PLATEFORME', "LA FRANCHISE OU L'UNIVERS", 'AUTRE'];
const STATUS_LABELS: Record<string, string> = {
  watching: 'En cours', completed: 'Terminé', watchlist: 'Regarder plus tard',
  paused: 'En pause', abandoned: 'Abandonné', not_started: 'Pas commencé',
};

export default function ShowDetail() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const isMovie = type === 'movie';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [tab, setTab] = useState('À PROPOS');
  const [menu, setMenu] = useState(false);
  const [interest, setInterest] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: [isMovie ? 'movie' : 'show', id],
    queryFn: () => api.get<any>(`/api/${isMovie ? 'movies' : 'shows'}/${id}`),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: [isMovie ? 'movie' : 'show', id] });
    qc.invalidateQueries({ queryKey: ['shows'] });
    qc.invalidateQueries({ queryKey: ['movies'] });
  };

  const favorite = useMutation({
    mutationFn: () => api.post(`/api/${isMovie ? 'movies' : 'shows'}/${id}/favorite`),
    onSettled: refresh,
  });
  const markMovie = useMutation({
    mutationFn: (seen: boolean) => api.post(`/api/movies/${id}/${seen ? 'watched' : 'unwatched'}`),
    onSettled: refresh,
  });

  if (detail.isLoading || !detail.data) return <Loading />;
  const media: MediaDto = detail.data.media;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={styles.hero}>
        <View style={[styles.heroBtns, { top: insets.top + 4 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather name="chevron-down" size={30} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setMenu(true)} hitSlop={8}>
            <Feather name="more-horizontal" size={28} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.heroTitleWrap}>
          <Text style={styles.heroTitle}>{media.title}</Text>
          <Text style={styles.heroSub}>
            {isMovie
              ? [media.year, media.genres].filter(Boolean).join(' · ')
              : [
                  detail.data.show?.numberOfSeasons ? `${detail.data.show.numberOfSeasons} saison${detail.data.show.numberOfSeasons > 1 ? 's' : ''}` : null,
                  detail.data.show?.platform ?? detail.data.show?.network,
                ].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {isMovie ? (
        <MovieBody media={media} detail={detail.data} onToggle={() => markMovie.mutate(media.userStatus !== 'completed')} />
      ) : (
        <>
          <TopTabs tabs={['À PROPOS', 'ÉPISODES']} active={tab} onChange={setTab} />
          {tab === 'À PROPOS' ? (
            <AboutTab media={media} detail={detail.data} interest={interest} setInterest={setInterest} />
          ) : (
            <EpisodesTab showId={String(id)} onChange={refresh} />
          )}
        </>
      )}

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenu(false)} />
        <View style={styles.sheet}>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>{STATUS_LABELS[media.userStatus ?? 'not_started']}</Text>
          </View>
          <SheetItem
            icon={media.isFavorite ? 'heart' : 'heart'}
            color={media.isFavorite ? COLORS.red : COLORS.black}
            label={media.isFavorite ? 'Retirer des favoris' : 'Favoris'}
            onPress={() => { favorite.mutate(); setMenu(false); }}
          />
          <SheetItem icon="plus-square" label="Ajouter à une liste" onPress={() => setMenu(false)} />
          <SheetItem icon="clock" label="Regarder plus tard" onPress={() => setMenu(false)} />
          <SheetItem icon="share-2" label="Partager" onPress={() => setMenu(false)} last />
        </View>
      </Modal>
    </View>
  );
}

function SheetItem({ icon, label, onPress, color, last }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; color?: string; last?: boolean }) {
  return (
    <Pressable style={[styles.sheetItem, last && { borderBottomWidth: 0 }]} onPress={onPress}>
      <Feather name={icon} size={22} color={color ?? COLORS.black} />
      <Text style={styles.sheetLabel}>{label}</Text>
    </Pressable>
  );
}

function AboutTab({ media, detail, interest, setInterest }: any) {
  const providers = detail.providers ?? [];
  return (
    <ScrollView>
      <View style={styles.section}>
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionTitle}>Où regarder</Text>
          <Feather name="settings" size={22} color={COLORS.black} />
        </View>
        {providers.length === 0 ? (
          <Text style={styles.muted}>Non disponible</Text>
        ) : (
          <View style={styles.provBtn}>
            <Feather name="play" size={18} color="#fff" />
            <Text style={styles.provText}>{providers[0].name.toUpperCase()}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.question}>QU'EST-CE QUI VOUS INTÉRESSE LE PLUS DANS CETTE SÉRIE ?</Text>
        {INTEREST.map((o) => (
          <Pressable key={o} style={[styles.qbtn, interest === o && styles.qbtnSel]} onPress={() => setInterest(o)}>
            <Text style={styles.qbtnText}>{o}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations sur la série</Text>
        <Text style={styles.muted}>{[media.status, media.genres].filter(Boolean).join(' · ')}</Text>
        {media.overview ? <Text style={styles.overview}>{media.overview}</Text> : null}
      </View>
    </ScrollView>
  );
}

function MovieBody({ media, detail, onToggle }: any) {
  const seen = media.userStatus === 'completed';
  const providers = detail.providers ?? [];
  return (
    <ScrollView>
      <View style={[styles.section, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="eye" size={22} color={COLORS.black} />
          <Text style={{ fontSize: 17 }}>{seen ? 'Vu' : 'Pas vu'}</Text>
        </View>
        <CheckCircle checked={seen} onPress={onToggle} />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Où regarder</Text>
        {providers.length === 0 ? (
          <Text style={styles.muted}>Non disponible</Text>
        ) : (
          <View style={styles.provBtn}>
            <Feather name="play" size={18} color="#fff" />
            <Text style={styles.provText}>{providers[0].name.toUpperCase()}</Text>
          </View>
        )}
      </View>
      {media.overview ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synopsis</Text>
          <Text style={styles.overview}>{media.overview}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

type SeasonData = { id: string; seasonNumber: number; title: string; watchedCount: number; totalCount: number; episodes: EpisodeDto[] };

function EpisodesTab({ showId, onChange }: { showId: string; onChange: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const { data, isLoading } = useQuery({
    queryKey: ['show', showId, 'episodes'],
    queryFn: () => api.get<{ seasons: SeasonData[]; nextEpisode: EpisodeDto | null }>(`/api/shows/${showId}/episodes`),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['show', showId, 'episodes'] });
    qc.invalidateQueries({ queryKey: ['show', showId] });
    onChange();
  };
  const toggleEp = useMutation({
    mutationFn: (ep: EpisodeDto) => api.post(`/api/episodes/${ep.id}/${ep.watched ? 'unwatched' : 'watched'}`),
    onSettled: refresh,
  });
  const markAll = useMutation({
    mutationFn: (seasonNumber?: number) => api.post(`/api/shows/${showId}/mark-all-watched`, seasonNumber ? { seasonNumber } : {}),
    onSettled: refresh,
  });

  if (isLoading || !data) return <Loading />;
  if (data.seasons.length === 0) return <EmptyState title="Aucun épisode" />;

  return (
    <ScrollView style={{ backgroundColor: COLORS.pageMuted }} contentContainerStyle={{ paddingBottom: 40 }}>
      {data.nextEpisode ? (
        <View style={{ paddingTop: 20, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, backgroundColor: COLORS.white }}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: 24 }]}>Démarrer le suivi</Text>
          <View style={{ padding: 12 }}>
            <View style={styles.eprow}>
              <View style={styles.epThumb}>
                <Feather name="image" size={26} color="#9a9a9a" />
              </View>
              <View style={{ flex: 1, padding: 12 }}>
                <Text style={styles.epCode}>{episodeCode(data.nextEpisode.seasonNumber, data.nextEpisode.episodeNumber)}</Text>
                <Text numberOfLines={1}>{data.nextEpisode.title}</Text>
              </View>
              <View style={{ justifyContent: 'center', paddingRight: 14 }}>
                <CheckCircle checked={data.nextEpisode.watched} onPress={() => toggleEp.mutate(data.nextEpisode!)} />
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <View style={{ paddingTop: 20 }}>
        <View style={[styles.sectionHeadRow, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>Tous les épisodes</Text>
          <Pressable style={styles.markAllBtn} onPress={() => markAll.mutate(undefined)}>
            <Feather name="check" size={18} color={COLORS.black} />
          </Pressable>
        </View>
        <View style={{ padding: 12 }}>
          {data.seasons.map((s) => {
            const isOpen = open[s.seasonNumber];
            const done = s.totalCount > 0 && s.watchedCount === s.totalCount;
            return (
              <View key={s.id} style={{ marginBottom: 12 }}>
                <Pressable
                  style={[styles.season, isOpen && styles.seasonOpen]}
                  onPress={() => setOpen((o) => ({ ...o, [s.seasonNumber]: !o[s.seasonNumber] }))}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.seasonTitle}>{s.title}</Text>
                    <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={22} color={COLORS.black} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.seasonProg}>{s.watchedCount}/{s.totalCount}</Text>
                    <CheckCircle size={44} checked={done} onPress={() => markAll.mutate(s.seasonNumber)} />
                  </View>
                </Pressable>
                {isOpen
                  ? s.episodes.map((e) => (
                      <View key={e.id} style={styles.eprow}>
                        <View style={styles.epThumb}>
                          <Feather name="image" size={24} color="#9a9a9a" />
                        </View>
                        <View style={{ flex: 1, padding: 10 }}>
                          <Text style={styles.epCode}>{episodeCode(e.seasonNumber, e.episodeNumber)}</Text>
                          <Text numberOfLines={2}>{e.title}</Text>
                        </View>
                        <View style={{ justifyContent: 'center', paddingRight: 14 }}>
                          <CheckCircle size={44} checked={e.watched} onPress={() => toggleEp.mutate(e)} />
                        </View>
                      </View>
                    ))
                  : null}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 240, backgroundColor: '#1a1a22', justifyContent: 'flex-end' },
  heroBtns: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14 },
  heroTitleWrap: { padding: 20 },
  heroTitle: { color: '#fff', fontSize: 27, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 2 },
  section: { padding: 22, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  sectionHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 14 },
  sectionTitle: { fontSize: 24, fontWeight: '800' },
  muted: { color: COLORS.textMuted, fontSize: 16, marginTop: 8 },
  overview: { fontSize: 18, lineHeight: 26, marginTop: 16 },
  provBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.provider, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12, alignSelf: 'flex-start', marginTop: 12 },
  provText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  question: { textAlign: 'center', fontSize: 14, fontWeight: '700', marginBottom: 16 },
  qbtn: { backgroundColor: COLORS.chipGrey, borderRadius: 6, paddingVertical: 16, marginBottom: 12, alignItems: 'center' },
  qbtnSel: { backgroundColor: COLORS.yellow },
  qbtnText: { fontSize: 14, fontWeight: '700' },
  eprow: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 5, minHeight: 92, overflow: 'hidden', marginBottom: 8, ...SHADOW.card },
  epThumb: { width: 90, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  epCode: { fontSize: 19, fontWeight: '800' },
  markAllBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: COLORS.black, alignItems: 'center', justifyContent: 'center' },
  season: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 76, paddingHorizontal: 20, backgroundColor: COLORS.white, borderRadius: 5, ...SHADOW.season },
  seasonOpen: { borderBottomWidth: 3, borderBottomColor: COLORS.yellow },
  seasonTitle: { fontSize: 24, fontWeight: '800' },
  seasonProg: { fontSize: 17, marginRight: 14 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.overlay },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.white, borderTopLeftRadius: 5, borderTopRightRadius: 5, paddingBottom: 20 },
  statusRow: { backgroundColor: COLORS.chipGrey, borderBottomWidth: 3, borderBottomColor: COLORS.yellow, height: 62, justifyContent: 'center', paddingHorizontal: 24 },
  statusText: { fontSize: 16, color: '#555' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 16, height: 62, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  sheetLabel: { fontSize: 18, fontWeight: '600' },
});
