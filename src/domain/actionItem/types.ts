/**
 * M13 (pilotage de réalisation) — Relevé d'actions. Actions à mener issues du
 * pilotage (réunions de chantier, revues) : responsable, échéance, statut.
 * Domaine pur, aucune dépendance UI/IO.
 * Table : ao_action_items (opération-scopée).
 */

/** Cycle de vie d'une action. */
export const ACTION_ITEM_STATUSES = ['ouvert', 'en_cours', 'fait', 'annule'] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

export interface ActionItem {
  id: string;
  tenantId: string;
  operationId: string;
  /** Compte rendu de chantier source (M13), ou null si action isolée. */
  siteReportId: string | null;
  description: string;
  /** Responsable (nom libre). */
  owner: string;
  /** Échéance (date ISO yyyy-mm-dd). */
  dueDate: string;
  status: ActionItemStatus;
}

export interface ActionItemInput {
  description: string;
  owner: string;
  dueDate: string;
  siteReportId?: string | null;
}
