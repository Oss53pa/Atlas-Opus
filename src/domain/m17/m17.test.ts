import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import { effectiveStatus, isCovering, activeCount, expiringCount, coveredTotal, canTransitionGuarantee } from './guarantees';
import type { Guarantee } from './types';

const XOF = 'XOF';
const TODAY = '2026-08-22';
const g = (status: Guarantee['status'], validUntil: string | null, amount = 0): Pick<Guarantee, 'status' | 'validUntil' | 'amount'> => ({ status, validUntil, amount });

describe('M17 — statut effectif', () => {
  it('dérive active / expiring / expiree de l’échéance', () => {
    expect(effectiveStatus({ status: 'active', validUntil: '2027-01-01' }, TODAY)).toBe('active');
    expect(effectiveStatus({ status: 'active', validUntil: '2026-09-10' }, TODAY)).toBe('expiring');
    expect(effectiveStatus({ status: 'active', validUntil: '2026-08-01' }, TODAY)).toBe('expiree');
  });
  it('les statuts terminaux priment sur l’échéance', () => {
    expect(effectiveStatus({ status: 'liberee', validUntil: '2020-01-01' }, TODAY)).toBe('liberee');
    expect(effectiveStatus({ status: 'appelee', validUntil: null }, TODAY)).toBe('appelee');
  });
});

describe('M17 — encours & échéances', () => {
  const list = [g('active', '2027-01-01', 50_000_000), g('active', '2026-09-10', 20_000_000), g('active', '2026-08-01', 10_000_000), g('liberee', null, 30_000_000)];
  it('isCovering : active/expiring oui, expiree/liberee non', () => {
    expect(isCovering(g('active', '2027-01-01'), TODAY)).toBe(true);
    expect(isCovering(g('active', '2026-09-10'), TODAY)).toBe(true);
    expect(isCovering(g('active', '2026-08-01'), TODAY)).toBe(false);
    expect(isCovering(g('liberee', null), TODAY)).toBe(false);
  });
  it('compte couvrantes & imminentes', () => {
    expect(activeCount(list, TODAY)).toBe(2);
    expect(expiringCount(list, TODAY)).toBe(1);
  });
  it('encours couvert = somme des couvrantes', () => {
    expect(coveredTotal(list, XOF, TODAY).equals(Money.of(70_000_000, XOF))).toBe(true);
  });
});

describe('M17 — transitions', () => {
  it('active → libérée | appelée ; terminaux figés', () => {
    expect(canTransitionGuarantee('active', 'liberee')).toBe(true);
    expect(canTransitionGuarantee('active', 'appelee')).toBe(true);
    expect(canTransitionGuarantee('liberee', 'active')).toBe(false);
  });
});
