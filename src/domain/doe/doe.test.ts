import { describe, it, expect } from 'vitest';
import { validatedCount, coveredCategories, completeness, missingCategories, isComplete } from './doe';
import { DOE_CATEGORIES, type DoeDocument } from './types';

const d = (over: Partial<DoeDocument> = {}): DoeDocument => ({
  id: 'x', tenantId: 't', operationId: 'op', category: 'plans_recolement', fileRef: null, validated: false, ...over,
});

describe('DOE — complétude', () => {
  it('validatedCount / coveredCategories : seuls les validés comptent', () => {
    const list = [d({ category: 'plans_recolement', validated: true }), d({ category: 'plans_recolement', validated: true }), d({ category: 'garanties' })];
    expect(validatedCount(list)).toBe(2);
    expect([...coveredCategories(list)]).toEqual(['plans_recolement']); // garanties non validé
  });
  it('completeness = catégories couvertes / total', () => {
    const one = [d({ category: 'plans_recolement', validated: true })];
    expect(completeness(one)).toBeCloseTo(1 / DOE_CATEGORIES.length);
    const full = DOE_CATEGORIES.map((c) => d({ category: c, validated: true }));
    expect(completeness(full)).toBe(1);
    expect(isComplete(full)).toBe(true);
  });
  it('missingCategories liste ce qui reste à valider', () => {
    const list = [d({ category: 'plans_recolement', validated: true })];
    expect(missingCategories(list)).not.toContain('plans_recolement');
    expect(missingCategories(list)).toContain('garanties');
    expect(isComplete(list)).toBe(false);
  });
});
