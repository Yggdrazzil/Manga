/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "hsl(40 30% 96%)",
        "paper-2": "hsl(38 28% 92%)",
        surface: "hsl(0 0% 100%)",
        ink: "hsl(20 14% 11%)",
        "ink-soft": "hsl(20 8% 32%)",
        "ink-mute": "hsl(20 6% 50%)",
        line: "hsl(28 18% 82%)",
        vermilion: "hsl(8 74% 48%)",
        "vermilion-soft": "hsl(8 70% 94%)",
        indigo: "hsl(218 42% 28%)",
        moss: "hsl(140 30% 34%)",
        gold: "hsl(38 64% 46%)",
      },
      fontFamily: {
        display: ['"Shippori Mincho"', "serif"],
        sans: ['"Zen Kaku Gothic New"', "sans-serif"],
        mono: ['"Source Code Pro"', "monospace"],
      },
      boxShadow: {
        panel: "3px 3px 0 hsl(20 14% 11% / 0.9)",
        "panel-sm": "2px 2px 0 hsl(20 14% 11% / 0.85)",
        lift: "0 10px 30px hsl(20 14% 11% / 0.12)",
      },
      keyframes: {
        "reveal-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "reveal-up": "reveal-up 0.45s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};
