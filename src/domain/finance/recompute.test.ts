import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import { recomputeBilan, bilanRecomputeToReportData, type BilanRecomputeInput } from './recompute';
import type { BilanLine } from './bilan';

const XOF = 'XOF';
const lines: BilanLine[] = [
  { kind: 'cost', amount: Money.of(100_000_000, XOF) },
  { kind: 'cost', amount: Money.of(50_000_000, XOF) },
  { kind: 'revenue', amount: Money.of(300_000_000, XOF) },
];

const input = (over: Partial<BilanRecomputeInput> = {}): BilanRecomputeInput => ({
  currency: XOF,
  lines,
  recettesRealisees: Money.of(80_000_000, XOF),
  cashflow: [-150_000_000, 60_000_000, 60_000_000, 90_000_000],
  bac: Money.of(150_000_000, XOF),
  computedAt: '2026-09-03T00:00:00.000Z',
  ...over,
});

describe('M4 — recalcul du bilan (moteur déterministe)', () => {
  it('coût / recettes / marge / taux exacts (Money.ts)', () => {
    const r = recomputeBilan(input());
    expect(r.summary.coutTotal.toMajorNumber()).toBe(150_000_000);
    expect(r.summary.recettes.toMajorNumber()).toBe(300_000_000);
    expect(r.summary.recettesRealisees.toMajorNumber()).toBe(80_000_000);
    expect(r.summary.marge.toMajorNumber()).toBe(150_000_000); // 300M − 150M
    expect(r.summary.tauxMarge).toBe(1); // 150M / 150M
  });

  it('besoin de trésorerie = point bas du cumulé (négatif ⇒ financement)', () => {
    const r = recomputeBilan(input());
    // cumulé : -150M, -90M, -30M, +60M → point bas -150M à l'index 0.
    expect(r.besoinTresorerie).toBe(-150_000_000);
    expect(r.pointBasIndex).toBe(0);
  });

  it('TRI défini quand les flux changent de signe, null sinon', () => {
    const r = recomputeBilan(input());
    expect(r.tri).not.toBeNull();
    expect(r.tri!).toBeGreaterThan(0);
    const flat = recomputeBilan(input({ cashflow: [] }));
    expect(flat.tri).toBeNull();
    expect(flat.besoinTresorerie).toBe(0);
    expect(flat.pointBasIndex).toBe(-1);
  });

  it('déterministe : deux recalculs identiques donnent le même résultat', () => {
    expect(recomputeBilan(input())).toEqual(recomputeBilan(input()));
  });

  it('pont M21 : fige les indicateurs financiers en unités majeures', () => {
    const r = recomputeBilan(input());
    const data = bilanRecomputeToReportData(r, { progress: 0.42, alertsDanger: 1, alertsEcheance: 2 });
    expect(data).toMatchObject({
      coutTotal: 150_000_000, recettes: 300_000_000, recettesRealisees: 80_000_000,
      marge: 150_000_000, tauxMarge: 1, progress: 0.42, alertsDanger: 1, alertsEcheance: 2,
    });
    expect(data.tri).toBe(r.tri);
  });
});
