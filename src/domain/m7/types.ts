/**
 * M7 — Parties prenantes & contrats · types du domaine (réf Spec M7 §3).
 * Domaine pur : aucune dépendance UI/IO. Forme camelCase ; le mapping
 * snake_case (Supabase : stakeholder_contracts, insurances, deliverables,
 * decisions, raci_assignments) se fait dans la couche données.
 * Tout montant est un `Money` (invariant CLAUDE.md §5).
 */
import type { Money } from '../money/Money';
import type { StakeholderType } from '../m2/types';

/** Assurances suivies (§3). RC_pro = responsabilité civile professionnelle (MOE). */
export const INSURANCE_TYPES = ['DO', 'decennale', 'RC', 'TRC', 'RC_pro'] as const;
export type InsuranceType = (typeof INSURANCE_TYPES)[number];

/** Statut d'assurance calculé (§4) — jamais persisté, toujours dérivé. */
export type InsuranceStatus = 'valid' | 'expiring' | 'expired' | 'missing';

export interface Insurance {
  id: string;
  tenantId: string;
  stakeholderId: string;
  type: InsuranceType;
  insurer: string;
  validFrom: string;
  validTo: string | null;
  attestationRef: string | null;
}

/** Contrat d'intervenant (mission/honoraires). */
export type ContractStatus = 'draft' | 'active' | 'closed';
export interface StakeholderContract {
  id: string;
  tenantId: string;
  stakeholderId: string;
  mission: string;
  feeAmount: Money;
  status: ContractStatus;
}

/** Livrables (§3) — machine pending → submitted → accepted ; → late si échéance dépassée. */
export const DELIVERABLE_STATUSES = ['pending', 'submitted', 'accepted', 'late'] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];
export interface Deliverable {
  id: string;
  tenantId: string;
  contractId: string;
  label: string;
  dueDate: string;
  status: DeliverableStatus;
}

/** Registre des décisions (append-only, §3 / RG-M7-08). */
export const DECISION_KINDS = ['decision', 'courrier', 'OS', 'CR_reunion'] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];
export interface Decision {
  id: string;
  tenantId: string;
  operationId: string;
  kind: DecisionKind;
  reference: string;
  date: string;
  decidedBy: string;
}

/** Matrice RACI (§3). Exactement un « A » par activité (RG-M7-07). */
export type Raci = 'R' | 'A' | 'C' | 'I';
export interface RaciAssignment {
  id: string;
  activity: string;
  stakeholderId: string;
  raci: Raci;
}

export type { StakeholderType };
