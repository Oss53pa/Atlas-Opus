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
  /** Fournisseur référencé (M9). null = saisie libre historique via `supplier`. */
  supplierId: string | null;
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
  supplierId?: string | null;
  supplier: string;
  item: string;
  quantity: number;
  unit: string;
  amount: number;
}

/**
 * Réception (totale ou partielle) d'un bon de commande. Plusieurs réceptions
 * peuvent se succéder sur un même bon : la part reçue se cumule.
 * Table : ao_deliveries (opération-scopée).
 */
export interface Delivery {
  id: string;
  tenantId: string;
  operationId: string;
  purchaseOrderId: string;
  date: string;
  /** Part réceptionnée lors de cette livraison (0..1). */
  receivedRate: number;
  /** Conforme à la commande (qualité, quantité) — alimente la note fournisseur. */
  conform: boolean;
  notes: string | null;
}

export interface DeliveryInput {
  purchaseOrderId: string;
  date: string;
  receivedRate: number;
  conform?: boolean;
  notes?: string | null;
}
