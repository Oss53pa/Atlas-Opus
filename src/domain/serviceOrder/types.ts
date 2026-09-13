/**
 * M13/M15 — Ordres de service (OS). Instrument MOA notifié à l'entreprise :
 * démarrage, arrêt, reprise, notification diverse. Impacte planning et délais.
 * Domaine pur, aucune dépendance UI/IO.
 * Table : ao_service_orders (opération-scopée).
 */

/** Nature de l'ordre de service. */
export const SERVICE_ORDER_TYPES = ['demarrage', 'arret', 'reprise', 'notification', 'autre'] as const;
export type ServiceOrderType = (typeof SERVICE_ORDER_TYPES)[number];

/** Cycle de vie : projet → émis → notifié ; annulable tant que non notifié. */
export const SERVICE_ORDER_STATUSES = ['projet', 'emis', 'notifie', 'annule'] as const;
export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

export interface ServiceOrder {
  id: string;
  tenantId: string;
  operationId: string;
  /** Marché concerné (M7/contrats), ou null si OS général. */
  contractId: string | null;
  type: ServiceOrderType;
  reference: string;
  content: string;
  status: ServiceOrderStatus;
  createdAt: string;
}

export interface ServiceOrderInput {
  type: ServiceOrderType;
  reference: string;
  content: string;
  contractId?: string | null;
}
