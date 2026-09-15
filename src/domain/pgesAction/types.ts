/**
 * M19 (environnement & social) — Plan de Gestion E&S (PGES). Actions de gestion/
 * atténuation avec responsable, échéance et indicateur de suivi. Complète le
 * registre d'impacts EIES. Domaine pur, aucune dépendance UI/IO.
 * Table : ao_pges_actions (opération-scopée).
 */

/** Avancement de l'action de gestion. */
export const PGES_STATUSES = ['ouvert', 'en_cours', 'soldee'] as const;
export type PgesStatus = (typeof PGES_STATUSES)[number];

export interface PgesAction {
  id: string;
  tenantId: string;
  operationId: string;
  action: string;
  /** Responsable (nom libre). */
  responsable: string;
  /** Échéance (ISO yyyy-mm-dd), ou null. */
  echeance: string | null;
  /** Indicateur de suivi (KPI), ou null. */
  indicateur: string | null;
  status: PgesStatus;
}

export interface PgesActionInput {
  action: string;
  responsable: string;
  echeance?: string | null;
  indicateur?: string | null;
}
