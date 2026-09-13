/**
 * M9 (achats/appro/logistique) — Expéditions & dédouanement. Suivi logistique
 * d'un approvisionnement importé : incoterm, statut douanier, ETA, réception.
 * Domaine pur, aucune dépendance UI/IO.
 * Table : ao_shipments (opération-scopée ; lien optionnel au bon de commande).
 */

/** Incoterms 2020 usuels. */
export const INCOTERMS = ['EXW', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;
export type Incoterm = (typeof INCOTERMS)[number];

/** Étapes logistiques / douanières. */
export const CUSTOMS_STATUSES = ['en_attente', 'en_transit', 'en_douane', 'dedouane', 'livre'] as const;
export type CustomsStatus = (typeof CUSTOMS_STATUSES)[number];

export interface Shipment {
  id: string;
  tenantId: string;
  operationId: string;
  /** Bon de commande source (M10), ou null. */
  poId: string | null;
  reference: string;
  incoterm: Incoterm | null;
  customsStatus: CustomsStatus;
  /** Date estimée d'arrivée (ISO yyyy-mm-dd), ou null. */
  eta: string | null;
  /** Date de réception sur site (ISO yyyy-mm-dd), ou null tant que non livré. */
  receivedAt: string | null;
}

export interface ShipmentInput {
  reference: string;
  poId?: string | null;
  incoterm?: Incoterm | null;
  eta?: string | null;
}
