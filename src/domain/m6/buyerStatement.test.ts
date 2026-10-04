import { describe, expect, it } from 'vitest';
import { Money } from '../money/Money';
import { buyerStatement } from './commercialisation';
import type { Receipt, ScheduleStage } from './types';

const X = 'XOF';
const prix = Money.of(45_000_000, X);
/** Échelonnement VEFA réglementaire : 35 % fondations, 70 % hors d'eau, 95 % achèvement, solde. */
const schedule: ScheduleStage[] = [
  { key: 'fondations', pct: 0.35 },
  { key: 'hors_eau', pct: 0.7 },
  { key: 'achevement', pct: 0.95 },
  { key: 'livraison', pct: 1 },
];
const receipt = (amount: number, status: Receipt['status']): Pick<Receipt, 'amount' | 'status'> => ({ amount: Money.of(amount, X), status });

describe('M6 — relevé acquéreur', () => {
  it('boucle les incréments sur le prix de vente', () => {
    const st = buyerStatement(prix, schedule, [], 0);
    expect(st.stages.map((s) => s.cumul.toMajorString()))
      .toEqual(['15750000.00', '31500000.00', '42750000.00', '45000000.00']);
    const total = st.stages.reduce((a, s) => a.add(s.increment), Money.zero(X));
    expect(total.toMajorString()).toBe('45000000.00');
  });

  it('n’appelle que les stades couverts par l’avancement validé', () => {
    const st = buyerStatement(prix, schedule, [], 0.5);
    expect(st.stages.map((s) => s.status)).toEqual(['appele', 'a_venir', 'a_venir', 'a_venir']);
    expect(st.appele.toMajorString()).toBe('15750000.00');
  });

  it('n’appelle rien avant le premier stade', () => {
    const st = buyerStatement(prix, schedule, [], 0.2);
    expect(st.appele.toMajorString()).toBe('0.00');
    expect(st.stages.every((s) => s.status === 'a_venir')).toBe(true);
  });

  it('ne compte que les encaissements réglés et calcule le reste dû', () => {
    const st = buyerStatement(prix, schedule, [receipt(10_000_000, 'settled'), receipt(5_000_000, 'pending')], 0.75);
    expect(st.appele.toMajorString()).toBe('31500000.00');
    expect(st.encaisse.toMajorString()).toBe('10000000.00');
    expect(st.reste.toMajorString()).toBe('21500000.00');
    expect(st.soldeContractuel.toMajorString()).toBe('35000000.00');
  });

  it('solde tout à la livraison une fois le chantier achevé et payé', () => {
    const st = buyerStatement(prix, schedule, [receipt(45_000_000, 'settled')], 1);
    expect(st.appele.toMajorString()).toBe('45000000.00');
    expect(st.reste.toMajorString()).toBe('0.00');
    expect(st.soldeContractuel.isZero()).toBe(true);
  });
});
