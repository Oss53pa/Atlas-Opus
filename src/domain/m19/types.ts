/**
 * M19 — Réception & GPA (garantie de parfait achèvement) · types du domaine, pur.
 * Suivi des réserves (levées) conditionnant le prononcé de la réception.
 * Table : ao_reserves.
 */

export const RESERVE_SEVERITIES = ['mineure', 'majeure'] as const;
export type ReserveSeverity = (typeof RESERVE_SEVERITIES)[number];

/** Machine d'une réserve : ouverte → levée. */
export const RESERVE_STATUSES = ['ouverte', 'levee'] as const;
export type ReserveStatus = (typeof RESERVE_STATUSES)[number];

export interface Reserve {
  id: string;
  tenantId: string;
  operationId: string;
  label: string;
  /** Localisation (lot, niveau, local). */
  location: string;
  severity: ReserveSeverity;
  status: ReserveStatus;
  /** Date de constat (ISO). */
  raisedAt: string;
  /** Date de levée (ISO) ou null. */
  clearedAt: string | null;
}

export interface ReserveInput {
  label: string;
  location: string;
  severity: ReserveSeverity;
  raisedAt: string;
}
