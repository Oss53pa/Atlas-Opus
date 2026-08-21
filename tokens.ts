/**
 * Atlas Opus — Design tokens (SOURCE DE VÉRITÉ du design system « Atlas »).
 * Réf CLAUDE.md §4. Direction visuelle : « Glass & Aurora ».
 *   → Fond clair lumineux, verre dépoli (glassmorphism), dégradés aurora doux.
 *
 * RÈGLE : aucune valeur de design en dur ailleurs. Tout écran / composant
 * consomme ces tokens, soit via les variables CSS injectées par `applyTheme()`
 * (préfixe `--ax-*`), soit via le thème Tailwind qui les référence.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Primitives — palette (alignée sur les ramps de la charte)
// ─────────────────────────────────────────────────────────────────────────────
export const palette = {
  amber: { 50: '#FAEEDA', 100: '#FAC775', 200: '#EF9F27', 600: '#BA7517', 800: '#854F0B', 900: '#412402' },
  teal: { 50: '#E1F5EE', 200: '#5DCAA5', 600: '#0F6E56', 800: '#085041' },
  violet: { 50: '#EEEDFE', 200: '#7F77DD', 600: '#534AB7' },
  blue: { 50: '#E6F1FB', 200: '#378ADD', 600: '#185FA5' },
  red: { 50: '#FCEBEB', 200: '#E24B4A', 600: '#A32D2D' },
  pink: { 200: '#ED93B1' },
  ink: { 900: '#1E2230', 700: '#3A4154', 500: '#5B6478', 400: '#8A93A6' },
  white: '#FFFFFF',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Tokens sémantiques
// ─────────────────────────────────────────────────────────────────────────────
export const color = {
  // Surface lumineuse de page (sous l'aurora)
  bg: '#F5F7FC',
  // Texte
  text: palette.ink[900],
  text2: palette.ink[500],
  text3: palette.ink[400],
  onAccent: palette.amber[900],
  inverse: palette.white,
  // Accent ambre (rare, signifiant)
  accent: palette.amber[200],
  accentStrong: palette.amber[600],
  accentSoft: palette.amber[50],
  // Sémantiques
  success: palette.teal[600],
  successSoft: palette.teal[50],
  danger: palette.red[600],
  dangerStrong: palette.red[200],
  dangerSoft: palette.red[50],
  warning: palette.amber[800],
  warningSoft: palette.amber[50],
  info: palette.blue[600],
  infoSoft: palette.blue[50],
  // Verre dépoli
  glass: 'rgba(255, 255, 255, 0.55)',
  glassStrong: 'rgba(255, 255, 255, 0.74)',
  glassSubtle: 'rgba(255, 255, 255, 0.40)',
  glassBorder: 'rgba(255, 255, 255, 0.70)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.90)',
  // Filets sur contenu
  border: 'rgba(30, 34, 48, 0.10)',
  borderStrong: 'rgba(30, 34, 48, 0.16)',
  overlay: 'rgba(30, 34, 48, 0.45)',
} as const;

/** Teintes des nappes aurora (utilisées en radial-gradient + blobs flous). */
export const aurora = {
  a: palette.amber[200],
  b: palette.teal[200],
  c: palette.violet[200],
  d: palette.pink[200],
} as const;

export const effect = {
  blur: '20px',
  blurSm: '12px',
  blurLg: '28px',
  shadow: '0 10px 40px rgba(30, 34, 48, 0.12)',
  shadowSm: '0 4px 18px rgba(30, 34, 48, 0.10)',
  shadowLg: '0 18px 60px rgba(30, 34, 48, 0.16)',
  ring: '0 0 0 3px rgba(239, 159, 39, 0.45)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 3. Typographie — Grand Hotel (noms d'app), Exo 2 (UI), JetBrains Mono (montants)
// ─────────────────────────────────────────────────────────────────────────────
export const font = {
  brand: "'Grand Hotel', ui-serif, cursive",
  sans: "'Exo 2', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
} as const;

export const fontSize = {
  xs: '11px', sm: '13px', base: '15px', md: '16px',
  lg: '18px', xl: '22px', '2xl': '28px', '3xl': '36px', '4xl': '48px',
} as const;

export const weight = { light: 300, regular: 400, medium: 500, semibold: 600 } as const;
export const leading = { tight: 1.15, snug: 1.3, normal: 1.5, relaxed: 1.7 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// 4. Espacement (base 4 px), rayons, breakpoints, mouvement
// ─────────────────────────────────────────────────────────────────────────────
export const space = {
  0: '0', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px',
  6: '24px', 7: '28px', 8: '32px', 10: '40px', 12: '48px', 16: '64px', 20: '80px',
} as const;

export const radius = { sm: '8px', md: '12px', lg: '16px', xl: '20px', pill: '999px' } as const;

/** Breakpoints Atlas (mobile-first) — réf CLAUDE.md §4. */
export const screens = { xs: '360px', sm: '768px', md: '1024px', lg: '1440px', xl: '1920px' } as const;

export const motion = {
  fast: '120ms', base: '180ms', slow: '240ms',
  ease: 'cubic-bezier(0.2, 0.6, 0.2, 1)',
} as const;

export const z = { aurora: 0, base: 1, sticky: 30, header: 50, overlay: 100, modal: 200, toast: 300 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// 5. Agrégat exporté
// ─────────────────────────────────────────────────────────────────────────────
export const tokens = {
  palette, color, aurora, effect,
  font, fontSize, weight, leading,
  space, radius, screens, motion, z,
} as const;

export type Tokens = typeof tokens;

// ─────────────────────────────────────────────────────────────────────────────
// 6. Pont vers le CSS — variables `--ax-*` (consommées par index.css + Tailwind)
// ─────────────────────────────────────────────────────────────────────────────
export const cssVars: Record<string, string> = {
  '--ax-bg': color.bg,
  '--ax-text': color.text,
  '--ax-text-2': color.text2,
  '--ax-text-3': color.text3,
  '--ax-on-accent': color.onAccent,
  '--ax-inverse': color.inverse,
  '--ax-accent': color.accent,
  '--ax-accent-strong': color.accentStrong,
  '--ax-accent-soft': color.accentSoft,
  '--ax-success': color.success,
  '--ax-success-soft': color.successSoft,
  '--ax-danger': color.danger,
  '--ax-danger-strong': color.dangerStrong,
  '--ax-danger-soft': color.dangerSoft,
  '--ax-warning': color.warning,
  '--ax-warning-soft': color.warningSoft,
  '--ax-info': color.info,
  '--ax-info-soft': color.infoSoft,
  '--ax-glass': color.glass,
  '--ax-glass-strong': color.glassStrong,
  '--ax-glass-subtle': color.glassSubtle,
  '--ax-glass-border': color.glassBorder,
  '--ax-glass-border-strong': color.glassBorderStrong,
  '--ax-border': color.border,
  '--ax-border-strong': color.borderStrong,
  '--ax-overlay': color.overlay,
  '--ax-aurora-a': aurora.a,
  '--ax-aurora-b': aurora.b,
  '--ax-aurora-c': aurora.c,
  '--ax-aurora-d': aurora.d,
  '--ax-blur': effect.blur,
  '--ax-blur-sm': effect.blurSm,
  '--ax-blur-lg': effect.blurLg,
  '--ax-shadow': effect.shadow,
  '--ax-shadow-sm': effect.shadowSm,
  '--ax-shadow-lg': effect.shadowLg,
  '--ax-ring': effect.ring,
  '--ax-font-brand': font.brand,
  '--ax-font-sans': font.sans,
  '--ax-font-mono': font.mono,
  '--ax-radius-sm': radius.sm,
  '--ax-radius-md': radius.md,
  '--ax-radius-lg': radius.lg,
  '--ax-radius-xl': radius.xl,
  '--ax-radius-pill': radius.pill,
  '--ax-dur-fast': motion.fast,
  '--ax-dur': motion.base,
  '--ax-dur-slow': motion.slow,
  '--ax-ease': motion.ease,
};

/** Bloc `:root{…}` sérialisé depuis `cssVars` (zéro dérive vs tokens). */
export const themeCss = `:root{${Object.entries(cssVars)
  .map(([k, v]) => `${k}:${v}`)
  .join(';')}}`;

/** Injecte les variables de thème dans le document. À appeler avant le render. */
export function applyTheme(target: Document = document): void {
  const id = 'ax-theme';
  if (target.getElementById(id)) return;
  const style = target.createElement('style');
  style.id = id;
  style.textContent = themeCss;
  target.head.appendChild(style);
}
