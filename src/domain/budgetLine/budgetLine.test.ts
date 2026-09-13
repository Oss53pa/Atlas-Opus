import { describe, it, expect } from 'vitest';
import { syscohadaClass, totalBudget, budgetByClass, lineShare, remaining, isOverBudget } from './budgetLine';
import type { BudgetLine } from './types';

const XOF = 'XOF';
const l = (over: Partial<BudgetLine> = {}): BudgetLine => ({
  id: 'l', tenantId: 't', operationId: 'op', syscohadaAccount: '2313', label: 'Bâtiment', amountBac: 100_000_000, ...over,
});

describe('budgetLine — agrégation via Money', () => {
  it('syscohadaClass = 1er chiffre du compte', () => {
    expect(syscohadaClass('2313')).toBe('2');
    expect(syscohadaClass(' 605 ')).toBe('6');
    expect(syscohadaClass('')).toBe('?');
    expect(syscohadaClass('X99')).toBe('?');
  });

  it('totalBudget somme via Money (exact)', () => {
    const lines = [l({ amountBac: 100_000_000 }), l({ amountBac: 49_999_999 })];
    expect(totalBudget(lines, XOF).toMajorNumber()).toBe(149_999_999);
    expect(totalBudget([], XOF).toMajorNumber()).toBe(0);
  });

  it('budgetByClass regroupe par classe SYSCOHADA', () => {
    const lines = [
      l({ syscohadaAccount: '2313', amountBac: 100_000_000 }),
      l({ syscohadaAccount: '2841', amountBac: 20_000_000 }),
      l({ syscohadaAccount: '605', amountBac: 30_000_000 }),
    ];
    const byClass = budgetByClass(lines, XOF);
    expect(byClass['2'].toMajorNumber()).toBe(120_000_000);
    expect(byClass['6'].toMajorNumber()).toBe(30_000_000);
    expect(Object.keys(byClass).sort()).toEqual(['2', '6']);
  });

  it('lineShare = part du total (0 si total nul)', () => {
    const lines = [l({ amountBac: 75_000_000 }), l({ amountBac: 25_000_000 })];
    expect(lineShare(lines[0], lines, XOF)).toBeCloseTo(0.75);
    expect(lineShare(l({ amountBac: 0 }), [l({ amountBac: 0 })], XOF)).toBe(0);
  });

  it('remaining / isOverBudget', () => {
    expect(remaining(100_000_000, 40_000_000, XOF).toMajorNumber()).toBe(60_000_000);
    expect(remaining(100_000_000, 130_000_000, XOF).toMajorNumber()).toBe(-30_000_000);
    expect(isOverBudget(100_000_000, 130_000_000, XOF)).toBe(true);
    expect(isOverBudget(100_000_000, 100_000_000, XOF)).toBe(false); // à l'équilibre, pas dépassé
  });
});
