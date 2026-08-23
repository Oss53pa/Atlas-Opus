import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import { nextPurchaseStatus, canTransitionPurchase, isCommitted, committedTotal, receivedCount } from './purchasing';
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
