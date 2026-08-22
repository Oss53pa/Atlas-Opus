/**
 * Atlas Opus — Design tokens (SOURCE DE VÉRITÉ du design system « Atlas »).
 * Réf CLAUDE.md §4 + handoff design « Atlas Opus — Pages ».
 *
 * Direction visuelle : « document d'ingénierie ».
 *   → Fond crème, encre, un seul accent terre cuite (rare, signifiant).
 *   → Rayon de bordure 0 partout (sauf avatar). Aucune ombre, aucun dégradé.
 *   → Trois familles : Grand Hotel (wordmark), Exo 2 (UI), JetBrains Mono (nombres).
 *
 * RÈGLE : aucune valeur de design en dur ailleurs. Tout écran / composant
 * consomme ces tokens via les variables CSS injectées par `applyTheme()`
 * (préfixe `--ao-*` pour les tokens document, `--ax-*` pour le pont Tailwind).
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Palette « crème · encre · terre cuite »
// ─────────────────────────────────────────────────────────────────────────────
export const color = {
  // Surfaces
  page: '#F4F1EA', // fond de l'application
  card: '#F8F6F0', // cartes, tableaux, panneaux
  input: '#FBFAF6', // champs de saisie
  total: '#EFEBDF', // lignes de total dans un tableau
  active: '#EAE5D8', // élément de navigation actif, étape en cours

  // Bordures (toujours 1px solid)
  borderStrong: '#D5CEBC', // bord extérieur d'un écran, champs
  border: '#DCD6C7', // bords de cartes, séparateurs de sections
  borderSubtle: '#E5E0D2', // séparateurs de lignes dans un tableau
  borderControl: '#C9C1AD', // bouton secondaire

  // Textes (encre)
  primary: '#2A2722', // titres, valeurs
  secondary: '#4E4A41', // libellés de navigation
  body: '#5C584E', // texte courant
  muted: '#7A7568', // métadonnées, sous-titres
  faint: '#8B8578', // en-têtes de colonnes, libellés d'unités
  disabled: '#A9A294', // éléments inactifs

  // Accent terre cuite (une seule chose par vue le porte)
  accent: '#9C5B3F', // action primaire, état actif, donnée critique
  accentHover: '#86482F', // survol de l'action primaire
  accentLight: '#C98F6F', // accent secondaire, graphiques
  accentWash: '#DCCFBE', // remplissage de barre de comparaison
  onAccent: '#F8F6F0', // texte sur fond accent

  // Sévérité
  danger: '#8C3A32', // blocage, dépassement, sinistre
  deadline: '#9C5B3F', // échéance à traiter (= accent)
  success: '#3F5C4A', // conforme

  // Graphiques
  chartNeutral: '#D8CFBC', // série de référence
  chartInk: '#8E8878', // série projetée « à l'heure »
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Typographie
// ─────────────────────────────────────────────────────────────────────────────
export const font = {
  brand: "'Grand Hotel', ui-serif, cursive",
  sans: "'Exo 2', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
} as const;

/** Échelle typographique effective du handoff (rôle → taille/graisse). */
export const type = {
  screenTitle: { size: '17px', weight: 600, family: font.sans },
  cardTitle: { size: '15px', weight: 600, family: font.sans },
  kpi: { size: '23px', weight: 500, family: font.mono },
  kpiLarge: { size: '26px', weight: 600, family: font.sans, tracking: '-0.02em' },
  row: { size: '14px', weight: 400, family: font.sans },
  num: { size: '13px', weight: 400, family: font.mono },
  body: { size: '13px', weight: 400, family: font.sans },
  meta: { size: '12px', weight: 400, family: font.sans },
  colHead: { size: '10px', weight: 400, family: font.mono, tracking: '0.12em' },
  badge: { size: '10px', weight: 400, family: font.mono },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 3. Espacement (base 4 px), géométrie, mouvement
// ─────────────────────────────────────────────────────────────────────────────
export const space = {
  0: '0', 1: '3px', 2: '4px', 3: '6px', 4: '8px', 5: '10px', 6: '11px',
  7: '12px', 8: '14px', 9: '16px', 10: '18px', 11: '20px', 12: '24px', 13: '32px',
} as const;

/** Rayon 0 partout (parti pris « traits et rectangles ») ; pill pour l'avatar. */
export const radius = { none: '0', pill: '999px' } as const;

/** Breakpoints Atlas — cible poste de travail, 1280 px minimum. */
export const screens = { xs: '360px', sm: '768px', md: '1024px', lg: '1280px', xl: '1440px' } as const;

export const motion = {
  fast: '120ms', base: '140ms', slow: '160ms',
  ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)', // ease-out sobre
} as const;

export const z = { base: 1, sticky: 30, header: 50, overlay: 100, modal: 200, toast: 300 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// 4. Agrégat exporté
// ─────────────────────────────────────────────────────────────────────────────
export const tokens = { color, font, type, space, radius, screens, motion, z } as const;
export type Tokens = typeof tokens;

// ─────────────────────────────────────────────────────────────────────────────
// 5. Pont vers le CSS — variables `--ao-*` (document) + `--ax-*` (compat Tailwind)
// ─────────────────────────────────────────────────────────────────────────────
export const cssVars: Record<string, string> = {
  // ── Tokens document « --ao-* » ──────────────────────────────────────────
  '--ao-page': color.page,
  '--ao-card': color.card,
  '--ao-input': color.input,
  '--ao-total': color.total,
  '--ao-active': color.active,
  '--ao-border-strong': color.borderStrong,
  '--ao-border': color.border,
  '--ao-border-subtle': color.borderSubtle,
  '--ao-border-control': color.borderControl,
  '--ao-primary': color.primary,
  '--ao-secondary': color.secondary,
  '--ao-body': color.body,
  '--ao-muted': color.muted,
  '--ao-faint': color.faint,
  '--ao-disabled': color.disabled,
  '--ao-accent': color.accent,
  '--ao-accent-hover': color.accentHover,
  '--ao-accent-light': color.accentLight,
  '--ao-accent-wash': color.accentWash,
  '--ao-on-accent': color.onAccent,
  '--ao-danger': color.danger,
  '--ao-success': color.success,
  '--ao-chart-neutral': color.chartNeutral,
  '--ao-chart-ink': color.chartInk,

  // Fonts
  '--ao-font-brand': font.brand,
  '--ao-font-sans': font.sans,
  '--ao-font-mono': font.mono,

  // Mouvement
  '--ao-dur-fast': motion.fast,
  '--ao-dur': motion.base,
  '--ao-dur-slow': motion.slow,
  '--ao-ease': motion.ease,

  // ── Pont Tailwind « --ax-* » (mêmes noms que tailwind.config) ───────────
  '--ax-bg': color.page,
  '--ax-text': color.primary,
  '--ax-text-2': color.secondary,
  '--ax-text-3': color.muted,
  '--ax-accent': color.accent,
  '--ax-accent-strong': color.accentHover,
  '--ax-accent-soft': color.accentWash,
  '--ax-on-accent': color.onAccent,
  '--ax-success': color.accent,
  '--ax-danger': color.danger,
  '--ax-warning': color.accentHover,
  '--ax-info': color.secondary,
  '--ax-font-brand': font.brand,
  '--ax-font-sans': font.sans,
  '--ax-font-mono': font.mono,
  '--ax-radius-sm': radius.none,
  '--ax-radius-md': radius.none,
  '--ax-radius-lg': radius.none,
  '--ax-radius-xl': radius.none,
  '--ax-radius-pill': radius.pill,
};

/** Bloc `:root{…}` sérialisé depuis `cssVars` (zéro dérive vs tokens). */
export const themeCss = `:root{${Object.entries(cssVars)
  .map(([k, v]) => `${k}:${v}`)
  .join(';')}}`;

/** Injecte les variables de thème dans le document. À appeler avant le render. */
export function applyTheme(target: Document = document): void {
  const id = 'ao-theme';
  if (target.getElementById(id)) return;
  const style = target.createElement('style');
  style.id = id;
  style.textContent = themeCss;
  target.head.appendChild(style);
}
