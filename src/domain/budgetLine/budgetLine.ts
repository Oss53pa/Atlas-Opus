/**
 * M4/M5 (budget) — règles pures. Tout calcul monétaire passe par Money.ts
 * (jamais de flottant cumulé) ; les parts sont des ratios sans dimension.
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import type { BudgetLine } from './types';

/** Classe SYSCOHADA (1er chiffre du compte), ou '?' si indéterminée. */
export function syscohadaClass(account: string): string {
  const c = account.trim()[0];
  return c && c >= '1' && c <= '9' ? c : '?';
}

/** Budget total autorisé (Money), agrégé via Money.ts. */
export function totalBudget(lines: Pick<BudgetLine, 'amountBac'>[], currency: Currency): Money {
  return sumMoney(lines.map((l) => Money.of(l.amountBac, currency)), currency);
}

/** Budget par classe SYSCOHADA (Money par classe). */
export function budgetByClass(lines: Pick<BudgetLine, 'syscohadaAccount' | 'amountBac'>[], currency: Currency): Record<string, Money> {
  const groups = new Map<string, Money[]>();
  for (const l of lines) {
    const k = syscohadaClass(l.syscohadaAccount);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(Money.of(l.amountBac, currency));
  }
  const out: Record<string, Money> = {};
  for (const [k, items] of groups) out[k] = sumMoney(items, currency);
  return out;
}

/**
 * Part d'une ligne dans le budget total (0..1). Retourne 0 si le total est nul.
 * Calcul du ratio sur les entiers mineurs (précision Money) puis division.
 */
export function lineShare(line: Pick<BudgetLine, 'amountBac'>, lines: Pick<BudgetLine, 'amountBac'>[], currency: Currency): number {
  const total = totalBudget(lines, currency).toMajorNumber();
  if (total === 0) return 0;
  return Money.of(line.amountBac, currency).toMajorNumber() / total;
}

/** Reste à engager = budget − consommé (Money ; peut être négatif si dépassé). */
export function remaining(amountBac: number, consumed: number, currency: Currency): Money {
  return Money.of(amountBac, currency).subtract(Money.of(consumed, currency));
}

/** Le budget de la ligne est-il dépassé par le consommé ? */
export function isOverBudget(amountBac: number, consumed: number, currency: Currency): boolean {
  return remaining(amountBac, consumed, currency).toMajorNumber() < 0;
}
