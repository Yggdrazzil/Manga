/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "hsl(40 33% 97%)",
        "paper-2": "hsl(38 26% 93%)",
        "paper-3": "hsl(36 22% 89%)",
        surface: "hsl(40 40% 99.5%)",
        ink: "hsl(24 16% 13%)",
        "ink-soft": "hsl(24 9% 34%)",
        "ink-mute": "hsl(24 7% 52%)",
        line: "hsl(30 16% 87%)",
        "line-strong": "hsl(28 14% 78%)",
        vermilion: "hsl(8 76% 50%)",
        "vermilion-soft": "hsl(8 72% 96%)",
        indigo: "hsl(218 44% 30%)",
        moss: "hsl(146 32% 33%)",
        gold: "hsl(36 70% 40%)",
      },
      fontFamily: {
        display: ['"Shippori Mincho"', "serif"],
        sans: ['"Zen Kaku Gothic New"', "sans-serif"],
        mono: ['"Source Code Pro"', "monospace"],
      },
      fontSize: {
        // One deliberate display step above the body scale, fluid so the
        // hierarchy survives from 375px to 1440px without a second breakpoint.
        hero: ["clamp(2rem, 5vw, 3.25rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        section: ["clamp(1.35rem, 2.4vw, 1.9rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        xl2: "1.125rem",
      },
      boxShadow: {
        soft: "0 1px 2px hsl(24 16% 13% / 0.04), 0 6px 20px hsl(24 16% 13% / 0.06)",
        lift: "0 2px 4px hsl(24 16% 13% / 0.05), 0 16px 40px hsl(24 16% 13% / 0.12)",
        ring: "0 0 0 1px hsl(30 16% 87%)",
        stamp: "0 0 0 2px hsl(8 76% 50% / 0.18)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "reveal-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        // Skeletons sweep rather than blink: a pulse on a page full of cards
        // reads as an error state.
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "draw-in": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "reveal-up": "reveal-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s infinite",
        "draw-in": "draw-in 0.6s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};
