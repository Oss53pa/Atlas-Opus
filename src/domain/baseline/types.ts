/**
 * M12 (planning, volet référence) — Baselines de planning. Un instantané figé
 * des tâches, servant de repère pour mesurer le dérapage (variance) du planning
 * courant. Domaine pur, aucune dépendance UI/IO.
 * Table : ao_baselines (opération-scopée).
 */

/** Ligne de planning figée dans une baseline (sous-ensemble stable de Task). */
export interface BaselineTask {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  isMilestone: boolean;
}

export interface Baseline {
  id: string;
  tenantId: string;
  operationId: string;
  /** Libellé du repère (ex. « Marché signé », « Ordre de service »). */
  label: string;
  /** Instantané des tâches au moment de la capture. */
  snapshot: BaselineTask[];
  /** Baseline de référence active (une seule active par opération). */
  isActive: boolean;
  createdAt: string;
}

export interface BaselineInput {
  label: string;
  snapshot: BaselineTask[];
}
