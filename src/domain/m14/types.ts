/**
 * M14 — Maîtrise des modifications (change control) · types du domaine (réf Spec M14 §3).
 * Domaine pur : aucune dépendance UI/IO. Forme camelCase ; le mapping
 * snake_case (Supabase, table `change_orders`) se fait dans la couche données.
 * Tout montant est un `Money` (invariant CLAUDE.md §5) ; les jours sont des entiers signés.
 */
import type { Money } from '../money/Money';
import type { Role } from '../m1/types';

/** Machine à états §4 : requested → under_review → arbitrated → approved | rejected ; approved → converted. */
export const CHANGE_STATUSES = [
  'requested',
  'under_review',
  'arbitrated',
  'approved',
  'rejected',
  'converted',
] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

/** Origine de la modification (§3). */
export const CHANGE_ORIGINS = ['moa', 'moe', 'entreprise', 'reglementaire', 'aleas'] as const;
export type ChangeOrigin = (typeof CHANGE_ORIGINS)[number];

/**
 * Ordre de modification. `impactCost` est signé (± ; réf §3) et exprimé
 * dans la devise de l'opération ; `impactDays` est signé (retard + / gain −).
 * `impactAnalyzed` matérialise RG-M14-02 (analyse d'impact instruite).
 */
export interface ChangeOrder {
  id: string;
  tenantId: string;
  operationId: string;
  contractId: string | null;
  origin: ChangeOrigin;
  description: string;
  impactCost: Money;
  impactDays: number;
  impactQuality: string | null;
  impactAnalyzed: boolean;
  status: ChangeStatus;
  avenantRef: string | null;
  decidedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Saisie de création d'une demande (§2 : origine, marché visé, description). */
export interface CreateChangeOrderInput {
  contractId: string;
  origin: ChangeOrigin;
  description: string;
}

/** Instruction de l'impact (§2 « Instruire l'impact ») avant arbitrage (RG-M14-02). */
export interface ImpactInput {
  impactCost: Money;
  impactDays: number;
  impactQuality?: string | null;
}

/** Règle d'approbation par seuil (§3, table `change_approval_rules`). RG-M14-03. */
export interface ChangeApprovalRule {
  thresholdAmount: Money;
  requiredRole: Role;
}

/**
 * Charge utile de propagation produite par la conversion (RG-M14-05) :
 * avenant (M8), ajustement du montant marché/bilan (M4), décalage planning (M12).
 */
export interface AvenantPropagation {
  contractId: string;
  amountDelta: Money;
  daysDelta: number;
  avenantRef: string;
}
