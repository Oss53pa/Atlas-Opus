import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import {
  insuranceStatus,
  isCovering,
  requiredInsurances,
  missingMandatoryInsurances,
  isInterventionBlocked,
  doGate,
  hasSingleAccountable,
  raciActivitiesInBreach,
  honorairesTotal,
  canModifyDecision,
  OPERATION_REQUIRED_INSURANCES,
} from './rules';
import {
  nextDeliverableStatus,
  effectiveDeliverableStatus,
  evaluateDeliverableTransition,
} from './stateMachine';
import { can } from './permissions';
import {
  validateInsurance,
  isFeeValid,
  validateDeliverable,
  canAssignAccountable,
  isActivityRaciValid,
} from './validation';
import type { Insurance, RaciAssignment, StakeholderContract } from './types';

const XOF = 'XOF';
const m = (v: string) => Money.of(v, XOF);
const TODAY = '2026-08-22';

const pol = (type: Insurance['type'], validTo: string | null): Pick<Insurance, 'type' | 'validTo'> => ({ type, validTo });

describe('M7 — statut d’assurance (§4)', () => {
  it('valid / expiring / expired selon l’échéance', () => {
    expect(insuranceStatus({ validTo: '2027-01-01' }, TODAY)).toBe('valid');
    expect(insuranceStatus({ validTo: '2026-09-10' }, TODAY)).toBe('expiring'); // 19 j ≤ 30
    expect(insuranceStatus({ validTo: '2026-08-01' }, TODAY)).toBe('expired');
  });

  it('police sans échéance = valide', () => {
    expect(insuranceStatus({ validTo: null }, TODAY)).toBe('valid');
  });

  it('isCovering vrai pour valid et expiring, faux pour expired', () => {
    expect(isCovering(pol('DO', '2027-01-01'), TODAY)).toBe(true);
    expect(isCovering(pol('DO', '2026-09-10'), TODAY)).toBe(true);
    expect(isCovering(pol('DO', '2026-08-01'), TODAY)).toBe(false);
  });
});

describe('M7 — assurances obligatoires (RG-M7-02 / 03)', () => {
  it('entreprise → décennale + RC ; MOE → RC pro', () => {
    expect(requiredInsurances('entreprise')).toEqual(['decennale', 'RC']);
    expect(requiredInsurances('moe')).toEqual(['RC_pro']);
    expect(requiredInsurances('notaire')).toEqual([]);
  });

  it('opération → DO + TRC', () => {
    expect(OPERATION_REQUIRED_INSURANCES).toEqual(['DO', 'TRC']);
  });

  it('entreprise sans décennale couvrante → manquante + intervention bloquée', () => {
    const policies = [pol('RC', '2027-01-01'), pol('decennale', '2026-08-01')]; // décennale expirée
    expect(missingMandatoryInsurances('entreprise', policies, TODAY)).toEqual(['decennale']);
    expect(isInterventionBlocked('entreprise', policies, TODAY)).toBe(true);
  });

  it('entreprise entièrement couverte → non bloquée', () => {
    const policies = [pol('RC', '2027-01-01'), pol('decennale', '2027-01-01')];
    expect(missingMandatoryInsurances('entreprise', policies, TODAY)).toEqual([]);
    expect(isInterventionBlocked('entreprise', policies, TODAY)).toBe(false);
  });
});

describe('M7 — garde DO → M1 (RG-M7-04)', () => {
  it('sans police DO « valid », la DO est une condition bloquante', () => {
    const g = doGate([pol('TRC', '2027-01-01')], TODAY);
    expect(g.ok).toBe(false);
    expect(g.blocking).toEqual(['DO']);
  });

  it('DO couvrante → garde levée', () => {
    const g = doGate([pol('DO', '2027-01-01')], TODAY);
    expect(g).toEqual({ ok: true, blocking: [] });
  });

  it('DO expirée → bloquée', () => {
    expect(doGate([pol('DO', '2026-01-01')], TODAY).ok).toBe(false);
  });
});

describe('M7 — RACI (RG-M7-07)', () => {
  const a = (activity: string, raci: RaciAssignment['raci']): Pick<RaciAssignment, 'activity' | 'raci'> => ({
    activity,
    raci,
  });

  it('exactement un A par activité', () => {
    expect(hasSingleAccountable([{ raci: 'A' }, { raci: 'C' }, { raci: 'I' }])).toBe(true);
    expect(hasSingleAccountable([{ raci: 'A' }, { raci: 'A' }])).toBe(false);
    expect(hasSingleAccountable([{ raci: 'R' }, { raci: 'C' }])).toBe(false);
  });

  it('liste les activités en anomalie (0 ou ≥2 A)', () => {
    const matrix = [
      a('Conception', 'A'),
      a('Conception', 'C'),
      a('Passation', 'A'),
      a('Passation', 'A'), // deux A → anomalie
      a('Suivi', 'R'), // aucun A → anomalie
    ];
    expect(raciActivitiesInBreach(matrix).sort()).toEqual(['Passation', 'Suivi']);
  });

  it('canAssignAccountable refuse un second A', () => {
    expect(canAssignAccountable([{ raci: 'C' }])).toBe(true);
    expect(canAssignAccountable([{ raci: 'A' }])).toBe(false);
    expect(isActivityRaciValid([{ raci: 'A' }, { raci: 'I' }])).toBe(true);
  });
});

describe('M7 — honoraires → M4 (RG-M7-09)', () => {
  const c = (status: StakeholderContract['status'], fee: string): StakeholderContract => ({
    id: 'c',
    tenantId: 't',
    stakeholderId: 's',
    mission: 'MOE',
    feeAmount: m(fee),
    status,
  });

  it('somme uniquement les contrats actifs', () => {
    const contracts = [c('active', '15000000'), c('active', '5000000'), c('draft', '9000000'), c('closed', '3000000')];
    expect(honorairesTotal(contracts, XOF).equals(m('20000000'))).toBe(true);
  });

  it('aucun contrat actif → zéro', () => {
    expect(honorairesTotal([c('draft', '9000000')], XOF).isZero()).toBe(true);
  });
});

describe('M7 — registre append-only (RG-M7-08)', () => {
  it('une décision actée n’est jamais modifiable', () => {
    expect(canModifyDecision()).toBe(false);
  });
});

describe('M7 — livrables (§4)', () => {
  it('pending → submitted → accepted', () => {
    expect(nextDeliverableStatus('pending', 'submit')).toBe('submitted');
    expect(nextDeliverableStatus('submitted', 'accept')).toBe('accepted');
    expect(nextDeliverableStatus('pending', 'accept')).toBeNull();
  });

  it('bascule « late » si échéance dépassée et non accepté', () => {
    expect(effectiveDeliverableStatus('submitted', '2026-08-01', TODAY)).toBe('late');
    expect(effectiveDeliverableStatus('pending', '2027-01-01', TODAY)).toBe('pending');
    expect(effectiveDeliverableStatus('accepted', '2026-08-01', TODAY)).toBe('accepted');
  });

  it('transition invalide refusée', () => {
    expect(evaluateDeliverableTransition('accepted', 'submit')).toEqual({ ok: false, code: 'invalid_transition' });
    expect(evaluateDeliverableTransition('pending', 'submit')).toEqual({ ok: true, to: 'submitted' });
  });
});

describe('M7 — validations (§8)', () => {
  it('assurance : type valide, validTo ≥ validFrom', () => {
    expect(validateInsurance({ type: 'DO', validFrom: '2026-01-01', validTo: '2027-01-01' })).toEqual({});
    expect(validateInsurance({ type: 'DO', validFrom: '2026-06-01', validTo: '2026-01-01' })).toEqual({
      validTo: 'insurance.error.validTo',
    });
    expect(validateInsurance({}).type).toBe('insurance.error.type');
  });

  it('fee ≥ 0', () => {
    expect(isFeeValid(m('0'))).toBe(true);
    expect(isFeeValid(m('-1'))).toBe(false);
  });

  it('livrable sans échéance refusé', () => {
    expect(validateDeliverable({ label: 'APS', dueDate: null }).dueDate).toBe('deliverable.error.dueDate');
    expect(validateDeliverable({ label: 'APS', dueDate: '2026-09-01' })).toEqual({});
  });
});

describe('M7 — permissions (§2)', () => {
  it('assurances gérées par moa_director/amo ; finance en lecture', () => {
    expect(can('amo', 'insurance.manage')).toBe(true);
    expect(can('finance', 'insurance.manage')).toBe(false);
    expect(can('finance', 'insurance.read')).toBe(true);
  });

  it('décision actée par moa_director/amo ; RACI configuré par eux', () => {
    expect(can('moa_director', 'decision.record')).toBe(true);
    expect(can('procurement', 'decision.record')).toBe(false);
    expect(can('amo', 'raci.configure')).toBe(true);
  });

  it('annuaire géré par procurement ; lecture ouverte à tous', () => {
    expect(can('procurement', 'stk.manage')).toBe(true);
    expect(can('viewer', 'stk.manage')).toBe(false);
    expect(can('viewer', 'stk.read')).toBe(true);
  });
});
