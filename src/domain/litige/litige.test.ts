import { describe, it, expect } from 'vitest';
import { isActive, activeCount, totalAtStake, canTransitionDispute } from './litige';
import type { Dispute } from './types';

const d = (over: Partial<Dispute> = {}): Dispute => ({
  id: 'd1', tenantId: 't', operationId: 'op', counterpart: 'BTP Ivoire', object: 'Retard',
  amountAtStake: 5_000_000, fileRef: null, status: 'ouvert', ...over,
});

describe('litige — activité & agrégation', () => {
  it('isActive / activeCount', () => {
    expect(isActive(d({ status: 'clos' }))).toBe(false);
    expect(isActive(d({ status: 'transige' }))).toBe(false);
    expect(activeCount([d(), d({ status: 'en_cours' }), d({ status: 'clos' })])).toBe(2);
  });
  it('totalAtStake ne somme que les litiges actifs (Money exact)', () => {
    const total = totalAtStake([
      d({ amountAtStake: 5_000_000 }),
      d({ amountAtStake: 3_000_000, status: 'en_cours' }),
      d({ amountAtStake: 9_000_000, status: 'clos' }),
    ], 'XOF');
    expect(total.toMajorNumber()).toBe(8_000_000);
  });
});

describe('litige — transitions', () => {
  it('marche métier + réouverture', () => {
    expect(canTransitionDispute('ouvert', 'en_cours')).toBe(true);
    expect(canTransitionDispute('en_cours', 'transige')).toBe(true);
    expect(canTransitionDispute('en_cours', 'clos')).toBe(true);
    expect(canTransitionDispute('clos', 'en_cours')).toBe(true);
    expect(canTransitionDispute('ouvert', 'transige')).toBe(false);
  });
});
