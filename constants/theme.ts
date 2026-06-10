/**
 * INK MANGA — Design system (duotone "paper + ink panels")
 *
 * Two worlds:
 *  - PAPER world (default UI): warm cream surfaces, ink text/borders, manga-red accent.
 *  - INK world (hero / media / reader): near-black warm panels with cream content,
 *    so covers and immersive surfaces still pop like framed manga panels.
 *
 * Legacy keys (bg, surface, text, accent, …) are kept and remapped to the new
 * palette so existing screens keep compiling; new semantic tokens are added below.
 *
 * Palettes live in constants/themes.ts; this module owns the live token
 * objects (COLORS / SCRIMS / HARD_SHADOW) and the theming machinery.
 */

import {
  DEFAULT_THEME,
  THEMES,
  type ThemeColors,
  type ThemeId,
  type ThemeScrims,
} from './themes';

export { THEMES, THEME_ORDER, DEFAULT_THEME } from './themes';
export type { AppTheme, ThemeColors, ThemeId, ThemeScrims } from './themes';

/**
 * COLORS is a MUTABLE token object: applyTheme() overwrites every value in
 * place so the hundreds of existing `COLORS.x` reads stay valid. Style sheets
 * pick up the change through themedStyles() + the full remount in _layout.
 */
export const COLORS: ThemeColors = { ...THEMES[DEFAULT_THEME].colors };

/** Ink scrims for overlays on images / modals — themed alongside COLORS. */
export const SCRIMS: ThemeScrims = { ...THEMES[DEFAULT_THEME].scrims };

let themeVersion = 0;
let currentThemeId: ThemeId = DEFAULT_THEME;
let currentInkRGB = THEMES[DEFAULT_THEME].inkRGB;

export function getCurrentTheme(): ThemeId {
  return currentThemeId;
}

/** Arbitrary-alpha overlay based on the active theme's ink. */
export function inkScrim(alpha: number): string {
  return `rgba(${currentInkRGB}, ${alpha})`;
}

/** Swap every color token in place, then invalidate themedStyles caches. */
export function applyTheme(id: ThemeId): void {
  const theme = THEMES[id] ?? THEMES[DEFAULT_THEME];
  currentThemeId = theme.id;
  currentInkRGB = theme.inkRGB;
  Object.assign(COLORS, theme.colors);
  Object.assign(SCRIMS, theme.scrims);
  HARD_SHADOW.shadowColor = theme.colors.ink;
  themeVersion += 1;
}

/**
 * Lazily (re)builds a StyleSheet whenever the theme changes.
 * Usage: `const styles = themedStyles(() => StyleSheet.create({ … }))`.
 * The factory re-runs on first property access after applyTheme(), so the
 * module-level `styles` constant stays theme-correct without React context.
 */
export function themedStyles<T extends object>(factory: () => T): T {
  let cache: T | undefined;
  let cachedVersion = -1;
  return new Proxy({} as T, {
    get(_, prop) {
      if (cachedVersion !== themeVersion || cache === undefined) {
        cache = factory();
        cachedVersion = themeVersion;
      }
      return cache[prop as keyof T];
    },
  });
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/** Manga = sharper geometry; rounding stays modest, borders carry the weight. */
export const RADIUS = {
  sm: 5,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 22,
  full: 9999,
} as const;

/** Ink border weights for manga "panel" framing. */
export const BORDERS = {
  hair: 1,
  bold: 2,
  heavy: 3,
} as const;

/** Hard offset ink shadow (no blur) — the signature manga-panel drop.
 *  Mutable: applyTheme() retargets shadowColor to the theme's ink. */
export const HARD_SHADOW: {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
} = {
  shadowColor: '#16130E',
  shadowOffset: { width: 3, height: 3 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 4,
};

export const FONTS = {
  display: 'BebasNeue_400Regular', // condensed impact caps (numbers, SFX, kickers)
  serif: 'Fraunces_600SemiBold', // editorial titles
  serifBlack: 'Fraunces_900Black', // hero / big editorial
  heading: 'SpaceGrotesk_700Bold', // UI headings
  headingMedium: 'SpaceGrotesk_500Medium', // UI labels
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  READING: 'En cours',
  COMPLETED: 'Terminé',
  PLAN_TO_READ: 'À lire',
  DROPPED: 'Abandonné',
  PAUSED: 'En pause',
};

export const TYPE_LABELS: Record<string, string> = {
  ALL: 'Tout',
  MANGA: 'Manga',
  MANHWA: 'Manhwa',
  MANHUA: 'Manhua',
  WEBTOON: 'Webtoon',
  BD: 'BD',
};
