/**
 * THEMES — five complete palettes for the Ink Manga design system.
 *
 * Every theme keeps the same two-world semantics as the default:
 *  - "paper" world: main UI surfaces, textInk* tokens on top.
 *  - "ink" world: hero / media panels, onInk* tokens on top.
 * In dark themes the paper world simply becomes dark — the semantics hold,
 * which is what lets one token set drive five very different looks.
 *
 * Palette directions (2026 research):
 *  - Nuit d'encre  — warm dark-first, vermillion kept hot (dark chrome trend)
 *  - Néo-Tokyo     — OLED near-black + electric cyan / sharp rose (IDE/cyber)
 *  - Sakura        — washi pink + deep plum + wisteria (soft-tech pastel)
 *  - Kraft         — kraft sepia + espresso + burnt orange (vintage BD album)
 */

export type ThemeId = 'ink-paper' | 'nuit-encre' | 'neo-tokyo' | 'sakura' | 'kraft';

export interface ThemeColors {
  bg: string;
  surface: string;
  accent: string;
  cyan: string;
  cyanMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  star: string;

  statusReading: string;
  statusCompleted: string;
  statusPlan: string;
  statusDropped: string;
  statusPaused: string;

  typeMANGA: string;
  typeMANHWA: string;
  typeMANHUA: string;
  typeWEBTOON: string;
  typeBD: string;

  paper: string;
  paperRaised: string;
  paperSunken: string;

  ink: string;
  inkSoft: string;

  textInk: string;
  textInkSoft: string;
  textInkMuted: string;
  textInkFaint: string;
  onInk: string;
  onInkMuted: string;

  accentRed: string;
  accentDeep: string;
  accentBright: string;
  accentSoft: string;
  accentSoftInk: string;

  line: string;
  lineStrong: string;
  lineOnInk: string;

  halftone: string;
}

export interface ThemeScrims {
  subtle: string;
  medium: string;
  heavy: string;
  full: string;
  paper: string;
}

export interface AppTheme {
  id: ThemeId;
  name: string;
  description: string;
  mode: 'light' | 'dark';
  colors: ThemeColors;
  scrims: ThemeScrims;
  /** "r, g, b" of the ink base — used by inkScrim() for arbitrary-alpha overlays */
  inkRGB: string;
}

// Shared type-badge hues tweaked per mode for contrast
const TYPE_LIGHT = {
  typeMANGA: '#C2306B',
  typeMANHWA: '#245FA6',
  typeMANHUA: '#C2410C',
  typeWEBTOON: '#15803D',
  typeBD: '#9A6212',
};
const TYPE_DARK = {
  typeMANGA: '#E0568D',
  typeMANHWA: '#5B8FD6',
  typeMANHUA: '#E06A2B',
  typeWEBTOON: '#34C272',
  typeBD: '#C99339',
};

function scrimsFrom(inkRGB: string, paperRGBA: string): ThemeScrims {
  return {
    subtle: `rgba(${inkRGB}, 0.4)`,
    medium: `rgba(${inkRGB}, 0.6)`,
    heavy: `rgba(${inkRGB}, 0.85)`,
    full: `rgba(${inkRGB}, 0.92)`,
    paper: paperRGBA,
  };
}

// ── 1. Encre & Papier (default) ───────────────────────────────────────────────
const inkPaper: AppTheme = {
  id: 'ink-paper',
  name: 'Encre & Papier',
  description: 'Crème manga, encre chaude, vermillon — le thème signature.',
  mode: 'light',
  colors: {
    bg: '#F4EFE3',
    surface: '#FCFAF4',
    accent: '#E11D17',
    cyan: '#1F6F8B',
    cyanMuted: 'rgba(31, 111, 139, 0.14)',
    text: '#1A1611',
    textSecondary: '#6E6656',
    textMuted: '#7A7163',
    border: 'rgba(26, 22, 17, 0.14)',
    success: '#1B7A45',
    warning: '#B9710C',
    error: '#B3140F',
    star: '#E8A50C',
    statusReading: '#E11D17',
    statusCompleted: '#1B7A45',
    statusPlan: '#1F6F8B',
    statusDropped: '#8A8276',
    statusPaused: '#B9710C',
    ...TYPE_LIGHT,
    paper: '#F4EFE3',
    paperRaised: '#FCFAF4',
    paperSunken: '#EAE3D3',
    ink: '#16130E',
    inkSoft: '#2C261D',
    textInk: '#1A1611',
    textInkSoft: '#403A30',
    textInkMuted: '#6E6656',
    textInkFaint: '#7A7163',
    onInk: '#F4EFE3',
    onInkMuted: '#B7AD99',
    accentRed: '#E11D17',
    accentDeep: '#B3140F',
    accentBright: '#F23B30',
    accentSoft: 'rgba(225, 29, 23, 0.12)',
    accentSoftInk: 'rgba(242, 59, 48, 0.18)',
    line: 'rgba(26, 22, 17, 0.12)',
    lineStrong: 'rgba(26, 22, 17, 0.22)',
    lineOnInk: 'rgba(244, 239, 227, 0.16)',
    halftone: 'rgba(26, 22, 17, 0.9)',
  },
  scrims: scrimsFrom('22, 19, 14', 'rgba(244, 239, 227, 0.85)'),
  inkRGB: '22, 19, 14',
};

// ── 2. Nuit d'encre (warm dark) ───────────────────────────────────────────────
const nuitEncre: AppTheme = {
  id: 'nuit-encre',
  name: "Nuit d'encre",
  description: 'Sombre et chaud, vermillon incandescent — lecture nocturne.',
  mode: 'dark',
  colors: {
    bg: '#181410',
    surface: '#221D17',
    accent: '#F0382E',
    cyan: '#3FA7C7',
    cyanMuted: 'rgba(63, 167, 199, 0.16)',
    text: '#F1EAD9',
    textSecondary: '#A89C85',
    textMuted: '#8A7F6C',
    border: 'rgba(241, 234, 217, 0.14)',
    success: '#3DA56B',
    warning: '#D08A1F',
    error: '#F0382E',
    star: '#F2B33D',
    statusReading: '#F0382E',
    statusCompleted: '#3DA56B',
    statusPlan: '#3FA7C7',
    statusDropped: '#8A8276',
    statusPaused: '#D08A1F',
    ...TYPE_DARK,
    paper: '#181410',
    paperRaised: '#221D17',
    paperSunken: '#100D0A',
    ink: '#0B0908',
    inkSoft: '#251F18',
    textInk: '#F1EAD9',
    textInkSoft: '#D8CFBC',
    textInkMuted: '#A89C85',
    textInkFaint: '#8A7F6C',
    onInk: '#F4EFE3',
    onInkMuted: '#B7AD99',
    accentRed: '#F0382E',
    accentDeep: '#C2241B',
    accentBright: '#FF5A4F',
    accentSoft: 'rgba(240, 56, 46, 0.16)',
    accentSoftInk: 'rgba(255, 90, 79, 0.2)',
    line: 'rgba(241, 234, 217, 0.12)',
    lineStrong: 'rgba(241, 234, 217, 0.22)',
    lineOnInk: 'rgba(244, 239, 227, 0.14)',
    halftone: 'rgba(241, 234, 217, 0.9)',
  },
  scrims: scrimsFrom('11, 9, 8', 'rgba(24, 20, 16, 0.85)'),
  inkRGB: '11, 9, 8',
};

// ── 3. Néo-Tokyo (OLED cyber) ─────────────────────────────────────────────────
const neoTokyo: AppTheme = {
  id: 'neo-tokyo',
  name: 'Néo-Tokyo',
  description: 'Noir OLED, cyan électrique, rose nervuré — énergie cyberpunk.',
  mode: 'dark',
  colors: {
    bg: '#050608',
    surface: '#0E1116',
    accent: '#22D3EE',
    cyan: '#F0427C',
    cyanMuted: 'rgba(240, 66, 124, 0.16)',
    text: '#E6EDF3',
    textSecondary: '#8B98A8',
    textMuted: '#6E7B8A',
    border: 'rgba(230, 237, 243, 0.12)',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    star: '#FBBF24',
    statusReading: '#22D3EE',
    statusCompleted: '#34D399',
    statusPlan: '#818CF8',
    statusDropped: '#64748B',
    statusPaused: '#FBBF24',
    ...TYPE_DARK,
    paper: '#050608',
    paperRaised: '#0E1116',
    paperSunken: '#020304',
    ink: '#0A0D12',
    inkSoft: '#1A2029',
    textInk: '#E6EDF3',
    textInkSoft: '#C3CDD8',
    textInkMuted: '#8B98A8',
    textInkFaint: '#6E7B8A',
    onInk: '#E6EDF3',
    onInkMuted: '#93A0B0',
    accentRed: '#22D3EE',
    accentDeep: '#0EA5C4',
    accentBright: '#67E8F9',
    accentSoft: 'rgba(34, 211, 238, 0.14)',
    accentSoftInk: 'rgba(103, 232, 249, 0.18)',
    line: 'rgba(230, 237, 243, 0.1)',
    lineStrong: 'rgba(230, 237, 243, 0.2)',
    lineOnInk: 'rgba(230, 237, 243, 0.12)',
    halftone: 'rgba(230, 237, 243, 0.9)',
  },
  scrims: scrimsFrom('5, 6, 8', 'rgba(5, 6, 8, 0.85)'),
  inkRGB: '5, 6, 8',
};

// ── 4. Sakura (soft light) ────────────────────────────────────────────────────
const sakura: AppTheme = {
  id: 'sakura',
  name: 'Sakura',
  description: 'Washi rosé, prune profonde, glycine — douceur hanami.',
  mode: 'light',
  colors: {
    bg: '#F9EFEC',
    surface: '#FFFBF9',
    accent: '#D1335B',
    cyan: '#6D5AA8',
    cyanMuted: 'rgba(109, 90, 168, 0.14)',
    text: '#33212B',
    textSecondary: '#7D6271',
    textMuted: '#8E7383',
    border: 'rgba(51, 33, 43, 0.14)',
    success: '#2E7D52',
    warning: '#B9710C',
    error: '#A82248',
    star: '#DB9A0F',
    statusReading: '#D1335B',
    statusCompleted: '#2E7D52',
    statusPlan: '#6D5AA8',
    statusDropped: '#97848D',
    statusPaused: '#B9710C',
    ...TYPE_LIGHT,
    paper: '#F9EFEC',
    paperRaised: '#FFFBF9',
    paperSunken: '#F1E2DE',
    ink: '#2B1B22',
    inkSoft: '#4A3340',
    textInk: '#33212B',
    textInkSoft: '#54394A',
    textInkMuted: '#7D6271',
    textInkFaint: '#8E7383',
    onInk: '#FAF0EE',
    onInkMuted: '#D9BFCB',
    accentRed: '#D1335B',
    accentDeep: '#A82248',
    accentBright: '#E85480',
    accentSoft: 'rgba(209, 51, 91, 0.12)',
    accentSoftInk: 'rgba(232, 84, 128, 0.18)',
    line: 'rgba(51, 33, 43, 0.12)',
    lineStrong: 'rgba(51, 33, 43, 0.22)',
    lineOnInk: 'rgba(250, 240, 238, 0.16)',
    halftone: 'rgba(51, 33, 43, 0.9)',
  },
  scrims: scrimsFrom('43, 27, 34', 'rgba(249, 239, 236, 0.85)'),
  inkRGB: '43, 27, 34',
};

// ── 5. Kraft (vintage sepia) ──────────────────────────────────────────────────
const kraft: AppTheme = {
  id: 'kraft',
  name: 'Kraft',
  description: 'Papier kraft, espresso, orange brûlée — album BD vintage.',
  mode: 'light',
  colors: {
    bg: '#E8D9BF',
    surface: '#F4EAD6',
    accent: '#C7541A',
    cyan: '#225E6B',
    cyanMuted: 'rgba(34, 94, 107, 0.14)',
    text: '#2E2414',
    textSecondary: '#6B5A3C',
    textMuted: '#7C6B4C',
    border: 'rgba(46, 36, 20, 0.16)',
    success: '#356B2F',
    warning: '#A06A10',
    error: '#9E3F10',
    star: '#C28A12',
    statusReading: '#C7541A',
    statusCompleted: '#356B2F',
    statusPlan: '#225E6B',
    statusDropped: '#8A7C66',
    statusPaused: '#A06A10',
    ...TYPE_LIGHT,
    paper: '#E8D9BF',
    paperRaised: '#F4EAD6',
    paperSunken: '#DCCAA9',
    ink: '#2B2012',
    inkSoft: '#4A3A24',
    textInk: '#2E2414',
    textInkSoft: '#4E3F28',
    textInkMuted: '#6B5A3C',
    textInkFaint: '#7C6B4C',
    onInk: '#F2E8D2',
    onInkMuted: '#C4B391',
    accentRed: '#C7541A',
    accentDeep: '#9E3F10',
    accentBright: '#E06A2B',
    accentSoft: 'rgba(199, 84, 26, 0.13)',
    accentSoftInk: 'rgba(224, 106, 43, 0.2)',
    line: 'rgba(46, 36, 20, 0.14)',
    lineStrong: 'rgba(46, 36, 20, 0.24)',
    lineOnInk: 'rgba(242, 232, 210, 0.16)',
    halftone: 'rgba(46, 36, 20, 0.9)',
  },
  scrims: scrimsFrom('43, 32, 18', 'rgba(232, 217, 191, 0.85)'),
  inkRGB: '43, 32, 18',
};

export const THEMES: Record<ThemeId, AppTheme> = {
  'ink-paper': inkPaper,
  'nuit-encre': nuitEncre,
  'neo-tokyo': neoTokyo,
  sakura,
  kraft,
};

export const THEME_ORDER: ThemeId[] = ['ink-paper', 'nuit-encre', 'neo-tokyo', 'sakura', 'kraft'];

export const DEFAULT_THEME: ThemeId = 'ink-paper';
