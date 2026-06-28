/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "hsl(40 33% 97%)",
        "paper-2": "hsl(38 26% 93%)",
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
        gold: "hsl(36 70% 45%)",
      },
      fontFamily: {
        display: ['"Shippori Mincho"', "serif"],
        sans: ['"Zen Kaku Gothic New"', "sans-serif"],
        mono: ['"Source Code Pro"', "monospace"],
      },
      borderRadius: {
        xl2: "1.125rem",
      },
      boxShadow: {
        soft: "0 1px 2px hsl(24 16% 13% / 0.04), 0 6px 20px hsl(24 16% 13% / 0.06)",
        lift: "0 2px 4px hsl(24 16% 13% / 0.05), 0 16px 40px hsl(24 16% 13% / 0.12)",
        ring: "0 0 0 1px hsl(30 16% 87%)",
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
      },
      animation: {
        "reveal-up": "reveal-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};
