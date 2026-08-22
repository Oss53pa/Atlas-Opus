import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import {
  canTransitionFinancing,
  evaluateDrawdown,
  deblocageAutorise,
  interetsIntercalairesJours,
  fraisFinanciersFromDrawdowns,
  sommeTranchesValide,
} from './financing';
import type { DrawdownStatus } from './types';

const XOF = 'XOF';
const m = (v: string) => Money.of(v, XOF);

describe('M5 — machine financing (§4)', () => {
  it('négocié → accordé → en_cours → soldé', () => {
    expect(canTransitionFinancing('negocie', 'accorde')).toBe(true);
    expect(canTransitionFinancing('accorde', 'en_cours')).toBe(true);
    expect(canTransitionFinancing('en_cours', 'solde')).toBe(true);
    expect(canTransitionFinancing('negocie', 'en_cours')).toBe(false);
  });
});

describe('M5 — déblocage conditionné à l’avancement (RG-M5-01)', () => {
  it('deblocageAutorise : avancement ≥ condition', () => {
    expect(deblocageAutorise(0.3, 0.3)).toBe(true);
    expect(deblocageAutorise(0.25, 0.3)).toBe(false);
  });

  it('scénario spec : tranche 30 %, avancement 25 % → refusé', () => {
    const d = evaluateDrawdown('demande', 'debloque', { validatedProgress: 0.25, condition: 0.3 });
    expect(d).toEqual({ ok: false, code: 'progress_insufficient' });
  });

  it('avancement suffisant → débloqué', () => {
    expect(evaluateDrawdown('demande', 'debloque', { validatedProgress: 0.35, condition: 0.3 })).toEqual({
      ok: true,
      to: 'debloque',
    });
  });

  it('transition illégale refusée', () => {
    expect(evaluateDrawdown('planifie', 'debloque', { validatedProgress: 1, condition: 0 })).toEqual({
      ok: false,
      code: 'invalid_transition',
    });
    expect(evaluateDrawdown('demande', 'refuse', { validatedProgress: 0, condition: 0.5 })).toEqual({
      ok: true,
      to: 'refuse',
    });
  });
});

describe('M5 — intérêts intercalaires (§5)', () => {
  it('capital × taux × jours/360', () => {
    // 100 000 000 × 9 % × 360/360 = 9 000 000
    expect(interetsIntercalairesJours(m('100000000'), 0.09, 360).equals(m('9000000'))).toBe(true);
    // sur 180 jours → moitié
    expect(interetsIntercalairesJours(m('100000000'), 0.09, 180).equals(m('4500000'))).toBe(true);
  });
});

describe('M5 — frais financiers → M4 (RG-M5-02)', () => {
  const dd = (amount: string, rate: number, date: string | null, status: DrawdownStatus) => ({
    amount: m(amount), rate, date, status,
  });

  it('somme les intérêts des tranches débloquées, courus jusqu’à asOf', () => {
    const asOf = '2027-01-01';
    const days = (a: string) => Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(a)) / 86_400_000));
    const items = [
      dd('100000000', 0.09, '2026-01-01', 'debloque'),
      dd('50000000', 0.12, '2026-07-01', 'debloque'),
      dd('30000000', 0.1, null, 'demande'), // non débloqué → ignoré
    ];
    const total = fraisFinanciersFromDrawdowns(items, asOf, XOF);
    const expected = interetsIntercalairesJours(m('100000000'), 0.09, days('2026-01-01'))
      .add(interetsIntercalairesJours(m('50000000'), 0.12, days('2026-07-01')));
    expect(total.equals(expected)).toBe(true);
    expect(total.gt(m('12000000'))).toBe(true); // ordre de grandeur : ~12M
  });

  it('aucune tranche débloquée → zéro', () => {
    expect(fraisFinanciersFromDrawdowns([dd('1', 0.1, null, 'planifie')], '2027-01-01', XOF).isZero()).toBe(true);
  });
});

describe('M5 — validations (§8)', () => {
  it('somme des tranches ≤ montant accordé', () => {
    expect(sommeTranchesValide([m('400000000'), m('300000000')], m('800000000'), XOF)).toBe(true);
    expect(sommeTranchesValide([m('500000000'), m('400000000')], m('800000000'), XOF)).toBe(false);
  });
});
