import { describe, it, expect } from 'vitest';
import {
  isOpen, openCount, isOverdue, overdueCount, completionRate, sortByPriority,
  canTransitionPges, nextStatuses,
} from './pgesAction';
import type { PgesAction } from './types';

const TODAY = '2026-09-15';

const a = (over: Partial<PgesAction> = {}): PgesAction => ({
  id: 'a', tenantId: 't', operationId: 'op', action: 'Arrosage des pistes', responsable: 'HSE',
  echeance: '2026-09-30', indicateur: 'Fréquence arrosage', status: 'ouvert', ...over,
});

describe('pgesAction — avancement & retard', () => {
  it('isOpen / openCount : soldée exclue', () => {
    expect(isOpen(a({ status: 'ouvert' }))).toBe(true);
    expect(isOpen(a({ status: 'en_cours' }))).toBe(true);
    expect(isOpen(a({ status: 'soldee' }))).toBe(false);
    expect(openCount([a(), a({ status: 'en_cours' }), a({ status: 'soldee' })])).toBe(2);
  });

  it('isOverdue : échéance dépassée, ouverte ; jamais si échéance nulle', () => {
    expect(isOverdue(a({ echeance: '2026-09-01' }), TODAY)).toBe(true);
    expect(isOverdue(a({ echeance: '2026-09-01', status: 'soldee' }), TODAY)).toBe(false);
    expect(isOverdue(a({ echeance: null }), TODAY)).toBe(false);
    expect(overdueCount([a({ echeance: '2026-09-01' }), a({ echeance: null }), a()], TODAY)).toBe(1);
  });

  it('completionRate = soldées / total', () => {
    expect(completionRate([])).toBe(0);
    expect(completionRate([a({ status: 'soldee' }), a({ status: 'ouvert' })])).toBe(0.5);
  });

  it('sortByPriority : retard, ouvertes par échéance, soldées en dernier', () => {
    const list = [
      a({ id: 'done', status: 'soldee', echeance: '2026-01-01' }),
      a({ id: 'noecheance', echeance: null }),
      a({ id: 'late', echeance: '2026-08-01' }),
      a({ id: 'soon', echeance: '2026-09-20' }),
    ];
    expect(sortByPriority(list, TODAY).map((x) => x.id)).toEqual(['late', 'soon', 'noecheance', 'done']);
    expect(list[0].id).toBe('done'); // pas de mutation
  });
});

describe('pgesAction — machine à états', () => {
  it('transitions autorisées / interdites', () => {
    expect(canTransitionPges('ouvert', 'en_cours')).toBe(true);
    expect(canTransitionPges('ouvert', 'soldee')).toBe(true);
    expect(canTransitionPges('en_cours', 'soldee')).toBe(true);
    expect(canTransitionPges('soldee', 'ouvert')).toBe(false);
  });
  it('nextStatuses', () => {
    expect(nextStatuses('ouvert')).toEqual(['en_cours', 'soldee']);
    expect(nextStatuses('soldee')).toEqual([]);
  });
});
