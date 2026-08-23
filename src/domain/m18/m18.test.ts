import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import { nextConnectionStatus, isConnected, connectedCount, pendingCount, connectionsCostTotal } from './connections';
import type { Connection } from './types';

const XOF = 'XOF';
const c = (status: Connection['status'], cost = 0): Pick<Connection, 'status' | 'cost'> => ({ status, cost });

describe('M18 — raccordements', () => {
  it('machine demande → étude → devis → payé → raccordé', () => {
    expect(nextConnectionStatus('demande')).toBe('etude');
    expect(nextConnectionStatus('devis')).toBe('paye');
    expect(nextConnectionStatus('paye')).toBe('raccorde');
    expect(nextConnectionStatus('raccorde')).toBeNull();
  });
  it('compteurs raccordés / en cours', () => {
    const list = [c('raccorde'), c('devis'), c('demande'), c('raccorde')];
    expect(connectedCount(list)).toBe(2);
    expect(pendingCount(list)).toBe(2);
    expect(isConnected('raccorde')).toBe(true);
  });
  it('cumul des coûts via Money.ts', () => {
    expect(connectionsCostTotal([c('paye', 12_000_000), c('devis', 8_000_000)], XOF).equals(Money.of(20_000_000, XOF))).toBe(true);
  });
});
