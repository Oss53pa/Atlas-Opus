import { describe, it, expect } from 'vitest';
import {
  totalWeight, isWeightBalanced, weightByType, weightedScore, weightedTotal, normalizeWeights,
} from './evaluationCriterion';
import type { EvaluationCriterion } from './types';

const c = (over: Partial<EvaluationCriterion> = {}): EvaluationCriterion => ({
  id: 'c', tenantId: 't', operationId: 'op', contextId: null, label: 'Prix', type: 'financier', weight: 0.4, ...over,
});

describe('evaluationCriterion — pondération', () => {
  it('totalWeight / isWeightBalanced (100 % à 0,0001 près)', () => {
    const grid = [c({ weight: 0.6, type: 'technique' }), c({ weight: 0.4, type: 'financier' })];
    expect(totalWeight(grid)).toBeCloseTo(1);
    expect(isWeightBalanced(grid)).toBe(true);
    expect(isWeightBalanced([c({ weight: 0.6 }), c({ weight: 0.3 })])).toBe(false);
    expect(isWeightBalanced([])).toBe(false);
  });

  it('weightByType cumule par nature', () => {
    const grid = [c({ type: 'technique', weight: 0.5 }), c({ type: 'technique', weight: 0.1 }), c({ type: 'financier', weight: 0.4 })];
    const w = weightByType(grid);
    expect(w.technique).toBeCloseTo(0.6);
    expect(w.financier).toBeCloseTo(0.4);
    expect(w.administratif).toBe(0);
  });

  it('weightedScore / weightedTotal', () => {
    expect(weightedScore(80, 0.4)).toBeCloseTo(32);
    // offre : 90 pts sur technique (0.6) + 70 pts sur financier (0.4) = 54 + 28 = 82
    expect(weightedTotal([{ rawScore: 90, weight: 0.6 }, { rawScore: 70, weight: 0.4 }])).toBeCloseTo(82);
  });

  it('normalizeWeights ramène la somme à 1 sans muter', () => {
    const grid = [c({ weight: 3 }), c({ weight: 1 })];
    const norm = normalizeWeights(grid);
    expect(totalWeight(norm)).toBeCloseTo(1);
    expect(norm[0].weight).toBeCloseTo(0.75);
    expect(grid[0].weight).toBe(3); // pas de mutation
    expect(normalizeWeights([c({ weight: 0 })])[0].weight).toBe(0); // somme nulle : inchangé
  });
});
