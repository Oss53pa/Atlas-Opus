import { describe, it, expect } from 'vitest';
import { isPending, pendingCount, totalPending, totalIndemnise, canTransitionClaim } from './claim';
import type { Claim } from './types';

const c = (over: Partial<Claim> = {}): Claim => ({
  id: 'c1', tenantId: 't', operationId: 'op', insuranceId: null, event: 'Dégât des eaux',
  amount: 3_000_000, status: 'declare', ...over,
});

describe('claim — instruction & agrégation', () => {
  it('isPending / pendingCount', () => {
    expect(isPending(c({ status: 'indemnise' }))).toBe(false);
    expect(pendingCount([c(), c({ status: 'en_instruction' }), c({ status: 'refuse' })])).toBe(2);
  });
  it('totalPending / totalIndemnise (Money exact)', () => {
    const list = [c({ amount: 3_000_000 }), c({ amount: 5_000_000, status: 'en_instruction' }), c({ amount: 9_000_000, status: 'indemnise' })];
    expect(totalPending(list, 'XOF').toMajorNumber()).toBe(8_000_000);
    expect(totalIndemnise(list, 'XOF').toMajorNumber()).toBe(9_000_000);
  });
});

describe('claim — transitions', () => {
  it('instruction vers indemnisé/refusé', () => {
    expect(canTransitionClaim('declare', 'en_instruction')).toBe(true);
    expect(canTransitionClaim('en_instruction', 'indemnise')).toBe(true);
    expect(canTransitionClaim('en_instruction', 'refuse')).toBe(true);
    expect(canTransitionClaim('indemnise', 'en_instruction')).toBe(false);
    expect(canTransitionClaim('declare', 'indemnise')).toBe(false);
  });
});
