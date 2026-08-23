/**
 * M11 (handoff) — Conception & GED · types du domaine, pur.
 * Documents de conception soumis au visa MOA/MOE (A : bon pour exécution ;
 * B : BPE avec observations ; C : refusé, à reprendre). Table : ao_documents.
 */

export const DOC_DISCIPLINES = ['architecture', 'structure', 'fluides', 'vrd', 'electricite', 'autre'] as const;
export type DocDiscipline = (typeof DOC_DISCIPLINES)[number];

/**
 * Machine documentaire : en_cours → diffusé → visé (A|B|C).
 *  - vise_a : bon pour exécution
 *  - vise_b : bon pour exécution avec observations
 *  - vise_c : refusé, à reprendre (indice suivant)
 */
export const DOC_STATUSES = ['en_cours', 'diffuse', 'vise_a', 'vise_b', 'vise_c'] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export interface Document {
  id: string;
  tenantId: string;
  operationId: string;
  reference: string;
  title: string;
  discipline: DocDiscipline;
  /** Indice de révision (A, B, C…). */
  indice: string;
  status: DocStatus;
}

export interface DocumentInput {
  reference: string;
  title: string;
  discipline: DocDiscipline;
  indice: string;
}
