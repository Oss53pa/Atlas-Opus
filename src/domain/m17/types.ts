/**
 * M17 — Cautions & garanties · types du domaine, pur.
 * Garanties bancaires (restitution d'avance, bonne exécution, retenue de garantie,
 * soumission). Le statut effectif (échéance) est dérivé, jamais persisté.
 * Montant en `number` (unités majeures). Table : ao_guarantees.
 */

export const GUARANTEE_TYPES = ['restitution_avance', 'bonne_execution', 'retenue_garantie', 'soumission'] as const;
export type GuaranteeType = (typeof GUARANTEE_TYPES)[number];

/** Statut persisté : active → libérée | appelée. */
export const GUARANTEE_STATUSES = ['active', 'liberee', 'appelee'] as const;
export type GuaranteeStatus = (typeof GUARANTEE_STATUSES)[number];

/** Statut affiché (dérivé) : ajoute échéance imminente / expirée. */
export type GuaranteeDisplayStatus = GuaranteeStatus | 'expiring' | 'expiree';

export interface Guarantee {
  id: string;
  tenantId: string;
  operationId: string;
  type: GuaranteeType;
  issuer: string;
  amount: number;
  validFrom: string;
  validUntil: string | null;
  status: GuaranteeStatus;
}

export interface GuaranteeInput {
  type: GuaranteeType;
  issuer: string;
  amount: number;
  validFrom: string;
  validUntil?: string | null;
}
