import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/lib/utils/haptics';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BORDERS,
  COLORS,
  RADIUS,
  SPACING,
  THEME_ORDER,
  THEMES,
  themedStyles,
  type ThemeId,
} from '@/constants/theme';
import { useSettingsStore, type ScanLang } from '@/lib/store/settings';
import { Panel } from '@/components/ui/Panel';
import { Typography } from '@/components/ui/Typography';

const DATA_SOURCES = [
  'AniList', 'MangaDex', 'Comick', 'Jikan / MyAnimeList',
  'BnF', 'Wikidata', 'Open Library', 'Google Books', 'Wikipédia',
];

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionMarker} />
      <Ionicons name={icon} size={16} color={COLORS.accentRed} />
      <Typography variant="title" color={COLORS.textInk}>{title}</Typography>
    </View>
  );
}

function ThemeCard({ id, active, onSelect }: { id: ThemeId; active: boolean; onSelect: () => void }) {
  const theme = THEMES[id];
  const c = theme.colors;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.themeCard,
        { backgroundColor: c.paper, borderColor: active ? COLORS.accentRed : COLORS.line },
        active && styles.themeCardActive,
        pressed && { opacity: 0.85 },
      ]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Thème ${theme.name}`}
    >
      {/* Mini mock: ink hero bar + paper card + accent dot */}
      <View style={[styles.themePreviewHero, { backgroundColor: c.ink }]}>
        <View style={[styles.themePreviewAccent, { backgroundColor: c.accentRed }]} />
        <View style={[styles.themePreviewLine, { backgroundColor: c.onInkMuted }]} />
      </View>
      <View style={[styles.themePreviewCard, { backgroundColor: c.paperRaised, borderColor: c.line }]}>
        <View style={[styles.themePreviewDot, { backgroundColor: c.accentRed }]} />
        <View style={styles.themePreviewTexts}>
          <View style={[styles.themePreviewText, { backgroundColor: c.textInk }]} />
          <View style={[styles.themePreviewTextSm, { backgroundColor: c.textInkMuted }]} />
        </View>
        <View style={[styles.themePreviewDot, { backgroundColor: c.cyan }]} />
      </View>
      <View style={styles.themeCardFooter}>
        <Typography variant="bodyBold" color={c.textInk} numberOfLines={1}>{theme.name}</Typography>
        {active && <Ionicons name="checkmark-circle" size={18} color={COLORS.accentRed} />}
      </View>
      <Typography variant="caption" color={c.textInkMuted} numberOfLines={2} style={styles.themeCardDesc}>
        {theme.description}
      </Typography>
    </Pressable>
  );
}

function ToggleRow({
  icon, label, sublabel, value, onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIconWrap}>
        <Ionicons name={icon} size={18} color={COLORS.textInk} />
      </View>
      <View style={styles.settingTexts}>
        <Typography variant="subheading" color={COLORS.textInk}>{label}</Typography>
        <Typography variant="label" color={COLORS.textInkMuted}>{sublabel}</Typography>
      </View>
      <Switch
        value={value}
        onValueChange={v => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(v);
        }}
        trackColor={{ false: COLORS.paperSunken, true: COLORS.accentRed }}
        thumbColor={COLORS.paperRaised}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const theme = useSettingsStore(s => s.theme);
  const scanLang = useSettingsStore(s => s.scanLang);
  const dataSaver = useSettingsStore(s => s.dataSaver);
  const haptics = useSettingsStore(s => s.haptics);
  const setTheme = useSettingsStore(s => s.setTheme);
  const setScanLang = useSettingsStore(s => s.setScanLang);
  const setDataSaver = useSettingsStore(s => s.setDataSaver);
  const setHaptics = useSettingsStore(s => s.setHaptics);

  const [cacheCleared, setCacheCleared] = useState(false);

  const handleSelectTheme = (id: ThemeId) => {
    if (id === theme) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTheme(id);
  };

  const handleClearCache = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
      setCacheCleared(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setCacheCleared(false), 2500);
    } catch {
      // best effort — cache clearing can fail silently on some platforms
    }
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Fermer les paramètres"
          hitSlop={8}
        >
          <Ionicons name="chevron-down" size={22} color={COLORS.textInk} />
        </Pressable>
        <View>
          <Typography variant="kicker" color={COLORS.accentRed}>PERSONNALISATION</Typography>
          <Typography variant="hero" color={COLORS.textInk} style={styles.headerTitle}>Paramètres</Typography>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        {/* ── APPARENCE ── */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        >
          <SectionHeader icon="color-palette" title="Apparence" />
          <Typography variant="label" color={COLORS.textInkMuted} style={styles.sectionHint}>
            Le thème s&apos;applique immédiatement à toute l&apos;app.
          </Typography>
          <View style={styles.themeGrid}>
            {THEME_ORDER.map(id => (
              <ThemeCard key={id} id={id} active={theme === id} onSelect={() => handleSelectTheme(id)} />
            ))}
          </View>
        </MotiView>

        {/* ── LECTURE ── */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 80 }}
        >
          <SectionHeader icon="book" title="Lecture" />
          <Panel variant="paper" bordered style={styles.card}>
            <View style={styles.cardInner}>
              <View style={styles.settingRow}>
                <View style={styles.settingIconWrap}>
                  <Ionicons name="language" size={18} color={COLORS.textInk} />
                </View>
                <View style={styles.settingTexts}>
                  <Typography variant="subheading" color={COLORS.textInk}>Langue des scans</Typography>
                  <Typography variant="label" color={COLORS.textInkMuted}>
                    Langue préférée, l&apos;autre sert de secours
                  </Typography>
                </View>
                <View style={styles.langToggle}>
                  {(['fr', 'en'] as ScanLang[]).map(lang => (
                    <Pressable
                      key={lang}
                      style={[styles.langBtn, scanLang === lang && styles.langBtnActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setScanLang(lang);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: scanLang === lang }}
                      accessibilityLabel={lang === 'fr' ? 'Français' : 'English'}
                    >
                      <Typography
                        variant="caption"
                        style={scanLang === lang ? styles.langBtnLabelActive : styles.langBtnLabel}
                      >
                        {lang.toUpperCase()}
                      </Typography>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.divider} />

              <ToggleRow
                icon="cellular"
                label="Économie de données"
                sublabel="Images compressées dans le lecteur"
                value={dataSaver}
                onChange={setDataSaver}
              />

              <View style={styles.divider} />

              <ToggleRow
                icon="radio-button-on"
                label="Retour haptique"
                sublabel="Vibrations sur les interactions"
                value={haptics}
                onChange={setHaptics}
              />
            </View>
          </Panel>
        </MotiView>

        {/* ── DONNÉES ── */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 160 }}
        >
          <SectionHeader icon="server" title="Données" />
          <Panel variant="paper" bordered style={styles.card}>
            <View style={styles.cardInner}>
              <Pressable
                style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}
                onPress={handleClearCache}
                accessibilityRole="button"
                accessibilityLabel="Vider le cache des images"
              >
                <View style={styles.settingIconWrap}>
                  <Ionicons
                    name={cacheCleared ? 'checkmark-circle' : 'trash-bin-outline'}
                    size={18}
                    color={cacheCleared ? COLORS.statusCompleted : COLORS.textInk}
                  />
                </View>
                <View style={styles.settingTexts}>
                  <Typography variant="subheading" color={COLORS.textInk}>
                    {cacheCleared ? 'Cache vidé ✓' : 'Vider le cache des images'}
                  </Typography>
                  <Typography variant="label" color={COLORS.textInkMuted}>
                    Couvertures et pages re-téléchargées au besoin
                  </Typography>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textInkFaint} />
              </Pressable>
            </View>
          </Panel>
        </MotiView>

        {/* ── À PROPOS ── */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 240 }}
        >
          <SectionHeader icon="information-circle" title="À propos" />
          <Panel variant="paper" bordered style={styles.card}>
            <View style={styles.cardInner}>
              <View style={styles.settingRow}>
                <View style={styles.settingIconWrap}>
                  <Ionicons name="bookmarks" size={18} color={COLORS.textInk} />
                </View>
                <View style={styles.settingTexts}>
                  <Typography variant="subheading" color={COLORS.textInk}>Version</Typography>
                  <Typography variant="label" color={COLORS.textInkMuted}>{version}</Typography>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.aboutBlock}>
                <Typography variant="caption" color={COLORS.textInkFaint} style={styles.aboutLabel}>
                  SOURCES DE DONNÉES
                </Typography>
                <View style={styles.sourcesWrap}>
                  {DATA_SOURCES.map(s => (
                    <View key={s} style={styles.sourceChip}>
                      <Typography variant="label" color={COLORS.textInkMuted}>{s}</Typography>
                    </View>
                  ))}
                </View>
                <Typography variant="label" color={COLORS.textInkFaint} style={styles.aboutNote}>
                  Les scans lisibles proviennent de plateformes communautaires.
                  Soutenez les auteurs en achetant les œuvres officielles.
                </Typography>
              </View>
            </View>
          </Panel>
        </MotiView>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDERS.hair,
    borderBottomColor: COLORS.line,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 30, lineHeight: 34 },

  scroll: { padding: SPACING.base, gap: SPACING.lg },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sectionMarker: { width: 4, height: 20, backgroundColor: COLORS.accentRed, borderRadius: 2 },
  sectionHint: { marginBottom: SPACING.sm },

  // ── Theme grid ──
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  themeCard: {
    width: '47.5%',
    borderRadius: RADIUS.lg,
    borderWidth: BORDERS.bold,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  themeCardActive: { borderWidth: BORDERS.heavy },
  themePreviewHero: {
    height: 34,
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
  },
  themePreviewAccent: { width: 14, height: 14, borderRadius: 7 },
  themePreviewLine: { flex: 1, height: 4, borderRadius: 2, opacity: 0.6 },
  themePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  themePreviewDot: { width: 10, height: 10, borderRadius: 5 },
  themePreviewTexts: { flex: 1, gap: 3 },
  themePreviewText: { height: 5, borderRadius: 2, width: '80%' },
  themePreviewTextSm: { height: 4, borderRadius: 2, width: '55%', opacity: 0.7 },
  themeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  themeCardDesc: { textTransform: 'none', letterSpacing: 0, lineHeight: 14 },

  // ── Setting rows ──
  card: { borderRadius: RADIUS.lg },
  cardInner: { padding: SPACING.md, gap: SPACING.md },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 44,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTexts: { flex: 1, gap: 2 },
  divider: { height: BORDERS.hair, backgroundColor: COLORS.line },

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
    paddingVertical: SPACING.xs + 2,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBtnActive: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBtnLabel: { letterSpacing: 0.8, fontSize: 10, color: COLORS.textInkMuted },
  langBtnLabelActive: { letterSpacing: 0.8, fontSize: 10, color: COLORS.onInk },

  aboutBlock: { gap: SPACING.sm },
  aboutLabel: { letterSpacing: 1.2 },
  sourcesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  sourceChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.paperSunken,
    borderWidth: BORDERS.hair,
    borderColor: COLORS.line,
  },
  aboutNote: { lineHeight: 18, marginTop: SPACING.xs },
}));
