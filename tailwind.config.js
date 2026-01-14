/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'selector',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: {
      sans: ['Rubik', 'sans-serif'],
    },
    extend: {
      colors: {
        // Theme-aware colors (switch via CSS variables)
        page: 'var(--color-page)',
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'header-bg': 'var(--color-header-bg)',
        default: 'var(--color-default)',
        'fg-muted': 'var(--color-fg-muted)',
        'fg-disabled': 'var(--color-fg-disabled)',
        'fg-on-disabled': 'var(--color-fg-on-disabled)',
        'accent-disabled': 'var(--color-accent-disabled)',
        link: 'var(--color-link)',
        high: 'var(--color-high)',
        'card-tint': 'var(--color-card-tint)',
        error: '#f00',
        // Alert colors (theme-aware - darker in light mode for contrast)
        'alert-danger': 'var(--color-alert-danger)',
        'alert-warning': 'var(--color-alert-warning)',
        'alert-success': 'var(--color-alert-success)',
        'alert-info': 'var(--color-alert-info)',
        // Brand colors (static - same in both themes)
        turbo: {
          red: '#FE0230',
          blue: '#3142C4',
          green: '#18A957',
          yellow: '#FFBB38', // ArNS brand color
          purple: '#8B5CF6', // Developer/Info services color (purple-500)
        }
      },
    },
  },
  plugins: [],
};