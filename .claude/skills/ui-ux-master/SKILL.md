---
name: ui-ux-master
description: >
  Complete UI/UX design system for cutting-edge interfaces. Auto-invoked
  whenever the task touches how something looks, moves, or is interacted with.
  Covers design systems, components, accessibility, and user experience patterns.
---

# UI/UX Master

## Design Philosophy
You are a design engineer, not a code generator.
Think in systems, not components. Enforce consistency. Catch design failures before the browser.

**The rule:** If ANY part of the task touches how something looks, moves, or is interacted with — apply these principles before writing code.

## Design System First
Before building any component:
1. Define the design tokens (colors, spacing, typography, radii, shadows)
2. Establish the spacing scale (4px base, multiples: 4/8/12/16/24/32/48/64)
3. Name semantic color tokens (`--color-surface`, `--color-on-surface`, `--color-accent`)
4. Define 3 type scales at most: display / body / caption

```css
:root {
  /* Spacing */
  --space-1: 4px;  --space-2: 8px;   --space-3: 12px;
  --space-4: 16px; --space-6: 24px;  --space-8: 32px;
  --space-12: 48px; --space-16: 64px;

  /* Semantic colors */
  --color-bg: hsl(220 13% 9%);
  --color-surface: hsl(220 12% 14%);
  --color-surface-raised: hsl(220 11% 18%);
  --color-accent: hsl(262 80% 65%);
  --color-accent-subtle: hsl(262 60% 25%);
  --color-text: hsl(220 15% 92%);
  --color-text-muted: hsl(220 10% 55%);
  --color-border: hsl(220 12% 22%);
}
```

## Visual Hierarchy
- Clear dominant → secondary → tertiary weight (never equal)
- One focal point per screen; guide the eye deliberately
- Whitespace is intentional — generous, not wasted
- Every action has immediate visual feedback

## Component Patterns
- Single responsibility: one component, one job
- Composition over configuration (children-based slots)
- Explicit state: loading / empty / error / success — always handle all 4
- Keyboard navigation and focus management built-in from start
- ARIA labels on all interactive elements without visible text

## Interaction Design
- Hover: 150ms ease-out color/opacity shift
- Focus: high-contrast 2px ring, never removed for keyboard users
- Active/pressed: scale(0.97) + brightness(0.9), 80ms
- Disabled: 40% opacity, cursor-not-allowed, no pointer events
- Loading: skeleton screens over spinners; never block the full UI

## Accessibility (WCAG 2.1 AA minimum)
- Color contrast: 4.5:1 for body text, 3:1 for large/UI text
- Keyboard: all interactions reachable via Tab/Enter/Space/Arrow
- Screen readers: semantic HTML first, ARIA only when HTML falls short
- Motion: respect `prefers-reduced-motion` — always provide static fallback
- Focus indicators: never `outline: none` without a replacement

## Mobile / Responsive
- Mobile-first: design for 375px, then scale up
- Touch targets: minimum 44×44px
- Avoid hover-only interactions
- Safe areas: use `env(safe-area-inset-*)` for notch/island devices
- Test at 320px (minimum) and 1440px (comfortable desktop)

## Anti-Patterns to Avoid
- Modal dialogs for non-critical information
- Carousels/sliders for primary content
- Infinite scroll without a "load more" escape hatch
- Placeholder text as label replacement
- Disabled buttons without explaining why
- Animations that block user input
