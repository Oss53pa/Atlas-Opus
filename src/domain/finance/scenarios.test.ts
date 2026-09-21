import { describe, expect, it } from 'vitest';
import { Money } from '../money/Money';
import { applyScenario, pointMort, SCENARIO_PRESETS, sensitivity } from './scenarios';

const X = 'XOF';
const base = { recettes: Money.of(3_000_000_000, X), coutTotal: Money.of(2_500_000_000, X) };

describe('M4 — scénarios & sensibilité', () => {
  it('applique les deltas recettes et coûts', () => {
    const r = applyScenario(base, { revenueDelta: -0.1, costDelta: 0.05, delayMonths: 6 });
    expect(r.recettes.toMajorString()).toBe('2700000000.00');
    expect(r.coutTotal.toMajorString()).toBe('2625000000.00');
    expect(r.marge.toMajorString()).toBe('75000000.00');
    expect(r.delayMonths).toBe(6);
  });

  it('laisse le bilan inchangé sur le scénario probable', () => {
    const r = applyScenario(base, SCENARIO_PRESETS.probable);
    expect(r.marge.toMajorString()).toBe('500000000.00');
    expect(r.tauxMarge).toBeCloseTo(0.2, 6);
  });

  it('ordonne les préréglages du plus au moins favorable', () => {
    const m = (k: keyof typeof SCENARIO_PRESETS) => applyScenario(base, SCENARIO_PRESETS[k]).marge.toMajorNumber();
    expect(m('optimiste')).toBeGreaterThan(m('probable'));
    expect(m('probable')).toBeGreaterThan(m('pessimiste'));
    expect(m('pessimiste')).toBeGreaterThan(m('stress'));
  });

  it('fait varier un seul axe', () => {
    const rows = sensitivity(base, 'cost', [0, 0.1, 0.2]);
    expect(rows.map((r) => r.marge.toMajorString())).toEqual(['500000000.00', '250000000.00', '0.00']);
  });

  it('trouve le point mort sur les coûts et sur les recettes', () => {
    expect(pointMort(base, 'cost')).toBeCloseTo(0.2, 3);
    expect(pointMort(base, 'revenue')).toBeCloseTo(-0.167, 3);
  });

  it('renvoie null hors intervalle ou pour une marge déjà nulle', () => {
    expect(pointMort({ recettes: Money.of(10_000, X), coutTotal: Money.zero(X) }, 'cost')).toBeNull();
    expect(pointMort({ recettes: Money.of(100, X), coutTotal: Money.of(100, X) }, 'cost')).toBeNull();
  });
});
