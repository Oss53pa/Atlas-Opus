/**
 * M19 (volet litiges) — Registre des litiges & contentieux · types du domaine, purs.
 * Suivi des différends avec des tiers (entreprises, riverains, administration…) :
 * objet, contrepartie, montant en jeu, référence dossier. Distinct des réserves
 * (M19 réception) et des risques (M20). Table : ao_disputes (opération-scopée).
 * Montant en `number` (unités majeures) ; toute agrégation passe par Money.ts.
 */

/** Machine : ouvert → en cours → (transigé | clos) ; réouverture clos → en cours. */
export const DISPUTE_STATUSES = ['ouvert', 'en_cours', 'transige', 'clos'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export interface Dispute {
  id: string;
  tenantId: string;
  operationId: string;
  /** Partie adverse (entreprise, riverain, administration…). */
  counterpart: string;
  /** Objet du litige. */
  object: string;
  /** Montant en jeu (unités majeures ; indicatif, non écriture). */
  amountAtStake: number;
  /** Référence du dossier (contentieux, médiation…) ou null. */
  fileRef: string | null;
  status: DisputeStatus;
}

export interface DisputeInput {
  counterpart: string;
  object: string;
  amountAtStake: number;
  fileRef?: string | null;
}
