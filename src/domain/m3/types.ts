/**
 * M3 — Études amont · types du domaine (réf Spec M3), pur. Aucune dépendance UI/IO.
 * Diagnostics et études préalables (géotechnique, environnement, programmation…).
 * Le mapping snake_case (ao_studies) se fait dans la couche données. Montant en
 * `number` (unités majeures) ; les cumuls monétaires passent par Money.ts.
 */

export const STUDY_KINDS = [
  'geotechnique',
  'environnementale',
  'programmatique',
  'topographique',
  'hydraulique',
  'autre',
] as const;
export type StudyKind = (typeof STUDY_KINDS)[number];

/** Machine d'une étude : planifiée → en_cours → remise → validée (§4). */
export const STUDY_STATUSES = ['planifiee', 'en_cours', 'remise', 'validee'] as const;
export type StudyStatus = (typeof STUDY_STATUSES)[number];

export interface Study {
  id: string;
  tenantId: string;
  operationId: string;
  kind: StudyKind;
  provider: string;
  status: StudyStatus;
  /** Coût de l'étude (unités majeures). */
  cost: number;
  /** Échéance de remise (ISO date) ou null. */
  dueDate: string | null;
  /** Synthèse / conclusion (facultative). */
  summary: string | null;
}

export interface StudyInput {
  kind: StudyKind;
  provider: string;
  cost: number;
  dueDate?: string | null;
  summary?: string | null;
}
