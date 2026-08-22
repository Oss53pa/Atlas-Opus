/**
 * M1 — Machine à états de l'opération (réf Spec M1 §4).
 * Progression contrôlée ; gardes évaluées sur un contexte injecté
 * (alimenté par M4/M8/M11/M18). Retour arrière : RG-M1-10.
 * Aucune transition hors de cette table n'est permise (§9).
 */
import { PHASES, type Phase, type Role } from './types';

/** Contexte de garde — fourni par les autres modules (M2/M4/M7/M8/M11/M18). */
export interface TransitionContext {
  validatedProgramItems: number; // M1/program
  bilanInitialized: boolean; // M4
  marketsToLaunch: number; // M8 (DCE prêt)
  marketsNotified: number; // M8
  permitGranted: boolean; // M2 — permis de construire « granted » (RG-M2-07)
  doInsuranceValid: boolean; // M7 — police DO couvrante (RG-M7-04, via doGate)
  globalProgress: number; // 0..1 (M12/travaux)
  receptionDeclaredByDirector: boolean; // M1 (moa_director)
  receptionPvIssued: boolean; // M11/M18
  majorReservesLifted: boolean; // M11/M18
  finalBilanValidated: boolean; // M4
}

interface Condition {
  /** Clé i18n du libellé de condition (affichée si manquante, RG-M1-08). */
  key: string;
  ok: (c: TransitionContext) => boolean;
}

const FORWARD: Partial<Record<Phase, { to: Phase; conditions: Condition[] }>> = {
  amont: {
    to: 'conception',
    conditions: [
      { key: 'op.transition.cond.programValidated', ok: (c) => c.validatedProgramItems >= 1 },
      { key: 'op.transition.cond.bilanInitialized', ok: (c) => c.bilanInitialized },
    ],
  },
  conception: {
    to: 'passation',
    conditions: [{ key: 'op.transition.cond.dceReady', ok: (c) => c.marketsToLaunch >= 1 }],
  },
  passation: {
    to: 'realisation',
    conditions: [
      { key: 'op.transition.cond.marketNotified', ok: (c) => c.marketsNotified >= 1 },
      { key: 'op.transition.cond.permitGranted', ok: (c) => c.permitGranted }, // M2 (RG-M2-07)
      { key: 'op.transition.cond.doInsurance', ok: (c) => c.doInsuranceValid }, // M7 (RG-M7-04)
    ],
  },
  realisation: {
    to: 'reception',
    conditions: [
      {
        key: 'op.transition.cond.progressComplete',
        ok: (c) => c.globalProgress >= 1 || c.receptionDeclaredByDirector,
      },
    ],
  },
  reception: {
    to: 'exploitation',
    conditions: [
      { key: 'op.transition.cond.receptionPv', ok: (c) => c.receptionPvIssued },
      { key: 'op.transition.cond.reservesLifted', ok: (c) => c.majorReservesLifted },
    ],
  },
  exploitation: {
    to: 'cloture',
    conditions: [{ key: 'op.transition.cond.finalBilan', ok: (c) => c.finalBilanValidated }],
  },
};

export function phaseIndex(p: Phase): number {
  return PHASES.indexOf(p);
}

export function nextPhase(from: Phase): Phase | null {
  return FORWARD[from]?.to ?? null;
}

export function isForward(from: Phase, to: Phase): boolean {
  return FORWARD[from]?.to === to;
}

export function isBackward(from: Phase, to: Phase): boolean {
  return phaseIndex(to) < phaseIndex(from);
}

export interface TransitionRequest {
  role: Role;
  justification?: string;
  /** RG-M1-09 : le tenant exige une confirmation moa_director des transitions proposées par l'AMO. */
  tenantRequiresDirectorConfirm?: boolean;
}

export type TransitionDecision =
  | { ok: true; proposed?: boolean }
  | { ok: false; code: 'invalid_transition' }
  | { ok: false; code: 'guard_unmet'; missing: string[] }
  | { ok: false; code: 'needs_director' }
  | { ok: false; code: 'needs_justification' };

/**
 * Évalue une transition : validité (table §4), gardes (§4/§8),
 * retour arrière (RG-M1-10), proposition AMO (RG-M1-09).
 * Le contrôle de rôle « peut transiter » relève de permissions.ts.
 */
export function evaluateTransition(
  from: Phase,
  to: Phase,
  ctx: TransitionContext,
  req: TransitionRequest,
): TransitionDecision {
  if (from === to) return { ok: false, code: 'invalid_transition' };

  if (isBackward(from, to)) {
    // RG-M1-10 — retour arrière : moa_director (ou owner) + justification.
    if (req.role !== 'moa_director' && req.role !== 'owner') return { ok: false, code: 'needs_director' };
    if (!req.justification || req.justification.trim().length === 0)
      return { ok: false, code: 'needs_justification' };
    return { ok: true };
  }

  if (!isForward(from, to)) return { ok: false, code: 'invalid_transition' };

  const conditions = FORWARD[from]!.conditions;
  const missing = conditions.filter((c) => !c.ok(ctx)).map((c) => c.key);
  if (missing.length > 0) return { ok: false, code: 'guard_unmet', missing };

  // RG-M1-09 — proposition AMO soumise à confirmation si la config l'exige.
  if (req.role === 'amo' && req.tenantRequiresDirectorConfirm) return { ok: true, proposed: true };

  return { ok: true };
}
