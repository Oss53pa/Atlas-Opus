import { describe, it, expect } from 'vitest';
import {
  isOpen, openCount, criticalOpenCount, daysSinceLastAccident, canTransitionHsse, sortByPriority,
} from './hsse';
import type { HsseIncident } from './types';

const inc = (over: Partial<HsseIncident> = {}): HsseIncident => ({
  id: 'i1', tenantId: 't', operationId: 'op', reference: 'HSSE-1', kind: 'accident',
  severity: 'mineure', occurredAt: '2026-09-01', location: null, description: 'x',
  correctiveAction: null, status: 'declare', ...over,
});

describe('HSSE — ouverture & comptages', () => {
  it('isOpen / openCount', () => {
    expect(isOpen(inc({ status: 'clos' }))).toBe(false);
    expect(openCount([inc(), inc({ status: 'en_analyse' }), inc({ status: 'clos' })])).toBe(2);
  });
  it('criticalOpenCount ne compte que critique ET ouvert', () => {
    expect(criticalOpenCount([
      inc({ severity: 'critique' }),
      inc({ severity: 'critique', status: 'clos' }),
      inc({ severity: 'grave' }),
    ])).toBe(1);
  });
});

describe('HSSE — jours sans accident', () => {
  it('null si aucun accident', () => {
    expect(daysSinceLastAccident([inc({ kind: 'environnement' })], '2026-09-10T00:00:00.000Z')).toBeNull();
  });
  it('compte depuis le dernier accident, borné à 0', () => {
    const list = [inc({ kind: 'accident', occurredAt: '2026-09-01' }), inc({ kind: 'accident', occurredAt: '2026-09-08' })];
    expect(daysSinceLastAccident(list, '2026-09-10T00:00:00.000Z')).toBe(2);
    expect(daysSinceLastAccident([inc({ occurredAt: '2026-12-01' })], '2026-09-10T00:00:00.000Z')).toBe(0);
  });
});

describe('HSSE — transitions', () => {
  it('marche avant + réouverture depuis clos', () => {
    expect(canTransitionHsse('declare', 'en_analyse')).toBe(true);
    expect(canTransitionHsse('en_analyse', 'clos')).toBe(true);
    expect(canTransitionHsse('clos', 'en_analyse')).toBe(true);
    expect(canTransitionHsse('declare', 'clos')).toBe(false);
  });
});

describe('HSSE — tri par priorité', () => {
  it('gravité décroissante puis date décroissante', () => {
    const out = sortByPriority([
      inc({ id: 'a', severity: 'mineure', occurredAt: '2026-09-05' }),
      inc({ id: 'b', severity: 'critique', occurredAt: '2026-09-01' }),
      inc({ id: 'c', severity: 'critique', occurredAt: '2026-09-03' }),
    ]);
    expect(out.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });
});
