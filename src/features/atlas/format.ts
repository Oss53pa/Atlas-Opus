/**
 * Formats Atlas Opus (réf handoff § « Formats et langue »).
 * - Montants FCFA : séparateur de milliers = espace insécable, abrégés « M » / « Md ».
 * - Décimales : virgule. Dates : JJ.MM.AAAA. Absence : tiret cadratin « — ».
 * Tout nombre est destiné à être rendu en JetBrains Mono, aligné à droite.
 */

/** Espace insécable — séparateur de milliers et avant unité. */
export const NBSP = ' ';
/** Tiret cadratin pour l'absence de valeur. */
export const EMDASH = '—';

const frFixed = (n: number, decimals: number): string =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).replace(/\s/g, NBSP);

/** Groupe les milliers avec un espace insécable (« 4 850 »). */
export function group(n: number): string {
  return Math.round(n).toLocaleString('fr-FR').replace(/\s/g, NBSP);
}

/** Montant en millions FCFA → « 920 M », « 184,0 M ». `value` en millions. */
export function millions(value: number, decimals = 0): string {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  const body = decimals > 0 ? frFixed(abs, decimals) : group(abs);
  return `${sign}${body}${NBSP}M`;
}

/** Montant en milliards FCFA → « 4,85 Md ». `value` en millions. */
export function milliards(valueInMillions: number, decimals = 2): string {
  const sign = valueInMillions < 0 ? '−' : '';
  return `${sign}${frFixed(Math.abs(valueInMillions) / 1000, decimals)}${NBSP}Md`;
}

/** Montant « intelligent » : Md au-dessus de 1000 M, sinon M. `value` en millions. */
export function money(valueInMillions: number, opts: { mdDecimals?: number; mDecimals?: number } = {}): string {
  const abs = Math.abs(valueInMillions);
  return abs >= 1000 ? milliards(valueInMillions, opts.mdDecimals ?? 2) : millions(valueInMillions, opts.mDecimals ?? 0);
}

/** Montant signé (préfixe « + » si positif) — écarts, marges. `value` en millions. */
export function signedMoney(valueInMillions: number, opts?: { mdDecimals?: number; mDecimals?: number }): string {
  if (valueInMillions === 0) return EMDASH;
  const s = money(valueInMillions, opts);
  return valueInMillions > 0 ? `+${s}` : s;
}

/** Montant en FCFA brut (unités) → « 184 000 000 ». */
export function fcfa(units: number): string {
  const sign = units < 0 ? '−' : '';
  return `${sign}${group(Math.abs(units))}`;
}

/** Pourcentage → « 58 % », « 12,6 % ». */
export function percent(value: number, decimals = 0): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}${frFixed(Math.abs(value), decimals)}${NBSP}%`;
}

/** Pourcentage signé → « +12,6 % ». */
export function signedPercent(value: number, decimals = 0): string {
  if (value === 0) return EMDASH;
  const s = percent(value, decimals);
  return value > 0 ? `+${s}` : s;
}

/** Date ISO ou Date → « JJ.MM.AAAA ». */
export function date(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Date courte « JJ.MM » pour les listes denses. */
export function dateShort(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}`;
}

/** Jours → « +16 j », « 1,4 j ». */
export function days(value: number, decimals = 0): string {
  const sign = value < 0 ? '−' : value > 0 ? '+' : '';
  return `${sign}${frFixed(Math.abs(value), decimals)}${NBSP}j`;
}
