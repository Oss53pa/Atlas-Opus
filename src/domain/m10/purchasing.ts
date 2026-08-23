/**
 * M10 — Règles achats & logistique, pures et testables.
 * Machine du bon de commande, montant engagé (commandé et au-delà), réceptions.
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import { type PurchaseOrder, type PurchaseStatus } from './types';

const NEXT: Record<PurchaseStatus, PurchaseStatus | null> = {
  brouillon: 'commande',
  commande: 'livre',
  livre: 'receptionne',
  receptionne: null,
};

export function nextPurchaseStatus(from: PurchaseStatus): PurchaseStatus | null {
  return NEXT[from];
}

export function canTransitionPurchase(from: PurchaseStatus, to: PurchaseStatus): boolean {
  return NEXT[from] === to;
}

/** Un bon est « engagé » dès qu'il est commandé (commandé / livré / réceptionné). */
export function isCommitted(status: PurchaseStatus): boolean {
  return status === 'commande' || status === 'livre' || status === 'receptionne';
}

/** Montant engagé = somme des bons commandés et au-delà (→ engagements M15/M4). */
export function committedTotal(orders: Pick<PurchaseOrder, 'amount' | 'status'>[], currency: Currency): Money {
  return sumMoney(
    orders.filter((o) => isCommitted(o.status)).map((o) => Money.of(o.amount, currency)),
    currency,
  );
}

/** Nombre de bons réceptionnés. */
export function receivedCount(orders: Pick<PurchaseOrder, 'status'>[]): number {
  return orders.filter((o) => o.status === 'receptionne').length;
}

export { PURCHASE_STATUSES } from './types';
