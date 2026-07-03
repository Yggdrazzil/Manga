/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-background)',
        'page-muted': 'var(--color-page-muted)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-text)',
        'ink-muted': 'var(--color-text-muted)',
        'ink-soft': 'var(--color-text-soft)',
        line: 'var(--color-border)',
        'line-light': 'var(--color-border-light)',
        brand: 'var(--color-primary-yellow)',
        'brand-soft': 'var(--color-primary-yellow-soft)',
        'pill-grey': 'var(--color-pill-grey)',
        'chip-grey': 'var(--color-chip-grey)',
        'chip-selected': 'var(--color-chip-selected-grey)',
        'blue-link': 'var(--color-blue-link)',
        'red-dot': 'var(--color-red-dot)',
        'success-green': 'var(--color-success-green)',
      },
      borderRadius: {
        card: '5px',
        poster: '3px',
        sheet: '5px 5px 0 0',
      },
      boxShadow: {
        'episode-card': '0 4px 14px rgba(0, 0, 0, 0.16)',
        'season-card': '0 4px 16px rgba(0, 0, 0, 0.14)',
        'bottom-sheet': '0 -4px 20px rgba(0, 0, 0, 0.18)',
      },
      fontFamily: {
        app: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
