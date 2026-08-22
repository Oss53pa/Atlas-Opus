/**
 * M7 — Matrice de permissions (réf Spec M7 §2).
 *   Annuaire & contrats : gérer    → moa_director, amo, procurement (R : tous)
 *   Assurances : suivre/gérer       → moa_director, amo (R : + finance, viewer…)
 *   Registre : acter une décision   → moa_director (V), amo (U)
 *   RACI : configurer               → moa_director, amo
 * Toujours bornée en amont par la RLS (tenant + périmètre du membership).
 */
import type { Role } from '../m1/types';

export type StakeholderAction =
  | 'stk.read'
  | 'stk.manage'
  | 'insurance.read'
  | 'insurance.manage'
  | 'decision.read'
  | 'decision.record'
  | 'raci.configure';

const ALL_READ: Role[] = [
  'owner',
  'moa_director',
  'finance',
  'amo',
  'procurement',
  'commercial',
  'site',
  'stakeholder',
  'viewer',
];

const MATRIX: Record<StakeholderAction, Role[]> = {
  'stk.read': ALL_READ,
  'stk.manage': ['owner', 'moa_director', 'amo', 'procurement'],
  'insurance.read': ALL_READ,
  'insurance.manage': ['owner', 'moa_director', 'amo'],
  'decision.read': ALL_READ,
  'decision.record': ['owner', 'moa_director', 'amo'],
  'raci.configure': ['owner', 'moa_director', 'amo'],
};

export function can(role: Role, action: StakeholderAction): boolean {
  return MATRIX[action].includes(role);
}
