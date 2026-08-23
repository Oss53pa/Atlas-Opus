import { describe, it, expect } from 'vitest';
import { riskScore, riskLevel, openRisksCount, controlledCount, criticalOpenCount, sortByCriticality } from './risks';
import type { Risk } from './types';

const r = (probability: number, impact: number, status: Risk['status'] = 'ouvert'): Pick<Risk, 'probability' | 'impact' | 'status'> => ({ probability, impact, status });

describe('M20 — criticité', () => {
  it('score = P × I', () => {
    expect(riskScore(4, 5)).toBe(20);
  });
  it('niveaux : faible / moyen / élevé / critique', () => {
    expect(riskLevel(4)).toBe('faible');
    expect(riskLevel(9)).toBe('moyen');
    expect(riskLevel(15)).toBe('eleve');
    expect(riskLevel(20)).toBe('critique');
  });
});

describe('M20 — compteurs & tri', () => {
  const list = [r(5, 5, 'ouvert'), r(2, 2, 'ouvert'), r(4, 4, 'maitrise'), r(1, 1, 'clos')];
  it('ouverts / maîtrisés / critiques ouverts', () => {
    expect(openRisksCount(list)).toBe(2);
    expect(controlledCount(list)).toBe(1);
    expect(criticalOpenCount(list)).toBe(1); // 25 ouvert
  });
  it('tri par criticité décroissante', () => {
    const sorted = sortByCriticality(list);
    expect(sorted.map((x) => riskScore(x.probability, x.impact))).toEqual([25, 16, 4, 1]);
  });
});
