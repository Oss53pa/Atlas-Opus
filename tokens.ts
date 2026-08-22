/**
 * Atlas Opus — Design tokens (SOURCE DE VÉRITÉ du design system « Atlas »).
 * Réf CLAUDE.md §4 + handoff hi-fi « Atlas Opus ».
 *   Direction : crème / encre / un seul accent terre cuite. Document d'ingénierie —
 *   traits et rectangles : rayon 0 partout, aucune ombre, aucun dégradé, filets 1px.
 *   Seule exception au rayon 0 : l'avatar utilisateur (pill).
 *
 * RÈGLE : aucune valeur de design en dur ailleurs. Tout écran / composant consomme
 * ces tokens, soit via les variables CSS injectées par `applyTheme()` (préfixe
 * `--ax-*`), soit via le thème Tailwind qui les référence.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Primitives — palette crème / encre / terre cuite (handoff §Design tokens)
// ─────────────────────────────────────────────────────────────────────────────
export const palette = {
  // Surfaces (crème)
  surface: {
    page: '#F4F1EA',
    card: '#F8F6F0',
    input: '#FBFAF6',
    total: '#EFEBDF',
    active: '#EAE5D8',
  },
  // Filets
  line: {
    strong: '#D5CEBC',
    default: '#DCD6C7',
    subtle: '#E5E0D2',
    control: '#C9C1AD',
  },
  // Encre (texte)
  ink: {
    primary: '#2A2722',
    secondary: '#4E4A41',
    body: '#5C584E',
    muted: '#7A7568',
    faint: '#8B8578',
    disabled: '#A9A294',
  },
  // Terre cuite (accent — rare, signifiant)
  terracotta: {
    base: '#9C5B3F',
    hover: '#86482F',
    light: '#C98F6F',
    wash: '#DCCFBE',
  },
  danger: '#8C3A32',
  // Séries de graphiques (sans ornement)
  chart: { neutral: '#D8CFBC', ink: '#8E8878' },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Tokens sémantiques
// ─────────────────────────────────────────────────────────────────────────────
export const color = {
  // Fond de page
  bg: palette.surface.page,
  // Texte
  text: palette.ink.primary,
  text2: palette.ink.body,
  text3: palette.ink.muted,
  textFaint: palette.ink.faint,
  textSecondary: palette.ink.secondary,
  textDisabled: palette.ink.disabled,
  onAccent: palette.surface.card,
  inverse: palette.surface.card,
  // Accent terre cuite
  accent: palette.terracotta.base,
  accentStrong: palette.terracotta.hover,
  accentSoft: palette.terracotta.wash,
  accentLight: palette.terracotta.light,
  accentWash: palette.terracotta.wash,
  // Sémantiques (palette restreinte : « appelant » = accent, sévère = danger,
  // « conforme » = encre secondaire ; pas de vert/bleu décoratif).
  success: palette.ink.secondary,
  successSoft: palette.surface.active,
  danger: palette.danger,
  dangerStrong: palette.danger,
  dangerSoft: '#EFE0DC',
  warning: palette.terracotta.base,
  warningSoft: palette.terracotta.wash,
  info: palette.ink.body,
  infoSoft: palette.surface.total,
  // Surfaces (ex-« verre » → crème pleine, opaque)
  glass: palette.surface.card,
  glassStrong: palette.surface.card,
  glassSubtle: palette.surface.total,
  glassBorder: palette.line.default,
  glassBorderStrong: palette.line.strong,
  // Filets sur contenu
  border: palette.line.default,
  borderStrong: palette.line.strong,
  borderSubtle: palette.line.subtle,
  borderControl: palette.line.control,
  // Surfaces additionnelles
  surfaceInput: palette.surface.input,
  surfaceTotal: palette.surface.total,
  surfaceActive: palette.surface.active,
  overlay: 'rgba(42, 39, 34, 0.45)',
} as const;

/** Nappes « aurora » neutralisées (direction plate — conservées pour compat). */
export const aurora = {
  a: 'transparent',
  b: palette.chart.neutral,
  c: 'transparent',
  d: 'transparent',
} as const;

/** Aucun effet de profondeur : plat par principe (document d'ingénierie). */
export const effect = {
  blur: '0px',
  blurSm: '0px',
  blurLg: '0px',
  shadow: 'none',
  shadowSm: 'none',
  shadowLg: 'none',
  ring: '0 0 0 2px color-mix(in srgb, #9C5B3F 55%, transparent)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 3. Typographie — Grand Hotel (wordmark), Exo 2 (UI), JetBrains Mono (nombres)
// ─────────────────────────────────────────────────────────────────────────────
export const font = {
  brand: "'Grand Hotel', ui-serif, cursive",
  sans: "'Exo 2', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
} as const;

/** Échelle effective du handoff (px). */
export const fontSize = {
  micro: '10px', xs: '12px', sm: '13px', base: '14px', md: '15px',
  lg: '17px', xl: '23px', '2xl': '26px', '3xl': '34px', '4xl': '48px',
} as const;

export const weight = { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 } as const;
export const leading = { tight: 1.15, snug: 1.3, normal: 1.5, relaxed: 1.7 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// 4. Espacement (base 4 px), rayons, breakpoints, mouvement
// ─────────────────────────────────────────────────────────────────────────────
export const space = {
  0: '0', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px',
  6: '24px', 7: '28px', 8: '32px', 10: '40px', 12: '48px', 16: '64px', 20: '80px',
} as const;

/** Rayon 0 partout (traits et rectangles) ; `pill` réservé à l'avatar. */
export const radius = { none: '0', sm: '0', md: '0', lg: '0', xl: '0', pill: '999px' } as const;

/** Breakpoints Atlas — cible poste de travail 1280 px min (handoff). */
export const screens = { xs: '360px', sm: '768px', md: '1024px', lg: '1280px', xl: '1440px' } as const;

export const motion = {
  fast: '120ms', base: '140ms', slow: '160ms',
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
  '--ax-text-faint': color.textFaint,
  '--ax-text-secondary': color.textSecondary,
  '--ax-text-disabled': color.textDisabled,
  '--ax-on-accent': color.onAccent,
  '--ax-inverse': color.inverse,
  '--ax-accent': color.accent,
  '--ax-accent-strong': color.accentStrong,
  '--ax-accent-soft': color.accentSoft,
  '--ax-accent-light': color.accentLight,
  '--ax-accent-wash': color.accentWash,
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
  '--ax-border-subtle': color.borderSubtle,
  '--ax-border-control': color.borderControl,
  '--ax-surface-input': color.surfaceInput,
  '--ax-surface-total': color.surfaceTotal,
  '--ax-surface-active': color.surfaceActive,
  '--ax-overlay': color.overlay,
  '--ax-aurora-a': aurora.a,
  '--ax-aurora-b': aurora.b,
  '--ax-aurora-c': aurora.c,
  '--ax-aurora-d': aurora.d,
  '--ax-chart-neutral': palette.chart.neutral,
  '--ax-chart-ink': palette.chart.ink,
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
