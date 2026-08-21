/**
 * Formatage d'AFFICHAGE uniquement.
 * ⚠ Tout CALCUL monétaire passe par Money.ts (centimes entiers) — réf CLAUDE.md §5.
 * Ici on ne fait que présenter une valeur déjà calculée, selon le locale.
 */

export function formatAmount(amount: number, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
}

export function formatPercent(ratio: number, locale = 'fr-FR', digits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
}

export function formatDate(iso: string | null | undefined, locale = 'fr-FR'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}
