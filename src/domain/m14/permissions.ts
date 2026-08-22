/**
 * M14 — Matrice de permissions (réf Spec M14 §2).
 *   Créer une demande      : moa_director, amo, finance
 *   Instruire l'impact     : moa_director, amo, finance
 *   Arbitrer / approuver   : moa_director (A) — escaladé à owner/comité selon le seuil (RG-M14-03)
 *   Convertir en avenant   : moa_director (C), amo (U)
 *   Lire                   : tous
 * Toujours bornée en amont par la RLS (tenant + périmètre du membership).
 * Le seuil RG-M14-03 restreint en outre l'arbitrage via requiredRoleFor/roleSatisfies.
 */
import type { Role } from '../m1/types';

export type ChangeControlAction =
  | 'change.create'
  | 'change.read'
  | 'change.submit_impact'
  | 'change.arbitrate'
  | 'change.convert';

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

const MATRIX: Record<ChangeControlAction, Role[]> = {
  'change.create': ['owner', 'moa_director', 'amo', 'finance'],
  'change.read': ALL_READ,
  'change.submit_impact': ['owner', 'moa_director', 'amo', 'finance'],
  // Autorité de base ; le seuil (RG-M14-03) peut exiger owner via roleSatisfies.
  'change.arbitrate': ['owner', 'moa_director'],
  'change.convert': ['owner', 'moa_director', 'amo'],
};

export function can(role: Role, action: ChangeControlAction): boolean {
  return MATRIX[action].includes(role);
}
