/**
 * M10 — Règles achats & logistique, pures et testables.
 * Machine du bon de commande, montant engagé (commandé et au-delà), réceptions.
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import { type Delivery, type PurchaseOrder, type PurchaseStatus } from './types';

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

/** Part réceptionnée d'un bon de commande (cumul des livraisons, plafonné à 1). */
export function receptionRate(orderId: string, deliveries: Pick<Delivery, 'purchaseOrderId' | 'receivedRate'>[]): number {
  const total = deliveries
    .filter((d) => d.purchaseOrderId === orderId)
    .reduce((acc, d) => acc + Math.max(0, d.receivedRate), 0);
  return Math.min(1, total);
}

/** Un bon est intégralement servi quand le cumul des réceptions atteint 100 %. */
export function isFullyReceived(orderId: string, deliveries: Pick<Delivery, 'purchaseOrderId' | 'receivedRate'>[]): boolean {
  return receptionRate(orderId, deliveries) >= 1;
}

/**
 * Montant réceptionné = Σ (montant du bon engagé × part reçue). Sert au
 * rapprochement avec le réalisé du bilan (M4) : on ne valorise que le reçu.
 */
export function montantReceptionne(
  orders: Pick<PurchaseOrder, 'id' | 'amount' | 'status'>[],
  deliveries: Pick<Delivery, 'purchaseOrderId' | 'receivedRate'>[],
  currency: Currency,
): Money {
  return orders
    .filter((o) => isCommitted(o.status))
    .reduce((acc, o) => acc.add(Money.of(o.amount, currency).mulRate(receptionRate(o.id, deliveries))), Money.zero(currency));
}

export { PURCHASE_STATUSES } from './types';
