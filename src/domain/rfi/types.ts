/**
 * M12 (handoff) — RFI & collaboration externe · types du domaine, pur.
 * Demandes d'information (Request For Information) émises vers la MOE / entreprises,
 * pouvant bloquer un visa (M11). Table : ao_rfis.
 */

export const RFI_STATUSES = ['ouverte', 'repondue', 'cloturee'] as const;
export type RfiStatus = (typeof RFI_STATUSES)[number];

export const RFI_PRIORITIES = ['normale', 'urgente'] as const;
export type RfiPriority = (typeof RFI_PRIORITIES)[number];

export interface Rfi {
  id: string;
  tenantId: string;
  operationId: string;
  number: string;
  subject: string;
  question: string;
  raisedBy: string;
  priority: RfiPriority;
  status: RfiStatus;
  /** Échéance de réponse attendue (ISO) ou null. */
  dueDate: string | null;
  /** Document GED impacté (référence) ou null. */
  documentRef: string | null;
  answer: string | null;
}

export interface RfiInput {
  number: string;
  subject: string;
  question: string;
  raisedBy: string;
  priority: RfiPriority;
  dueDate?: string | null;
  documentRef?: string | null;
}
