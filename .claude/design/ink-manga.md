# INK MANGA — Design language (2026)

The single source of truth for the MangaTrack redesign. Every screen/component
must obey this. Import all values from `@/constants/theme` — never hardcode hex.

## Philosophy: duotone "paper + ink panels"

The app reads like a modern manga magazine. Two worlds, used deliberately:

- **PAPER world** — default chrome (nav, lists, cards, text, forms). Warm cream
  background (`COLORS.paper`), ink text (`COLORS.textInk`), thin ink hairlines
  (`COLORS.line`), bold ink frames (`BORDERS.bold`/`heavy` in `COLORS.ink`),
  manga-red accent (`COLORS.accentRed`). Screentone halftone for texture.
- **INK world** — immersive/media surfaces (hero headers, cover frames, reader).
  Near-black warm panels (`COLORS.ink`) with cream content (`COLORS.onInk`).
  Covers live inside ink frames so they pop like panels on a page.

Rule of thumb: information & navigation = paper; imagery & immersion = ink.

## Typography (Typography component variants)

Three families, each with a job:
- **Fraunces** (`FONTS.serif`/`serifBlack`/`serifItalic`) — editorial titles,
  hero titles, section headers. The signature voice.
- **Bebas Neue** (`FONTS.display`) — condensed impact CAPS: kickers, big numbers,
  stat figures, SFX labels. Always uppercase, wide letter-spacing.
- **Space Grotesk** (`FONTS.heading`/`headingMedium`) — UI labels, buttons, chips,
  metadata.
- **Nunito** (`FONTS.body`/`bodyMedium`/`bodyBold`) — running text, synopsis.

Variants to expose (restyle the existing names, add the new ones):
| variant | font | use |
|---|---|---|
| `hero` | serifBlack | screen hero titles, `clamp` huge (34–44) |
| `title` | serif | section + card titles (20–26) |
| `display` | display (Bebas) | big numbers / SFX (kept) |
| `kicker` | display (Bebas) | tiny uppercase eyebrow label, letter-spacing 2, accent-red |
| `heading` | heading | UI headings (17–20) |
| `subheading` | headingMedium | secondary UI (14–15) |
| `body` | body | running text (line-height 1.6) |
| `bodyBold` | bodyBold | emphasis |
| `label` | headingMedium | metadata/chips (12–13) |
| `caption` | headingMedium | uppercase micro labels, letter-spacing 0.8, muted |

Default text color `COLORS.textInk`. Provide `color` prop. For ink surfaces pass
`COLORS.onInk`.

## Core primitives (build these in the foundation pass)

### `Panel` (replaces GlassCard for paper UI)
A framed manga panel. Props: `variant?: 'paper' | 'ink' | 'outline'`, `bordered?`,
`hardShadow?`, `style`, `children`, `radius?`.
- `paper`: bg `COLORS.paperRaised`, `BORDERS.bold` solid `COLORS.ink`, radius `RADIUS.lg`.
- `ink`: bg `COLORS.ink`, content cream.
- `outline`: transparent bg, ink border only.
- `hardShadow`: apply `HARD_SHADOW` (offset ink shadow, no blur) — the hero look.
Cross-platform: no BlurView (drop glass). Plain Views + borders only.

### `Halftone` (screentone background texture)
`react-native-svg` overlay of a dot grid (`<Pattern>` of small circles in
`COLORS.halftone` at ~0.06–0.1 opacity). Props: `tint?`, `opacity?`, `dotRadius?`,
`gap?`. Used behind hero/empty states for depth. Must be `pointerEvents="none"`,
absolutely filled. Respect `prefers-reduced-motion` is N/A (static).

### `SpeedLines` (optional accent)
SVG radial lines from a focal point for hero/empty flourish. Subtle, low opacity.

### Floating tab bar (`components/ui/TabBar.tsx`)
- Detached pill, ~16px from bottom (`+ insets.bottom`), horizontal margin 16.
- bg `COLORS.ink` (ink world) OR cream with heavy ink border — pick **ink pill**
  (cream icons on ink) for contrast and drama. Radius `RADIUS.full`, `HARD_SHADOW`.
- 4 tabs. Active: a manga-red **rounded rect indicator** that slides between slots
  with spring (reanimated `withSpring`, stiffness ~300 damping ~26). Active icon
  scales to ~1.12 and its **label fades/expands in** beside or under it; inactive
  tabs show icon only (cream-muted). Haptics `selectionAsync` on change.
- Respect reduced motion: if reduced, snap instead of animate.

### Buttons / Chips
- Primary button: bg `COLORS.accentRed`, cream text, `FONTS.heading` uppercase,
  radius `RADIUS.md`, press scale 0.97 + `COLORS.accentDeep`.
- Secondary: outline (ink border, ink text on paper).
- Chip/badge: small, `FONTS.headingMedium`, ink border or soft-red fill.
- Min touch target 44×44 (use `hitSlop` if visual is smaller).

## Motion language

- **Spring physics everywhere** (reanimated / moti): list/section entrances use a
  staggered reveal-up (translateY 12→0, opacity 0→1, spring stiffness ~300 damping
  ~26, stagger ≤ 60ms, cap total delay ~300ms).
- **Press feedback**: scale 0.96–0.97 + slight brightness/accentDeep, ~80ms.
- **Hero entrance**: one orchestrated reveal (kicker → title → meta), not scattered.
- **Shared continuity**: detail screen opens `slide_from_bottom`; reader too.
- **Check/toggle**: a satisfying spring pop on the check circle when marking read.
- **Reduced motion**: gate non-essential animation behind
  `useReducedMotion()` (from `react-native-reanimated`) — provide static fallback.

## Manga signature details

- Bold ink frames (2px) on cards/covers; occasional `HARD_SHADOW` offset.
- Halftone screentone behind heroes/empty states.
- Kickers in Bebas (e.g. `TENDANCES`, `CONTINUER`, `À LIRE`) in accent red.
- Editorial serif (Fraunces) for titles — large, tight tracking.
- Section headers: small red square/▍ marker + serif title (manga chapter-title feel).
- Covers always framed (ink border) with a subtle corner or number tag.
- Accent red used sparingly but boldly (one focal action per screen).

## Accessibility (WCAG AA — enforced)

- Contrast: ink (#1A1611) on paper (#F4EFE3) ≈ 12:1 ✓; red on cream for large/bold
  only, never small body. Use ink for body text.
- All interactive elements keyboard/touch reachable, `accessibilityRole`/labels.
- Loading / empty / error / success states handled on every data surface.
- `prefers-reduced-motion` respected for all motion.
- Status bar style `dark` (we're on light paper) except reader (light on black).

## Per-screen intent (summary)

- **Découvrir**: ink hero with kicker + serif title + framed cover; paper rows with
  red section markers; pull-to-refresh; error/empty states.
- **À lire**: two pill sub-tabs; framed-cover grid; "récemment sorties" calendar
  grouped by day with check circles.
- **Rechercher**: ink search field, framed result grid, type filter chips.
- **Profil**: ink hero header (avatar + name), Bebas stat figures, status bars in
  ink+red, paper history list with red markers and relative dates.
- **Détail**: ink hero (cover framed) → paper body; serif title; A PROPOS / CHAPITRES
  tabs (chapters tab only when readable chapters exist).
- **Chapitres**: "CONTINUER" panel; volume accordions with progress bars; chapter
  rows = framed cover + serif chapter title + big check circle; tap center = reader,
  long-press = detail sheet (rating/reactions/platform).
- **Reader**: pure black, vertical webtoon scroll, minimal ink chrome, page pill.
