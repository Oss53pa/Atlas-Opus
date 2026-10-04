import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import { nextPurchaseStatus, canTransitionPurchase, isCommitted, committedTotal, receivedCount, receptionRate, isFullyReceived, montantReceptionne } from './purchasing';
import type { PurchaseOrder } from './types';

const XOF = 'XOF';
const po = (status: PurchaseOrder['status'], amount = 0): Pick<PurchaseOrder, 'status' | 'amount'> => ({ status, amount });

describe('M10 — machine du bon de commande', () => {
  it('brouillon → commandé → livré → réceptionné', () => {
    expect(nextPurchaseStatus('brouillon')).toBe('commande');
    expect(nextPurchaseStatus('commande')).toBe('livre');
    expect(nextPurchaseStatus('livre')).toBe('receptionne');
    expect(nextPurchaseStatus('receptionne')).toBeNull();
  });
  it('transitions : un cran seulement', () => {
    expect(canTransitionPurchase('brouillon', 'commande')).toBe(true);
    expect(canTransitionPurchase('brouillon', 'livre')).toBe(false);
  });
});

describe('M10 — engagements & réceptions', () => {
  it('isCommitted vrai dès commandé', () => {
    expect(isCommitted('brouillon')).toBe(false);
    expect(isCommitted('commande')).toBe(true);
    expect(isCommitted('receptionne')).toBe(true);
  });
  it('committedTotal cumule les bons engagés (brouillon exclu)', () => {
    const total = committedTotal([po('commande', 10_000_000), po('receptionne', 5_000_000), po('brouillon', 9_000_000)], XOF);
    expect(total.equals(Money.of(15_000_000, XOF))).toBe(true);
  });
  it('receivedCount compte les réceptionnés', () => {
    expect(receivedCount([po('receptionne'), po('livre'), po('receptionne')])).toBe(2);
  });
});

describe('M10 — réceptions', () => {
  const dl = (purchaseOrderId: string, receivedRate: number) => ({ purchaseOrderId, receivedRate });

  it('cumule les réceptions partielles et plafonne à 100 %', () => {
    expect(receptionRate('bc-1', [dl('bc-1', 0.4), dl('bc-1', 0.4)])).toBeCloseTo(0.8, 6);
    expect(receptionRate('bc-1', [dl('bc-1', 0.8), dl('bc-1', 0.5)])).toBe(1);
    expect(receptionRate('bc-1', [dl('bc-2', 1)])).toBe(0);
  });

  it('déclare servi un bon dont le cumul atteint 100 %', () => {
    expect(isFullyReceived('bc-1', [dl('bc-1', 0.5)])).toBe(false);
    expect(isFullyReceived('bc-1', [dl('bc-1', 0.5), dl('bc-1', 0.5)])).toBe(true);
  });

  it('ne valorise que le reçu des bons engagés', () => {
    const orders = [
      { id: 'bc-1', amount: 1_000_000, status: 'commande' as const },
      { id: 'bc-2', amount: 2_000_000, status: 'brouillon' as const },
    ];
    const deliveries = [dl('bc-1', 0.5), dl('bc-2', 1)];
    expect(montantReceptionne(orders, deliveries, 'XOF').toMajorString()).toBe('500000.00');
  });
});
