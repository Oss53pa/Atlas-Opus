import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import { decompteNet, nextDecompteStatus } from './decompte';

const X = 'XOF';

describe('Décompte §6', () => {
  it('net = brut − retenue', () => {
    const { retention, net } = decompteNet(Money.of('1000000', X), 0.05);
    expect(retention.equals(Money.of('50000', X))).toBe(true);
    expect(net.equals(Money.of('950000', X))).toBe(true);
  });

  it('machine de statut draft → validated → mandated → paid', () => {
    expect(nextDecompteStatus('draft')).toBe('validated');
    expect(nextDecompteStatus('validated')).toBe('mandated');
    expect(nextDecompteStatus('mandated')).toBe('paid');
    expect(nextDecompteStatus('paid')).toBeNull();
  });
});
