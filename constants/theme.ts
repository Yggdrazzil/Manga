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
 */

const PAPER = {
  base: '#F4EFE3', // manga page cream
  raised: '#FCFAF4', // white-ish card
  sunken: '#EAE3D3', // inset / track
  dim: '#E1D9C6',
};

const INK = {
  base: '#16130E', // warm near-black (panels, reader)
  raised: '#211C15',
  soft: '#2C261D',
};

const TEXT = {
  ink: '#1A1611', // primary on paper
  inkSoft: '#403A30',
  inkMuted: '#6E6656', // secondary
  inkFaint: '#7A7163', // captions — ≥3:1 on paper (WCAG AA large text)
  onInk: '#F4EFE3', // primary on ink panels
  onInkMuted: '#B7AD99',
};

const ACCENT = {
  red: '#E11D17', // manga vermillion (Shonen-Jump energy)
  redDeep: '#B3140F', // pressed / shadow
  redBright: '#F23B30', // highlight
  redSoft: 'rgba(225, 29, 23, 0.12)', // tint fill on paper
  redSoftInk: 'rgba(242, 59, 48, 0.18)', // tint fill on ink
};

export const COLORS = {
  // ---- Legacy keys (remapped to Ink Manga) ----
  bg: PAPER.base,
  surface: PAPER.raised,
  accent: ACCENT.red,
  cyan: '#1F6F8B', // secondary ink-teal accent (BD identity)
  cyanMuted: 'rgba(31, 111, 139, 0.14)',
  text: TEXT.ink,
  textSecondary: TEXT.inkMuted,
  textMuted: TEXT.inkFaint,
  border: 'rgba(26, 22, 17, 0.14)',
  success: '#1B7A45',
  warning: '#B9710C',
  error: '#B3140F',
  star: '#E8A50C', // rating stars — readable on paper and ink

  statusReading: ACCENT.red,
  statusCompleted: '#1B7A45',
  statusPlan: '#1F6F8B',
  statusDropped: '#8A8276',
  statusPaused: '#B9710C',

  typeMANGA: '#C2306B',
  typeMANHWA: '#245FA6',
  typeMANHUA: '#C2410C',
  typeWEBTOON: '#15803D',
  typeBD: '#9A6212',

  // ---- New semantic tokens ----
  paper: PAPER.base,
  paperRaised: PAPER.raised,
  paperSunken: PAPER.sunken,

  ink: INK.base,
  inkSoft: INK.soft,

  textInk: TEXT.ink,
  textInkSoft: TEXT.inkSoft,
  textInkMuted: TEXT.inkMuted,
  textInkFaint: TEXT.inkFaint,
  onInk: TEXT.onInk,
  onInkMuted: TEXT.onInkMuted,

  accentRed: ACCENT.red,
  accentDeep: ACCENT.redDeep,
  accentBright: ACCENT.redBright,
  accentSoft: ACCENT.redSoft,
  accentSoftInk: ACCENT.redSoftInk,

  line: 'rgba(26, 22, 17, 0.12)', // hairline on paper
  lineStrong: 'rgba(26, 22, 17, 0.22)',
  lineOnInk: 'rgba(244, 239, 227, 0.16)',

  halftone: 'rgba(26, 22, 17, 0.9)', // dot ink for screentone
} as const;

/** Ink scrims for overlays on images / modals — single source instead of 8 hand-written rgba. */
export const SCRIMS = {
  subtle: 'rgba(22, 19, 14, 0.4)',
  medium: 'rgba(22, 19, 14, 0.6)',
  heavy: 'rgba(22, 19, 14, 0.85)',
  full: 'rgba(22, 19, 14, 0.92)',
  paper: 'rgba(244, 239, 227, 0.85)',
} as const;

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

/** Hard offset ink shadow (no blur) — the signature manga-panel drop. */
export const HARD_SHADOW = {
  shadowColor: '#16130E',
  shadowOffset: { width: 3, height: 3 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 4,
} as const;

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
