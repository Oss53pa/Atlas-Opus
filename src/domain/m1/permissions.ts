/**
 * M1 — Matrice de permissions (réf Spec M1 §2).
 * C=créer R=lire U=modifier D=archiver T=changer de phase.
 * Toujours bornée en amont par RLS (tenant + périmètre du membership).
 */
import type { Role } from './types';

export type Action =
  | 'op.create'
  | 'op.read'
  | 'op.update'
  | 'op.transition'
  | 'op.archive'
  | 'program.read'
  | 'program.edit'
  | 'program.validate'
  | 'bilan.read'
  | 'bilan.edit'
  | 'stakeholder.read'
  | 'stakeholder.edit'
  | 'payment.read'
  | 'payment.edit'
  | 'financing.read'
  | 'financing.edit'
  | 'planning.read'
  | 'planning.edit'
  | 'tender.read'
  | 'tender.edit';

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

const MATRIX: Record<Action, Role[]> = {
  'op.create': ['owner', 'moa_director'],
  'op.read': ALL_READ,
  'op.update': ['owner', 'moa_director', 'amo'],
  'op.transition': ['owner', 'moa_director'],
  'op.archive': ['owner', 'moa_director'],
  'program.read': ALL_READ,
  'program.edit': ['owner', 'moa_director', 'amo'],
  'program.validate': ['owner', 'moa_director'],
  'bilan.read': ALL_READ,
  'bilan.edit': ['owner', 'moa_director', 'finance'],
  'stakeholder.read': ALL_READ,
  'stakeholder.edit': ['owner', 'moa_director', 'amo'],
  'payment.read': ALL_READ,
  'payment.edit': ['owner', 'moa_director', 'finance'],
  'financing.read': ALL_READ,
  'financing.edit': ['owner', 'moa_director', 'finance'],
  'planning.read': ALL_READ,
  'planning.edit': ['owner', 'moa_director', 'amo'],
  'tender.read': ALL_READ,
  'tender.edit': ['owner', 'moa_director', 'procurement', 'amo'],
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[action].includes(role);
}

/**
 * RG-M1-09 — L'AMO peut *proposer* une transition (T*), sa confirmation
 * restant soumise au moa_director si la config du tenant l'exige.
 */
export function canProposeTransition(role: Role): boolean {
  return role === 'amo';
}

/** Habilité à effectuer (et non seulement proposer) une transition. */
export function canCommitTransition(role: Role): boolean {
  return can(role, 'op.transition');
}
