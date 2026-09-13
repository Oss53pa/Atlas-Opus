import { describe, it, expect } from 'vitest';
import {
  severityRank, isHighSeverity, openHighCount, mitigatedRate,
  countByMilieu, sortByPriority, canTransitionEies, nextStatuses,
} from './eiesItem';
import type { EiesItem } from './types';

const e = (over: Partial<EiesItem> = {}): EiesItem => ({
  id: 'e', tenantId: 't', operationId: 'op', impact: 'Poussières', milieu: 'physique',
  severity: 'moyenne', mesureAttenuation: null, status: 'planifiee', ...over,
});

describe('eiesItem — gravité & atténuation', () => {
  it('severityRank ordonne faible < critique', () => {
    expect(severityRank('faible')).toBe(0);
    expect(severityRank('critique')).toBe(3);
    expect(severityRank('forte')).toBeGreaterThan(severityRank('moyenne'));
  });

  it('isHighSeverity / openHighCount', () => {
    expect(isHighSeverity(e({ severity: 'forte' }))).toBe(true);
    expect(isHighSeverity(e({ severity: 'moyenne' }))).toBe(false);
    const list = [e({ severity: 'critique' }), e({ severity: 'forte', status: 'soldee' }), e({ severity: 'faible' })];
    expect(openHighCount(list)).toBe(1); // critique non soldée ; forte soldée exclue
  });

  it('mitigatedRate = soldées / total', () => {
    expect(mitigatedRate([])).toBe(0);
    expect(mitigatedRate([e({ status: 'soldee' }), e({ status: 'en_cours' })])).toBe(0.5);
  });

  it('countByMilieu répartit', () => {
    const c = countByMilieu([e({ milieu: 'humain' }), e({ milieu: 'humain' }), e({ milieu: 'biologique' })]);
    expect(c.humain).toBe(2);
    expect(c.biologique).toBe(1);
    expect(c.socio_economique).toBe(0);
  });

  it('sortByPriority : gravité décroissante puis non soldées', () => {
    const list = [
      e({ id: 'a', severity: 'faible' }),
      e({ id: 'b', severity: 'critique', status: 'soldee' }),
      e({ id: 'c', severity: 'critique', status: 'en_cours' }),
    ];
    expect(sortByPriority(list).map((x) => x.id)).toEqual(['c', 'b', 'a']); // critiques d'abord, non soldée avant soldée
    expect(list[0].id).toBe('a'); // pas de mutation
  });
});

describe('eiesItem — machine à états', () => {
  it('transitions autorisées / interdites', () => {
    expect(canTransitionEies('planifiee', 'en_cours')).toBe(true);
    expect(canTransitionEies('en_cours', 'mise_en_oeuvre')).toBe(true);
    expect(canTransitionEies('planifiee', 'mise_en_oeuvre')).toBe(false); // pas de saut
    expect(canTransitionEies('soldee', 'en_cours')).toBe(false); // terminal
  });
  it('nextStatuses', () => {
    expect(nextStatuses('planifiee')).toEqual(['en_cours', 'soldee']);
    expect(nextStatuses('soldee')).toEqual([]);
  });
});
