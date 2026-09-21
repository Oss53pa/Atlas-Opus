import { describe, expect, it } from 'vitest';
import { Money } from '../money/Money';
import { coutCredit, echeanceMensuelle, planFinancement, serviceDetteMensuel } from './financing';
import type { Financing } from './types';

const X = 'XOF';
const fin = (over: Partial<Financing> = {}): Financing => ({
  id: 'f', tenantId: 't', operationId: 'op', source: 'credit_promoteur',
  amount: Money.of(1_000_000_000, X), rate: 0.09, status: 'accorde',
  durationMonths: 60, repayment: 'amortissable', ...over,
});

describe('M5 — remboursement & plan de financement', () => {
  it('calcule l’échéance constante d’un prêt amortissable', () => {
    // 1 Md à 9 % sur 60 mois → 20 758 355 XOF / mois (au XOF près)
    expect(Math.round(echeanceMensuelle(fin())!.toMajorNumber())).toBe(20_758_355);
  });

  it('ne fait payer que les intérêts sur un crédit in fine', () => {
    expect(echeanceMensuelle(fin({ repayment: 'in_fine', rate: 0.12 }))!.toMajorString()).toBe('10000000.00');
  });

  it('amortit linéairement à taux nul', () => {
    expect(echeanceMensuelle(fin({ amount: Money.of(1_200_000, X), rate: 0, durationMonths: 12 }))!.toMajorString()).toBe('100000.00');
  });

  it('n’invente pas d’échéance sans durée ni pour des fonds propres', () => {
    expect(echeanceMensuelle(fin({ durationMonths: null }))).toBeNull();
    expect(echeanceMensuelle(fin({ source: 'fonds_propres' }))).toBeNull();
  });

  it('distingue le coût du crédit amortissable et in fine', () => {
    expect(Math.round(coutCredit(fin())!.toMajorNumber())).toBe(245_501_300);
    expect(coutCredit(fin({ repayment: 'in_fine' }))!.toMajorString()).toBe('450000000.00');
    expect(coutCredit(fin({ durationMonths: null }))).toBeNull();
  });

  it('confronte le besoin aux seules ressources acquises', () => {
    const p = planFinancement(Money.of(2_500_000_000, X), [
      fin({ amount: Money.of(1_500_000_000, X) }),
      fin({ id: 'fp', source: 'fonds_propres', amount: Money.of(700_000_000, X), rate: 0 }),
      fin({ id: 'n', status: 'negocie', amount: Money.of(400_000_000, X) }),
    ]);
    expect(p.ressources.toMajorString()).toBe('2200000000.00');
    expect(p.enNegociation.toMajorString()).toBe('400000000.00');
    expect(p.ecart.toMajorString()).toBe('-300000000.00');
    expect(p.couverture).toBeCloseTo(0.88, 6);
    expect(p.levier).toBeCloseTo(1_500 / 2_200, 6);
  });

  it('agrège le service de la dette des financements acquis', () => {
    const s = serviceDetteMensuel([
      fin(),
      fin({ id: 'b', repayment: 'in_fine', amount: Money.of(600_000_000, X), rate: 0.12 }),
      fin({ id: 'n', status: 'negocie' }),
    ], X);
    expect(Math.round(s.toMajorNumber())).toBe(20_758_355 + 6_000_000);
  });
});
