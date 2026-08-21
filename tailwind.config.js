/** @type {import('tailwindcss').Config} */
// Thème Atlas — les couleurs/rayons/typos pointent vers les variables CSS
// injectées depuis tokens.ts (source de vérité). Voir tokens.ts § cssVars.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // Breakpoints Atlas — miroir de tokens.screens (mobile-first).
    screens: {
      xs: '360px',
      sm: '768px',
      md: '1024px',
      lg: '1440px',
      xl: '1920px',
    },
    extend: {
      colors: {
        bg: 'var(--ax-bg)',
        ink: {
          DEFAULT: 'var(--ax-text)',
          2: 'var(--ax-text-2)',
          3: 'var(--ax-text-3)',
        },
        accent: {
          DEFAULT: 'var(--ax-accent)',
          strong: 'var(--ax-accent-strong)',
          soft: 'var(--ax-accent-soft)',
          on: 'var(--ax-on-accent)',
        },
        success: 'var(--ax-success)',
        danger: 'var(--ax-danger)',
        warning: 'var(--ax-warning)',
        info: 'var(--ax-info)',
      },
      fontFamily: {
        brand: 'var(--ax-font-brand)',
        sans: 'var(--ax-font-sans)',
        mono: 'var(--ax-font-mono)',
      },
      borderRadius: {
        sm: 'var(--ax-radius-sm)',
        md: 'var(--ax-radius-md)',
        lg: 'var(--ax-radius-lg)',
        xl: 'var(--ax-radius-xl)',
        pill: 'var(--ax-radius-pill)',
      },
      boxShadow: {
        glass: 'var(--ax-shadow)',
        'glass-sm': 'var(--ax-shadow-sm)',
        'glass-lg': 'var(--ax-shadow-lg)',
      },
      backdropBlur: {
        glass: 'var(--ax-blur)',
        'glass-sm': 'var(--ax-blur-sm)',
        'glass-lg': 'var(--ax-blur-lg)',
      },
      transitionTimingFunction: {
        atlas: 'cubic-bezier(0.2, 0.6, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
