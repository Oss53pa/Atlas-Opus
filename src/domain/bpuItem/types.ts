/**
 * M8 (passation) — Bordereau de Prix Unitaires (BPU). Lignes de prix unitaires
 * d'un marché ; croisées avec des quantités elles donnent le détail estimatif.
 * Montants en unités majeures (number) ; tout calcul via Money.ts.
 * Table : ao_bpu_items (marché-scopée — rattachée à un contrat).
 */

export interface BpuItem {
  id: string;
  tenantId: string;
  contractId: string;
  code: string;
  label: string;
  unit: string;
  /** Prix unitaire (unités majeures). */
  unitPrice: number;
}

export interface BpuItemInput {
  code: string;
  label: string;
  unit: string;
  unitPrice: number;
}
