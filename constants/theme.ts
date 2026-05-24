export const COLORS = {
  bg: '#0A0B14',
  surface: '#111220',
  surfaceRaised: '#1A1B2E',
  glassBorder: 'rgba(255, 255, 255, 0.09)',
  accent: '#8B5CF6',
  accentLight: '#A78BFA',
  accentMuted: 'rgba(139, 92, 246, 0.18)',
  cyan: '#22D3EE',
  cyanMuted: 'rgba(34, 211, 238, 0.15)',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
  border: 'rgba(255, 255, 255, 0.07)',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  statusReading: '#8B5CF6',
  statusCompleted: '#22C55E',
  statusPlan: '#22D3EE',
  statusDropped: '#EF4444',
  statusPaused: '#F59E0B',

  typeMANGA: '#F472B6',
  typeMANHWA: '#60A5FA',
  typeMANHUA: '#FB923C',
  typeWEBTOON: '#34D399',
  typeBD: '#FBBF24',
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

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const;

export const FONTS = {
  display: 'BebasNeue_400Regular',
  heading: 'SpaceGrotesk_700Bold',
  headingMedium: 'SpaceGrotesk_500Medium',
  body: 'Nunito_400Regular',
  bodyBold: 'Nunito_700Bold',
  bodyMedium: 'Nunito_600SemiBold',
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
