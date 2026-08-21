import { describe, it, expect } from 'vitest';
import {
  evaluateTransition,
  nextPhase,
  isBackward,
  type TransitionContext,
} from './stateMachine';
import { can, canProposeTransition, canCommitTransition } from './permissions';
import {
  isNameUnique,
  endDateValid,
  canChangeCurrency,
  canChangeType,
  buildNewOperation,
  isReadOnlyForRole,
} from './rules';
import { validateOperationInput, validateOperationPatch } from './validation';
import { getCountry } from '../country';

const fullCtx = (over: Partial<TransitionContext> = {}): TransitionContext => ({
  validatedProgramItems: 0,
  bilanInitialized: false,
  marketsToLaunch: 0,
  marketsNotified: 0,
  globalProgress: 0,
  receptionDeclaredByDirector: false,
  receptionPvIssued: false,
  majorReservesLifted: false,
  finalBilanValidated: false,
  ...over,
});

describe('Machine à états §4', () => {
  it('amont → conception bloquée tant que programme non validé + bilan non initialisé (RG-M1-08)', () => {
    const d = evaluateTransition('amont', 'conception', fullCtx(), { role: 'moa_director' });
    expect(d.ok).toBe(false);
    if (!d.ok && d.code === 'guard_unmet') {
      expect(d.missing).toContain('op.transition.cond.programValidated');
      expect(d.missing).toContain('op.transition.cond.bilanInitialized');
    } else {
      throw new Error('attendu guard_unmet');
    }
  });

  it('amont → conception passe quand les gardes sont satisfaites', () => {
    const d = evaluateTransition('amont', 'conception', fullCtx({ validatedProgramItems: 1, bilanInitialized: true }), {
      role: 'moa_director',
    });
    expect(d.ok).toBe(true);
  });

  it('refuse une transition qui saute une phase (§9)', () => {
    const d = evaluateTransition('amont', 'passation', fullCtx({ validatedProgramItems: 1, bilanInitialized: true }), {
      role: 'owner',
    });
    expect(d).toEqual({ ok: false, code: 'invalid_transition' });
  });

  it('retour arrière : exige moa_director (RG-M1-10)', () => {
    expect(isBackward('realisation', 'amont')).toBe(true);
    const d = evaluateTransition('realisation', 'amont', fullCtx(), { role: 'site', justification: 'erreur' });
    expect(d).toEqual({ ok: false, code: 'needs_director' });
  });

  it('retour arrière : exige une justification (RG-M1-10)', () => {
    const d = evaluateTransition('realisation', 'conception', fullCtx(), { role: 'moa_director' });
    expect(d).toEqual({ ok: false, code: 'needs_justification' });
  });

  it('retour arrière : OK avec rôle + justification', () => {
    const d = evaluateTransition('realisation', 'conception', fullCtx(), {
      role: 'moa_director',
      justification: 'reprise conception',
    });
    expect(d.ok).toBe(true);
  });

  it('AMO : transition proposée si la config tenant exige confirmation (RG-M1-09)', () => {
    const d = evaluateTransition('conception', 'passation', fullCtx({ marketsToLaunch: 1 }), {
      role: 'amo',
      tenantRequiresDirectorConfirm: true,
    });
    expect(d).toEqual({ ok: true, proposed: true });
  });

  it('chaîne de phases : nextPhase suit l’ordre', () => {
    expect(nextPhase('amont')).toBe('conception');
    expect(nextPhase('exploitation')).toBe('cloture');
    expect(nextPhase('cloture')).toBeNull();
  });
});

describe('Permissions §2', () => {
  it('création réservée à owner / moa_director', () => {
    expect(can('moa_director', 'op.create')).toBe(true);
    expect(can('owner', 'op.create')).toBe(true);
    expect(can('viewer', 'op.create')).toBe(false);
    expect(can('finance', 'op.create')).toBe(false);
  });
  it('lecture ouverte à tous les rôles', () => {
    expect(can('viewer', 'op.read')).toBe(true);
    expect(can('stakeholder', 'op.read')).toBe(true);
  });
  it('AMO propose mais ne valide pas une transition (T*)', () => {
    expect(canProposeTransition('amo')).toBe(true);
    expect(canCommitTransition('amo')).toBe(false);
    expect(canCommitTransition('moa_director')).toBe(true);
  });
});

describe('Règles §5', () => {
  it('RG-M1-02 unicité du nom insensible à la casse', () => {
    expect(isNameUnique('Cosmos', ['cosmos', 'Autre'])).toBe(false);
    expect(isNameUnique('  COSMOS  ', ['Cosmos'])).toBe(false);
    expect(isNameUnique('Nouveau', ['Cosmos'])).toBe(true);
  });
  it('RG-M1-05 end_date ≥ start_date', () => {
    expect(endDateValid('2026-01-01', '2026-02-01')).toBe(true);
    expect(endDateValid('2026-03-01', '2026-02-01')).toBe(false);
    expect(endDateValid(null, '2026-02-01')).toBe(true);
  });
  it('RG-M1-06 devise verrouillée si coûts/marchés', () => {
    expect(canChangeCurrency({ hasBilanLines: false, hasContracts: false })).toBe(true);
    expect(canChangeCurrency({ hasBilanLines: true, hasContracts: false })).toBe(false);
  });
  it('RG-M1-07 changement de type seulement en amont', () => {
    expect(canChangeType({ phase: 'amont' })).toBe(true);
    expect(canChangeType({ phase: 'realisation' })).toBe(false);
  });
  it('RG-M1-01/03/04 buildNewOperation force amont/active et hérite du pays', () => {
    const op = buildNewOperation(
      { name: '  Cosmos X ', countryCode: 'CI', opType: 'commercial' },
      getCountry('CI')!,
      { id: 'x', tenantId: 't', now: '2026-06-10T00:00:00.000Z' },
    );
    expect(op.phase).toBe('amont');
    expect(op.status).toBe('active');
    expect(op.currency).toBe('XOF');
    expect(op.retentionRate).toBe(0.05);
    expect(op.name).toBe('Cosmos X');
  });
  it('RG-M1-12 opération close en lecture seule pour les autres rôles', () => {
    expect(isReadOnlyForRole({ status: 'closed' }, 'finance')).toBe(true);
    expect(isReadOnlyForRole({ status: 'closed' }, 'moa_director')).toBe(false);
    expect(isReadOnlyForRole({ status: 'active' }, 'finance')).toBe(false);
  });
});

describe('Validations §8', () => {
  it('signale nom/pays/type manquants', () => {
    const e = validateOperationInput({ name: 'ab', countryCode: '', opType: undefined }, { existingNames: [] });
    expect(e.name).toBe('operation.error.name');
    expect(e.countryCode).toBe('operation.error.country');
    expect(e.opType).toBe('operation.error.opType');
  });
  it('accepte une saisie valide', () => {
    const e = validateOperationInput(
      { name: 'Résidence Test', countryCode: 'CI', opType: 'residential', startDate: '2026-01-01', endDate: '2026-06-01' },
      { existingNames: ['Autre'] },
    );
    expect(Object.keys(e)).toHaveLength(0);
  });
  it('RG-M1-06 verrou devise au patch', () => {
    const e = validateOperationPatch(
      { currency: 'XAF' },
      { existingNames: [], changingCurrency: true, costFlags: { hasBilanLines: true, hasContracts: false } },
    );
    expect(e.currency).toBe('operation.error.currency');
  });
});
