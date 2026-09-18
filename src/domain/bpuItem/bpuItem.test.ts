import { describe, it, expect } from 'vitest';
import { lineAmount, catalogTotal, estimateTotal, duplicateCodes, hasUniqueCodes } from './bpuItem';
import type { BpuItem } from './types';

const XOF = 'XOF';
const i = (over: Partial<BpuItem> = {}): BpuItem => ({
  id: 'i', tenantId: 't', contractId: 'c', code: '01.01', label: 'Béton', unit: 'm3', unitPrice: 95_000, ...over,
});

describe('bpuItem — détail estimatif (Money)', () => {
  it('lineAmount = prix unitaire × quantité (entière et fractionnaire)', () => {
    expect(lineAmount(95_000, 12, XOF).toMajorNumber()).toBe(1_140_000);
    expect(lineAmount(95_000, 12.5, XOF).toMajorNumber()).toBe(1_187_500);
    expect(lineAmount(95_000, 0, XOF).toMajorNumber()).toBe(0);
  });

  it('catalogTotal somme les prix unitaires via Money', () => {
    expect(catalogTotal([i({ unitPrice: 95_000 }), i({ unitPrice: 5_500 })], XOF).toMajorNumber()).toBe(100_500);
    expect(catalogTotal([], XOF).toMajorNumber()).toBe(0);
  });

  it('estimateTotal croise lignes × quantités (absente ⇒ 0)', () => {
    const items = [i({ id: 'a', unitPrice: 95_000 }), i({ id: 'b', unitPrice: 12_000 })];
    // a : 10 × 95000 = 950000 ; b : absent ⇒ 0
    expect(estimateTotal(items, { a: 10 }, XOF).toMajorNumber()).toBe(950_000);
    // a : 2, b : 3.5 → 190000 + 42000 = 232000
    expect(estimateTotal(items, { a: 2, b: 3.5 }, XOF).toMajorNumber()).toBe(232_000);
    expect(estimateTotal(items, {}, XOF).toMajorNumber()).toBe(0);
  });

  it('duplicateCodes / hasUniqueCodes', () => {
    const ok = [i({ code: '01.01' }), i({ code: '01.02' })];
    expect(duplicateCodes(ok)).toEqual([]);
    expect(hasUniqueCodes(ok)).toBe(true);
    const dup = [i({ code: '01.01' }), i({ code: ' 01.01 ' }), i({ code: '02' })];
    expect(duplicateCodes(dup)).toEqual(['01.01']); // trim pris en compte
    expect(hasUniqueCodes(dup)).toBe(false);
  });
});
