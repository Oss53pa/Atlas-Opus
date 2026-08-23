/**
 * M18 — Concessionnaires & raccordements · types du domaine, pur.
 * Suivi des demandes de raccordement aux réseaux (eau, électricité, télécom…).
 * Table : ao_connections. Montant en `number` (unités majeures).
 */

export const UTILITY_TYPES = ['eau', 'electricite', 'telecom', 'assainissement', 'gaz'] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

/** Machine d'un raccordement : demande → étude → devis → payé → raccordé. */
export const CONNECTION_STATUSES = ['demande', 'etude', 'devis', 'paye', 'raccorde'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export interface Connection {
  id: string;
  tenantId: string;
  operationId: string;
  utility: UtilityType;
  concessionaire: string;
  reference: string;
  status: ConnectionStatus;
  /** Coût du raccordement (unités majeures). */
  cost: number;
  requestedAt: string;
}

export interface ConnectionInput {
  utility: UtilityType;
  concessionaire: string;
  reference: string;
  cost: number;
  requestedAt: string;
}
