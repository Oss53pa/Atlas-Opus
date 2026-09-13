/**
 * M23 (analyse & dépouillement des offres) — Grille de critères pondérés.
 * Critères d'évaluation d'une consultation et leur poids relatif. Domaine pur.
 * Les poids sont des fractions (0..1) ; les notes des points (0..100).
 * Table : ao_evaluation_criteria (opération-scopée).
 */

/** Nature du critère. */
export const CRITERION_TYPES = ['technique', 'financier', 'administratif', 'delai'] as const;
export type CriterionType = (typeof CRITERION_TYPES)[number];

export interface EvaluationCriterion {
  id: string;
  tenantId: string;
  operationId: string;
  /** Consultation / DAO rattaché (M8), ou null si grille générale. */
  contextId: string | null;
  label: string;
  type: CriterionType;
  /** Poids relatif du critère (fraction 0..1). */
  weight: number;
}

export interface EvaluationCriterionInput {
  label: string;
  type: CriterionType;
  weight: number;
  contextId?: string | null;
}
