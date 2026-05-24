---
name: frontend-aesthetics
description: >
  Typography, color, motion, and background guidelines for distinctive,
  non-generic frontends. Invoke for any visual design task. Prevents
  "AI slop" aesthetic — generic Bootstrap-era designs.
---

# Frontend Aesthetics

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design,
this creates what users call the "AI slop" aesthetic. Avoid this: make creative,
distinctive frontends that surprise and delight.

**Typography:** Choose fonts that are beautiful, unique, and interesting.
NEVER use: Inter, Roboto, Arial, Open Sans, Lato, or system-ui as the primary face.

**Color & Theme:** Commit to a cohesive aesthetic. Use CSS variables for consistency.
Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
Draw from IDE themes and cultural aesthetics for inspiration.

**Motion:** Use animations for effects and micro-interactions. CSS-only for HTML.
Motion library for React. Focus on high-impact moments: one well-orchestrated
page load with staggered reveals creates more delight than scattered micro-interactions.

**Backgrounds:** Create atmosphere and depth. Layer CSS gradients, use geometric
patterns, or add contextual effects — never default to solid colors.

Interpret creatively. Make unexpected choices that feel genuinely designed for
the context. Vary between light/dark themes, different fonts, different aesthetics.
</frontend_aesthetics>

## Typography System

### Font Choices by Aesthetic
| Aesthetic | Display | Body | Mono |
|-----------|---------|------|------|
| Technical/Code | Space Grotesk | IBM Plex Sans | JetBrains Mono |
| Editorial | Fraunces | Crimson Pro | Fira Code |
| Startup/Bold | Clash Display | Satoshi | Geist Mono |
| Distinctive | Bricolage Grotesque | Newsreader | Commit Mono |
| Manga/Graphic | Bebas Neue | Nunito | Source Code Pro |

**Pairing rule:** High contrast = interesting.
Display + monospace, serif + geometric sans, variable font across weights.

**Sizing extremes (not safe middles):**
```css
.heading-xl { font-size: clamp(3rem, 8vw, 7rem); font-weight: 900; letter-spacing: -0.03em; }
.heading-lg { font-size: clamp(1.75rem, 4vw, 3rem); font-weight: 700; }
.body      { font-size: 1rem; line-height: 1.7; font-weight: 400; }
.caption   { font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; }
```

## Color System

### Palette Patterns That Work
```css
/* Dark technical — IDE-inspired */
--bg: hsl(222 14% 8%);
--surface: hsl(222 12% 13%);
--accent: hsl(198 88% 55%);      /* electric cyan */
--accent-warm: hsl(346 84% 61%); /* sharp rose */

/* Manga/Ink */
--bg: hsl(45 20% 97%);
--surface: hsl(0 0% 100%);
--ink: hsl(0 0% 5%);
--accent: hsl(0 78% 48%);        /* manga red */
--panel-border: hsl(0 0% 12%);

/* Neo-brutalist */
--bg: hsl(55 100% 95%);
--surface: hsl(0 0% 100%);
--black: hsl(0 0% 0%);
--accent: hsl(272 100% 60%);     /* vivid purple */
--shadow: 4px 4px 0 var(--black);
```

### Rules
- Max 3 hues in a palette (+ neutral)
- One dominant, one accent, neutrals carry the rest
- Dark mode: don't just invert — redesign with atmosphere
- Never purple-gradient-on-white (most overused AI aesthetic)

## Animation System

### Performance-First Motion
```css
/* Page load: staggered reveal (orchestrated, high-impact) */
@keyframes reveal-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-in {
  animation: reveal-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.animate-in:nth-child(2) { animation-delay: 80ms; }
.animate-in:nth-child(3) { animation-delay: 160ms; }

/* Hover: subtle lift */
.card {
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px hsl(0 0% 0% / 0.15);
}

/* Press/active feedback */
.button:active {
  transform: scale(0.97);
  filter: brightness(0.9);
  transition: transform 80ms, filter 80ms;
}
```

### React Motion Library Patterns
```tsx
// Staggered list with AnimatePresence
import { motion, AnimatePresence } from 'motion/react'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } }
}

// Page transition
<motion.div
  initial={{ opacity: 0, x: 8 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -8 }}
  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
/>
```

### Animation Principles
1. **Orchestrate, don't scatter**: one great entrance beats 20 micro-interactions
2. **Spring physics > linear/ease**: `stiffness: 400, damping: 28` feels natural
3. **Exit animations matter**: AnimatePresence for smooth removals
4. **Respect reduced motion**: always provide `prefers-reduced-motion` fallback
5. **GPU-only properties**: animate `transform` and `opacity`, never `width`/`height`/`top`

## Background Techniques
```css
/* Mesh gradient */
background: radial-gradient(ellipse at 20% 50%, hsl(262 80% 30% / 0.4) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, hsl(198 90% 30% / 0.3) 0%, transparent 50%),
            hsl(222 14% 8%);

/* Noise texture overlay */
.noise::after {
  content: '';
  position: fixed; inset: 0;
  background-image: url("data:image/svg+xml,..."); /* SVG noise */
  opacity: 0.03;
  pointer-events: none;
}

/* Grid pattern */
background-image: linear-gradient(hsl(0 0% 100% / 0.04) 1px, transparent 1px),
                  linear-gradient(90deg, hsl(0 0% 100% / 0.04) 1px, transparent 1px);
background-size: 32px 32px;
```

## Manga-Specific Aesthetics
- Panel borders: 2–4px solid black, strong geometry
- Speed lines: SVG radial lines from focal point
- Halftone overlays: `background-image: radial-gradient(circle, black 1px, transparent 1px)`
- Impact text: ultra-bold, rotated, outline stroke
- Ink-on-paper: slight cream/off-white backgrounds, not pure #fff
- Chapter transitions: dramatic wipe or iris-in animations
