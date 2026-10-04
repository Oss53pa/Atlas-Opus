import { describe, expect, it } from 'vitest';
import {
  bySeverity, canTransitionNc, criticalOpenCount, evaluateNcTransition, isOverdue, openCount,
  overdueCount, receptionBlockedByNc, sortByPriority, traitementRate,
} from './nonConformity';
import type { NonConformity } from './types';

const nc = (over: Partial<NonConformity> = {}): NonConformity => ({
  id: 'n1', tenantId: 't', operationId: 'op', reference: 'NC-1', label: 'Enrobage insuffisant',
  source: 'chantier', severity: 'majeure', location: null, correctiveAction: null, owner: null,
  detectedAt: '2026-05-22', dueDate: null, closedAt: null, status: 'ouverte', ...over,
});

describe('M18 qualité — comptages', () => {
  it('compte comme ouvertes tout ce qui n’est pas soldé', () => {
    expect(openCount([nc(), nc({ status: 'en_traitement' }), nc({ status: 'soldee' })])).toBe(2);
  });

  it('ne compte comme critiques que les NC critiques ouvertes', () => {
    expect(criticalOpenCount([nc({ severity: 'critique' }), nc({ severity: 'critique', status: 'soldee' }), nc()])).toBe(1);
  });

  it('ne signale en retard que les NC ouvertes et échues', () => {
    expect(isOverdue(nc({ dueDate: '2026-05-30' }), '2026-06-15')).toBe(true);
    expect(isOverdue(nc({ dueDate: '2026-05-30', status: 'soldee' }), '2026-06-15')).toBe(false);
    expect(isOverdue(nc({ dueDate: null }), '2026-06-15')).toBe(false);
    expect(overdueCount([nc({ dueDate: '2026-05-30' }), nc({ dueDate: '2026-12-01' })], '2026-06-15')).toBe(1);
  });

  it('n’invente pas de taux de traitement sans non-conformité', () => {
    expect(traitementRate([])).toBeNull();
    expect(traitementRate([nc(), nc({ status: 'soldee' }), nc({ status: 'soldee' })])).toBeCloseTo(2 / 3, 6);
  });

  it('ventile les NC ouvertes par gravité', () => {
    expect(bySeverity([nc({ severity: 'critique' }), nc({ severity: 'mineure' }), nc({ severity: 'critique', status: 'soldee' })]))
      .toEqual({ mineure: 1, majeure: 0, critique: 1 });
  });

  it('priorise les ouvertes, puis la gravité, puis l’ancienneté', () => {
    const list = [
      nc({ id: 'soldee', severity: 'critique', status: 'soldee' }),
      nc({ id: 'mineure', severity: 'mineure', detectedAt: '2026-01-01' }),
      nc({ id: 'critique-recente', severity: 'critique', detectedAt: '2026-06-01' }),
      nc({ id: 'critique-ancienne', severity: 'critique', detectedAt: '2026-02-01' }),
    ];
    expect(sortByPriority(list).map((n) => n.id)).toEqual(['critique-ancienne', 'critique-recente', 'mineure', 'soldee']);
  });
});

describe('M18 qualité — machine à états', () => {
  it('autorise la marche avant et la réouverture', () => {
    expect(canTransitionNc('ouverte', 'en_traitement')).toBe(true);
    expect(canTransitionNc('soldee', 'en_traitement')).toBe(true);
    expect(canTransitionNc('en_traitement', 'ouverte')).toBe(false);
  });

  it('RG-NC-02 — refuse de solder sans action corrective', () => {
    expect(evaluateNcTransition('en_traitement', 'soldee', { correctiveAction: null }))
      .toEqual({ ok: false, code: 'corrective_action_required' });
    expect(evaluateNcTransition('en_traitement', 'soldee', { correctiveAction: '   ' }))
      .toEqual({ ok: false, code: 'corrective_action_required' });
    expect(evaluateNcTransition('en_traitement', 'soldee', { correctiveAction: 'Reprise par mortier' }))
      .toEqual({ ok: true, to: 'soldee' });
  });

  it('refuse une transition hors machine', () => {
    expect(evaluateNcTransition('soldee', 'ouverte', { correctiveAction: 'x' }))
      .toEqual({ ok: false, code: 'invalid_transition' });
  });

  it('RG-NC-01 — une NC critique ouverte bloque la réception', () => {
    expect(receptionBlockedByNc([nc({ severity: 'critique' })])).toBe(true);
    expect(receptionBlockedByNc([nc({ severity: 'critique', status: 'soldee' }), nc({ severity: 'majeure' })])).toBe(false);
  });
});
