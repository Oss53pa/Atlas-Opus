/**
 * Money.ts — arithmétique monétaire exacte (réf CLAUDE.md §5/§6, invariant).
 * Montants stockés en **unités mineures entières** (centimes) via `bigint` :
 * jamais de flottant natif, jamais de calcul délégué à un LLM.
 * Échelle par défaut = 2 (aligne numeric(18,2)). XOF/XAF s'affichent sans décimale,
 * mais on conserve 2 décimales en interne pour la cohérence des écritures.
 */
export type Currency = string;
export type Rounding = 'half-up' | 'down';

const DEFAULT_SCALE = 2;
const RATE_PRECISION = 1_000_000_000n; // 1e9 — précision des taux/ratios

function parseToMinor(input: string, scale: number, rounding: Rounding): bigint {
  let s = input.trim();
  let neg = false;
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  s = s.replace(/\s/g, '');
  const [intPart, fracPart = ''] = s.split('.');
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) throw new Error(`Money: montant invalide « ${input} »`);
  const fracPadded = fracPart + '0'.repeat(scale + 1);
  const kept = fracPadded.slice(0, scale);
  const nextDigit = fracPadded.charCodeAt(scale) - 48; // chiffre de rang scale+1
  let value = BigInt((intPart || '0') + kept);
  if (rounding === 'half-up' && nextDigit >= 5) value += 1n;
  return neg ? -value : value;
}

function divRoundHalfUp(num: bigint, den: bigint): bigint {
  if (den < 0n) return divRoundHalfUp(-num, -den);
  if (num >= 0n) return (num + den / 2n) / den;
  return -((-num + den / 2n) / den);
}

export class Money {
  private constructor(
    readonly minor: bigint,
    readonly currency: Currency,
    readonly scale: number,
  ) {}

  static fromMinor(minor: bigint | number | string, currency: Currency, scale = DEFAULT_SCALE): Money {
    return new Money(BigInt(minor), currency, scale);
  }

  /** Construit depuis un montant en unités majeures (string conseillée pour l'exactitude). */
  static of(amount: number | string, currency: Currency, scale = DEFAULT_SCALE, rounding: Rounding = 'half-up'): Money {
    const s = typeof amount === 'number' ? amount.toFixed(scale) : amount;
    return new Money(parseToMinor(s, scale, rounding), currency, scale);
  }

  static zero(currency: Currency, scale = DEFAULT_SCALE): Money {
    return new Money(0n, currency, scale);
  }

  private assertCompatible(other: Money): void {
    if (other.currency !== this.currency)
      throw new Error(`Money: devises incompatibles (${this.currency} vs ${other.currency})`);
    if (other.scale !== this.scale) throw new Error(`Money: échelles incompatibles (${this.scale} vs ${other.scale})`);
  }

  add(other: Money): Money {
    this.assertCompatible(other);
    return new Money(this.minor + other.minor, this.currency, this.scale);
  }

  subtract(other: Money): Money {
    this.assertCompatible(other);
    return new Money(this.minor - other.minor, this.currency, this.scale);
  }

  negate(): Money {
    return new Money(-this.minor, this.currency, this.scale);
  }

  abs(): Money {
    return new Money(this.minor < 0n ? -this.minor : this.minor, this.currency, this.scale);
  }

  /** Multiplie par un entier (quantité) — exact. */
  multiplyInt(factor: number | bigint): Money {
    return new Money(this.minor * BigInt(factor), this.currency, this.scale);
  }

  /** Multiplie par un taux/ratio fractionnaire, avec arrondi (taux d'intérêt, %, CPI…). */
  mulRate(rate: number, rounding: Rounding = 'half-up'): Money {
    const f = BigInt(Math.round(rate * Number(RATE_PRECISION)));
    const product = this.minor * f;
    const minor = rounding === 'down' ? product / RATE_PRECISION : divRoundHalfUp(product, RATE_PRECISION);
    return new Money(minor, this.currency, this.scale);
  }

  /** Pourcentage : 0.05 → 5 %. Alias lisible de mulRate. */
  percentage(rate: number): Money {
    return this.mulRate(rate);
  }

  /**
   * Répartit le montant selon des poids, sans perte de centime
   * (plus grands restes). Somme des parts == montant d'origine.
   */
  allocate(weights: number[]): Money[] {
    if (weights.length === 0) return [];
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) throw new Error('Money.allocate: somme des poids nulle');
    const wBig = weights.map((w) => BigInt(Math.round((w / total) * Number(RATE_PRECISION))));
    const raw = wBig.map((w) => (this.minor * w) / RATE_PRECISION);
    let remainder = this.minor - raw.reduce((a, b) => a + b, 0n);
    const parts = raw.slice();
    // Distribue le reste, 1 unité à la fois, dans l'ordre des poids décroissants.
    const order = weights.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w).map((x) => x.i);
    let k = 0;
    const step = remainder >= 0n ? 1n : -1n;
    while (remainder !== 0n) {
      parts[order[k % order.length]] += step;
      remainder -= step;
      k += 1;
    }
    return parts.map((m) => new Money(m, this.currency, this.scale));
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertCompatible(other);
    return this.minor < other.minor ? -1 : this.minor > other.minor ? 1 : 0;
  }
  equals(other: Money): boolean {
    return this.currency === other.currency && this.scale === other.scale && this.minor === other.minor;
  }
  lt(o: Money) { return this.compare(o) < 0; }
  lte(o: Money) { return this.compare(o) <= 0; }
  gt(o: Money) { return this.compare(o) > 0; }
  gte(o: Money) { return this.compare(o) >= 0; }
  isZero(): boolean { return this.minor === 0n; }
  isNegative(): boolean { return this.minor < 0n; }
  isPositive(): boolean { return this.minor > 0n; }

  min(other: Money): Money { return this.lte(other) ? this : other; }
  max(other: Money): Money { return this.gte(other) ? this : other; }

  /** Représentation décimale exacte en unités majeures (string). */
  toMajorString(): string {
    const neg = this.minor < 0n;
    const digits = (neg ? -this.minor : this.minor).toString().padStart(this.scale + 1, '0');
    const intPart = digits.slice(0, digits.length - this.scale) || '0';
    const fracPart = this.scale > 0 ? '.' + digits.slice(digits.length - this.scale) : '';
    return (neg ? '-' : '') + intPart + fracPart;
  }

  /** ⚠ Affichage uniquement — peut perdre en précision sur de très grands montants. */
  toMajorNumber(): number {
    return Number(this.toMajorString());
  }

  format(locale = 'fr-FR', decimals = 0): string {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(
      this.toMajorNumber(),
    );
  }
}

export function sumMoney(items: Money[], currency: Currency, scale = DEFAULT_SCALE): Money {
  return items.reduce((acc, m) => acc.add(m), Money.zero(currency, scale));
}
