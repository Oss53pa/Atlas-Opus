/**
 * M20 (passation→exploitation, volet DOE) — Dossier des Ouvrages Exécutés · types
 * du domaine, purs. Complétude documentaire remise à l'exploitant à la bascule :
 * plans de récolement, notices, garanties, attestations, PV d'essais…
 * Table : ao_doe_documents (opération-scopée).
 */

/** Catégories attendues d'un DOE (réf CDC M20). */
export const DOE_CATEGORIES = [
  'plans_recolement',
  'notices_exploitation',
  'garanties',
  'attestations',
  'pv_essais',
  'dossier_maintenance',
  'autre',
] as const;
export type DoeCategory = (typeof DOE_CATEGORIES)[number];

export interface DoeDocument {
  id: string;
  tenantId: string;
  operationId: string;
  category: DoeCategory;
  /** Référence / lien du document (ou null). */
  fileRef: string | null;
  /** Document vérifié et accepté pour la remise. */
  validated: boolean;
}

export interface DoeDocumentInput {
  category: DoeCategory;
  fileRef?: string | null;
}
