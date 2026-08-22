/**
 * M14 — Machine à états du change order (réf Spec M14 §4).
 *   requested → under_review → arbitrated → approved | rejected ; approved → converted.
 * Les gardes appliquent RG-M14-02 (impact instruit avant arbitrage),
 * RG-M14-03 (rôle requis par seuil) et §8 (refus motivé, conversion d'un CO approuvé).
 * Le contrôle « le rôle peut déclencher l'action » relève de permissions.ts ;
 * ici on garde la légalité de transition + les gardes métier.
 */
import type { Role } from '../m1/types';
import { roleSatisfies } from './rules';
import type { ChangeStatus } from './types';

export type ChangeAction = 'submit_impact' | 'arbitrate' | 'approve' | 'reject' | 'convert';

const TRANSITIONS: Record<ChangeAction, { from: ChangeStatus; to: ChangeStatus }> = {
  submit_impact: { from: 'requested', to: 'under_review' },
  arbitrate: { from: 'under_review', to: 'arbitrated' },
  approve: { from: 'arbitrated', to: 'approved' },
  reject: { from: 'arbitrated', to: 'rejected' },
  convert: { from: 'approved', to: 'converted' },
};

/** Contexte de garde injecté par la couche appelante. */
export interface ChangeTransitionContext {
  /** RG-M14-02 — l'analyse d'impact a été instruite. */
  impactAnalyzed: boolean;
  /** RG-M14-03 — rôle minimal requis, calculé via requiredRoleFor(|impact|, rules). */
  requiredRole: Role;
}

export interface ChangeTransitionRequest {
  role: Role;
  /** Motif — obligatoire pour un rejet (§8). */
  reason?: string;
}

export type ChangeDecision =
  | { ok: true; to: ChangeStatus }
  | { ok: false; code: 'invalid_transition' }
  | { ok: false; code: 'impact_required' }
  | { ok: false; code: 'insufficient_role' }
  | { ok: false; code: 'reason_required' };

export function nextStatus(from: ChangeStatus, action: ChangeAction): ChangeStatus | null {
  const t = TRANSITIONS[action];
  return t && t.from === from ? t.to : null;
}

/**
 * Évalue une action sur un change order.
 * `arbitrate` et `approve` exigent que l'impact soit instruit (RG-M14-02)
 * et que le rôle satisfasse le seuil (RG-M14-03) ; `reject` exige un motif (§8).
 */
export function evaluateChangeTransition(
  from: ChangeStatus,
  action: ChangeAction,
  ctx: ChangeTransitionContext,
  req: ChangeTransitionRequest,
): ChangeDecision {
  const to = nextStatus(from, action);
  if (!to) return { ok: false, code: 'invalid_transition' };

  if (action === 'submit_impact' && !ctx.impactAnalyzed) return { ok: false, code: 'impact_required' };

  if (action === 'arbitrate' || action === 'approve') {
    if (!ctx.impactAnalyzed) return { ok: false, code: 'impact_required' }; // RG-M14-02
    if (!roleSatisfies(req.role, ctx.requiredRole)) return { ok: false, code: 'insufficient_role' }; // RG-M14-03
  }

  if (action === 'reject') {
    if (!req.reason || req.reason.trim().length === 0) return { ok: false, code: 'reason_required' };
  }

  return { ok: true, to };
}
