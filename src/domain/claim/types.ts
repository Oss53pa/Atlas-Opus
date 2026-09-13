/**
 * M19 (volet sinistres) — Registre des sinistres / déclarations d'assurance · types
 * du domaine, purs. Un sinistre est rattaché (facultativement) à une police
 * d'assurance (M7) ; il suit son instruction jusqu'à indemnisation ou refus.
 * Table : ao_claims (opération-scopée). Montant en `number` (unités majeures) ;
 * toute agrégation passe par Money.ts.
 */

/** Machine : déclaré → en instruction → (indemnisé | refusé). */
export const CLAIM_STATUSES = ['declare', 'en_instruction', 'indemnise', 'refuse'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export interface Claim {
  id: string;
  tenantId: string;
  operationId: string;
  /** Police d'assurance rattachée (M7) ou null. */
  insuranceId: string | null;
  /** Événement à l'origine du sinistre. */
  event: string;
  /** Montant du sinistre / de l'indemnisation demandée (unités majeures). */
  amount: number;
  status: ClaimStatus;
}

export interface ClaimInput {
  insuranceId?: string | null;
  event: string;
  amount: number;
}
