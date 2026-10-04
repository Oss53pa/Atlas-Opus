/**
 * M9 — Règles du référentiel fournisseurs, pures.
 * La notation n'est pas saisie : elle se déduit de la conformité des réceptions
 * (M10). Pas de livraison enregistrée → pas de note inventée.
 */
import type { Delivery, PurchaseOrder } from '../m10/types';
import type { Supplier, SupplierStatus } from './types';

/** Transitions de référencement autorisées. */
const TRANSITIONS: Record<SupplierStatus, SupplierStatus[]> = {
  en_referencement: ['actif', 'ecarte'],
  actif: ['ecarte'],
  ecarte: ['actif'],
};

export function canTransitionSupplier(from: SupplierStatus, to: SupplierStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Fournisseurs proposables sur un bon de commande (un écarté ne l'est plus). */
export function selectableSuppliers<T extends Pick<Supplier, 'status'>>(list: T[]): T[] {
  return list.filter((s) => s.status !== 'ecarte');
}

/**
 * Note sur 5 d'un fournisseur = part des livraisons conformes parmi celles de
 * ses bons de commande. null s'il n'a encore rien livré.
 */
export function supplierRating(
  supplierId: string,
  orders: Pick<PurchaseOrder, 'id' | 'supplierId'>[],
  deliveries: Pick<Delivery, 'purchaseOrderId' | 'conform'>[],
): number | null {
  const own = new Set(orders.filter((o) => o.supplierId === supplierId).map((o) => o.id));
  const mine = deliveries.filter((d) => own.has(d.purchaseOrderId));
  if (mine.length === 0) return null;
  return (mine.filter((d) => d.conform).length / mine.length) * 5;
}

/** Nombre de livraisons non conformes imputables au fournisseur. */
export function nonConformDeliveries(
  supplierId: string,
  orders: Pick<PurchaseOrder, 'id' | 'supplierId'>[],
  deliveries: Pick<Delivery, 'purchaseOrderId' | 'conform'>[],
): number {
  const own = new Set(orders.filter((o) => o.supplierId === supplierId).map((o) => o.id));
  return deliveries.filter((d) => own.has(d.purchaseOrderId) && !d.conform).length;
}
