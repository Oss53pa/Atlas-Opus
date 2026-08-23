/**
 * M10 — Achats, approvisionnement & logistique · types du domaine, pur.
 * Commandes d'achat (bons de commande) avec cycle de réception. Montant en
 * `number` (unités majeures) ; les cumuls passent par Money.ts. Table : ao_purchase_orders.
 */

/** Machine d'un bon de commande : brouillon → commandé → livré → réceptionné. */
export const PURCHASE_STATUSES = ['brouillon', 'commande', 'livre', 'receptionne'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  operationId: string;
  reference: string;
  supplier: string;
  item: string;
  quantity: number;
  unit: string;
  /** Montant total du bon (unités majeures). */
  amount: number;
  status: PurchaseStatus;
}

export interface PurchaseOrderInput {
  reference: string;
  supplier: string;
  item: string;
  quantity: number;
  unit: string;
  amount: number;
}
