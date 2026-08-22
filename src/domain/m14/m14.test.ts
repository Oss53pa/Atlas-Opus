import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import {
  evaluateChangeTransition,
  nextStatus,
  type ChangeTransitionContext,
} from './stateMachine';
import { can } from './permissions';
import {
  requiredRoleFor,
  roleSatisfies,
  cumulativeAvenantAmount,
  avenantCap,
  exceedsCap,
  buildAvenantRef,
  buildAvenantPropagation,
  canApplyToContract,
  buildNewChangeOrder,
} from './rules';
import { validateCreateChangeOrder, validateImpact, isImpactComplete, isRejectionReasonValid } from './validation';
import type { ChangeApprovalRule, ChangeOrder } from './types';

const XOF = 'XOF';
const m = (v: string) => Money.of(v, XOF);

const analyzedCtx = (over: Partial<ChangeTransitionContext> = {}): ChangeTransitionContext => ({
  impactAnalyzed: true,
  requiredRole: 'moa_director',
  ...over,
});

const co = (over: Partial<ChangeOrder> = {}): ChangeOrder => ({
  id: 'co1',
  tenantId: 't1',
  operationId: 'op1',
  contractId: 'c1',
  origin: 'moa',
  description: 'Reprise fondations',
  impactCost: m('0'),
  impactDays: 0,
  impactQuality: null,
  impactAnalyzed: true,
  status: 'approved',
  avenantRef: null,
  decidedBy: null,
  rejectionReason: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

describe('M14 — machine à états', () => {
  it('suit le chemin nominal requested → … → converted', () => {
    expect(nextStatus('requested', 'submit_impact')).toBe('under_review');
    expect(nextStatus('under_review', 'arbitrate')).toBe('arbitrated');
    expect(nextStatus('arbitrated', 'approve')).toBe('approved');
    expect(nextStatus('approved', 'convert')).toBe('converted');
  });

  it('refuse une transition illégale', () => {
    const d = evaluateChangeTransition('requested', 'convert', analyzedCtx(), { role: 'moa_director' });
    expect(d).toEqual({ ok: false, code: 'invalid_transition' });
  });

  it('RG-M14-02 — arbitrage sans impact instruit refusé', () => {
    const d = evaluateChangeTransition('under_review', 'arbitrate', analyzedCtx({ impactAnalyzed: false }), {
      role: 'moa_director',
    });
    expect(d).toEqual({ ok: false, code: 'impact_required' });
  });

  it('RG-M14-03 — rôle insuffisant vs seuil refusé', () => {
    const d = evaluateChangeTransition('under_review', 'arbitrate', analyzedCtx({ requiredRole: 'owner' }), {
      role: 'moa_director',
    });
    expect(d).toEqual({ ok: false, code: 'insufficient_role' });
  });

  it('RG-M14-03 — owner satisfait un seuil owner', () => {
    const d = evaluateChangeTransition('under_review', 'arbitrate', analyzedCtx({ requiredRole: 'owner' }), {
      role: 'owner',
    });
    expect(d).toEqual({ ok: true, to: 'arbitrated' });
  });

  it('§8 — refus sans motif refusé, avec motif accepté', () => {
    expect(evaluateChangeTransition('arbitrated', 'reject', analyzedCtx(), { role: 'moa_director' })).toEqual({
      ok: false,
      code: 'reason_required',
    });
    expect(
      evaluateChangeTransition('arbitrated', 'reject', analyzedCtx(), { role: 'moa_director', reason: 'Hors budget' }),
    ).toEqual({ ok: true, to: 'rejected' });
  });

  it('conversion possible uniquement depuis approved', () => {
    expect(evaluateChangeTransition('approved', 'convert', analyzedCtx(), { role: 'moa_director' })).toEqual({
      ok: true,
      to: 'converted',
    });
    expect(evaluateChangeTransition('arbitrated', 'convert', analyzedCtx(), { role: 'moa_director' })).toEqual({
      ok: false,
      code: 'invalid_transition',
    });
  });
});

describe('M14 — routage par seuil (RG-M14-03)', () => {
  const rules: ChangeApprovalRule[] = [
    { thresholdAmount: m('50000000'), requiredRole: 'owner' },
    { thresholdAmount: m('10000000'), requiredRole: 'moa_director' },
  ];

  it('sous le premier seuil → moa_director par défaut', () => {
    expect(requiredRoleFor(m('5000000'), rules)).toBe('moa_director');
  });

  it('au-delà du seuil haut → owner', () => {
    expect(requiredRoleFor(m('60000000'), rules)).toBe('owner');
  });

  it('impact négatif : compare la valeur absolue', () => {
    expect(requiredRoleFor(m('-60000000'), rules)).toBe('owner');
  });

  it('roleSatisfies : owner ≥ moa_director', () => {
    expect(roleSatisfies('owner', 'moa_director')).toBe(true);
    expect(roleSatisfies('moa_director', 'owner')).toBe(false);
    expect(roleSatisfies('amo', 'moa_director')).toBe(false);
  });
});

describe('M14 — cumul & plafond (RG-M14-06)', () => {
  it('cumule uniquement les CO convertis', () => {
    const orders: ChangeOrder[] = [
      co({ status: 'converted', impactCost: m('20000000') }),
      co({ status: 'converted', impactCost: m('5000000') }),
      co({ status: 'approved', impactCost: m('9999999') }), // non converti → ignoré
    ];
    expect(cumulativeAvenantAmount(orders, XOF).equals(m('25000000'))).toBe(true);
  });

  it('plafond = montant initial × capRate', () => {
    expect(avenantCap(m('100000000'), 0.3).equals(m('30000000'))).toBe(true);
  });

  it('signale le dépassement du plafond', () => {
    expect(exceedsCap(m('35000000'), m('100000000'), 0.3)).toBe(true);
    expect(exceedsCap(m('25000000'), m('100000000'), 0.3)).toBe(false);
  });
});

describe('M14 — conversion & propagation (RG-M14-05 / 01)', () => {
  it('scénario spec : +20 000 000 FCFA, +12 j → propagés au marché', () => {
    const converted = co({ status: 'converted', impactCost: m('20000000'), impactDays: 12, contractId: 'c1' });
    const ref = buildAvenantRef('MRC-2026-014', 1);
    expect(ref).toBe('MRC-2026-014-AV01');
    const prop = buildAvenantPropagation(converted, ref);
    expect(prop).not.toBeNull();
    expect(prop!.contractId).toBe('c1');
    expect(prop!.amountDelta.equals(m('20000000'))).toBe(true);
    expect(prop!.daysDelta).toBe(12);
    expect(prop!.avenantRef).toBe('MRC-2026-014-AV01');
  });

  it('pas de propagation si le CO n’est pas converti (RG-M14-01)', () => {
    expect(buildAvenantPropagation(co({ status: 'approved' }), 'x')).toBeNull();
    expect(canApplyToContract(co({ status: 'approved' }))).toBe(false);
    expect(canApplyToContract(co({ status: 'converted' }))).toBe(true);
  });

  it('impact délai négatif (gain) propagé tel quel', () => {
    const converted = co({ status: 'converted', impactCost: m('-3000000'), impactDays: -5 });
    const prop = buildAvenantPropagation(converted, 'r');
    expect(prop!.amountDelta.equals(m('-3000000'))).toBe(true);
    expect(prop!.daysDelta).toBe(-5);
  });
});

describe('M14 — construction & validation', () => {
  it('buildNewChangeOrder : statut requested, impact nul non instruit', () => {
    const n = buildNewChangeOrder(
      { contractId: 'c1', origin: 'moe', description: '  Ajout VRD  ' },
      XOF,
      { id: 'co9', tenantId: 't1', operationId: 'op1', now: '2026-02-02T00:00:00Z' },
    );
    expect(n.status).toBe('requested');
    expect(n.impactAnalyzed).toBe(false);
    expect(n.impactCost.isZero()).toBe(true);
    expect(n.description).toBe('Ajout VRD');
  });

  it('validateCreateChangeOrder : champs requis', () => {
    expect(validateCreateChangeOrder({})).toEqual({
      contractId: 'change.error.contract',
      origin: 'change.error.origin',
      description: 'change.error.description',
    });
    expect(validateCreateChangeOrder({ contractId: 'c1', origin: 'moa', description: 'Reprise étanchéité' })).toEqual(
      {},
    );
  });

  it('validateImpact / isImpactComplete : coût et jours requis, impact nul admis', () => {
    expect(isImpactComplete({ impactCost: m('0'), impactDays: 0 })).toBe(true);
    expect(validateImpact({ impactDays: 1.5 })).toEqual({
      impactCost: 'change.error.impactCost',
      impactDays: 'change.error.impactDays',
    });
  });

  it('isRejectionReasonValid', () => {
    expect(isRejectionReasonValid('  ')).toBe(false);
    expect(isRejectionReasonValid('Non conforme au programme')).toBe(true);
  });
});

describe('M14 — permissions (§2)', () => {
  it('création ouverte à moa_director/amo/finance, pas au viewer', () => {
    expect(can('finance', 'change.create')).toBe(true);
    expect(can('amo', 'change.create')).toBe(true);
    expect(can('viewer', 'change.create')).toBe(false);
  });

  it('arbitrage réservé à owner/moa_director ; conversion à moa_director/amo', () => {
    expect(can('moa_director', 'change.arbitrate')).toBe(true);
    expect(can('finance', 'change.arbitrate')).toBe(false);
    expect(can('amo', 'change.convert')).toBe(true);
    expect(can('finance', 'change.convert')).toBe(false);
  });

  it('lecture ouverte à tous les rôles', () => {
    expect(can('viewer', 'change.read')).toBe(true);
    expect(can('site', 'change.read')).toBe(true);
  });
});
