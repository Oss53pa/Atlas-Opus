/**
 * M8 (BPU) — règles pures. Le montant d'une ligne = prix unitaire × quantité,
 * calculé via Money.ts (jamais de flottant cumulé) ; le détail estimatif somme
 * les lignes. Les codes de bordereau doivent être uniques.
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import type { BpuItem } from './types';

/** Montant d'une ligne : prix unitaire × quantité (Money ; quantité fractionnaire tolérée, arrondi). */
export function lineAmount(unitPrice: number, quantity: number, currency: Currency): Money {
  return Money.of(unitPrice, currency).mulRate(quantity);
}

/** Somme des prix unitaires du bordereau (Money) — repère catalogue. */
export function catalogTotal(items: Pick<BpuItem, 'unitPrice'>[], currency: Currency): Money {
  return sumMoney(items.map((i) => Money.of(i.unitPrice, currency)), currency);
}

/**
 * Détail estimatif : somme des (prix unitaire × quantité) sur les lignes,
 * `quantities` associant l'id de ligne à sa quantité (absente ⇒ 0). Via Money.
 */
export function estimateTotal(items: BpuItem[], quantities: Record<string, number>, currency: Currency): Money {
  return sumMoney(
    items.map((i) => lineAmount(i.unitPrice, quantities[i.id] ?? 0, currency)),
    currency,
  );
}

/** Codes en doublon dans le bordereau (un code = un prix). */
export function duplicateCodes(items: Pick<BpuItem, 'code'>[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const i of items) {
    const code = i.code.trim();
    if (seen.has(code)) dups.add(code);
    else seen.add(code);
  }
  return [...dups];
}

/** Le bordereau est-il cohérent (aucun code en doublon) ? */
export function hasUniqueCodes(items: Pick<BpuItem, 'code'>[]): boolean {
  return duplicateCodes(items).length === 0;
}
