import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import {
  canTransitionUnit,
  evaluateUnitTransition,
  vefaStagesInBreach,
  vefaScheduleValid,
  buildVefaSchedule,
  appelDeFondsAutorise,
  recettesEncaissees,
} from './commercialisation';
import type { Receipt, ScheduleStage } from './types';

const XOF = 'XOF';
const m = (v: string) => Money.of(v, XOF);

const PLAFONDS = { reservation: 0.05, fondations: 0.35, hors_eau: 0.7, livraison: 1.0 };

describe('M6 — machine unit (§4)', () => {
  it('disponible → optionné → réservé → vendu', () => {
    expect(canTransitionUnit('disponible', 'optionne')).toBe(true);
    expect(canTransitionUnit('optionne', 'reserve')).toBe(true);
    expect(canTransitionUnit('reserve', 'vendu')).toBe(true);
    expect(canTransitionUnit('disponible', 'vendu')).toBe(false);
  });

  it('RG-M6-03 — « vendu » exige une réservation active', () => {
    expect(evaluateUnitTransition('reserve', 'vendu', { hasActiveReservation: false })).toEqual({
      ok: false,
      code: 'reservation_required',
    });
    expect(evaluateUnitTransition('reserve', 'vendu', { hasActiveReservation: true })).toEqual({
      ok: true,
      to: 'vendu',
    });
  });

  it('transition illégale refusée', () => {
    expect(evaluateUnitTransition('vendu', 'disponible', { hasActiveReservation: true })).toEqual({
      ok: false,
      code: 'invalid_transition',
    });
  });
});

describe('M6 — échéancier VEFA plafonné (RG-M6-01)', () => {
  it('scénario spec : appel 40 % à un stade plafonné 35 % → en dépassement', () => {
    const schedule: ScheduleStage[] = [{ key: 'fondations', pct: 0.4 }];
    expect(vefaStagesInBreach(schedule, PLAFONDS)).toEqual(['fondations']);
    expect(vefaScheduleValid(schedule, PLAFONDS)).toBe(false);
  });

  it('échéancier conforme aux plafonds → valide', () => {
    const schedule: ScheduleStage[] = [
      { key: 'reservation', pct: 0.05 },
      { key: 'fondations', pct: 0.35 },
      { key: 'hors_eau', pct: 0.7 },
      { key: 'livraison', pct: 1.0 },
    ];
    expect(vefaScheduleValid(schedule, PLAFONDS)).toBe(true);
  });

  it('buildVefaSchedule : cumul & incréments', () => {
    const ech = buildVefaSchedule(m('40000000'), [
      { key: 'reservation', pct: 0.05 },
      { key: 'fondations', pct: 0.35 },
    ]);
    expect(ech[0].cumul.equals(m('2000000'))).toBe(true);
    expect(ech[1].cumul.equals(m('14000000'))).toBe(true);
    expect(ech[1].increment.equals(m('12000000'))).toBe(true);
  });
});

describe('M6 — appel de fonds conditionné à l’avancement (RG-M6-04)', () => {
  it('avancement ≥ pct du stade requis', () => {
    expect(appelDeFondsAutorise(0.35, 0.35)).toBe(true);
    expect(appelDeFondsAutorise(0.3, 0.35)).toBe(false);
  });
});

describe('M6 — recettes → M4 (RG-M6-02)', () => {
  const r = (amount: string, status: Receipt['status']): Pick<Receipt, 'amount' | 'status'> => ({ amount: m(amount), status });
  it('somme uniquement les encaissements settled', () => {
    const receipts = [r('2000000', 'settled'), r('12000000', 'settled'), r('5000000', 'pending')];
    expect(recettesEncaissees(receipts, XOF).equals(m('14000000'))).toBe(true);
  });
  it('aucun settled → zéro', () => {
    expect(recettesEncaissees([r('1', 'pending')], XOF).isZero()).toBe(true);
  });
});
