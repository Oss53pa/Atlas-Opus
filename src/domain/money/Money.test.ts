import { describe, it, expect } from 'vitest';
import { Money, sumMoney } from './Money';

const X = 'XOF';

describe('Money — exactitude (bigint, pas de flottant)', () => {
  it('évite le piège 0.1 + 0.2', () => {
    expect(Money.of(0.1, X).add(Money.of(0.2, X)).equals(Money.of('0.30', X))).toBe(true);
  });

  it('parse string et minor de façon cohérente', () => {
    expect(Money.of('2450000000', X).minor).toBe(245_000_000_000n);
    expect(Money.of('2450000000', X).toMajorString()).toBe('2450000000.00');
    expect(Money.fromMinor(500n, X).toMajorString()).toBe('5.00');
  });

  it('add / subtract / negate', () => {
    expect(Money.of('1000', X).subtract(Money.of('250', X)).equals(Money.of('750', X))).toBe(true);
    expect(Money.of('10', X).negate().equals(Money.of('-10', X))).toBe(true);
  });

  it('mulRate arrondit au demi supérieur', () => {
    expect(Money.of('100', X).mulRate(0.05).equals(Money.of('5', X))).toBe(true);
    expect(Money.of('0.01', X).mulRate(0.5).equals(Money.of('0.01', X))).toBe(true); // 0.005 → 0.01
    expect(Money.of('100', X).percentage(0.196).equals(Money.of('19.60', X))).toBe(true);
  });

  it('allocate répartit sans perte de centime', () => {
    const parts = Money.of('100', X).allocate([1, 1, 1]);
    expect(sumMoney(parts, X).equals(Money.of('100', X))).toBe(true);
    expect(parts).toHaveLength(3);
  });

  it('comparaisons', () => {
    expect(Money.of('10', X).gt(Money.of('5', X))).toBe(true);
    expect(Money.of('5', X).lte(Money.of('5', X))).toBe(true);
    expect(Money.of('0', X).isZero()).toBe(true);
  });

  it('refuse les devises incompatibles', () => {
    expect(() => Money.of('1', 'XOF').add(Money.of('1', 'XAF'))).toThrow();
  });
});
