import { describe, it, expect } from 'vitest';
import { isUnderWarranty, underWarrantyCount, expiringWarranty, unassignedCount } from './handoverAssets';
import type { HandoverAsset } from './types';

const a = (over: Partial<HandoverAsset> = {}): HandoverAsset => ({
  id: 'a1', tenantId: 't', operationId: 'op', label: 'Ascenseur A', assetType: 'equipement',
  location: 'Hall', warrantyEnd: '2027-01-01', targetSystem: 'GMAO', ...over,
});
const NOW = '2026-09-14T00:00:00.000Z';

describe('handoverAssets — garantie & complétude', () => {
  it('isUnderWarranty', () => {
    expect(isUnderWarranty(a({ warrantyEnd: '2027-01-01' }), NOW)).toBe(true);
    expect(isUnderWarranty(a({ warrantyEnd: '2026-01-01' }), NOW)).toBe(false);
    expect(isUnderWarranty(a({ warrantyEnd: null }), NOW)).toBe(false);
  });
  it('underWarrantyCount / expiringWarranty', () => {
    const list = [a({ warrantyEnd: '2027-01-01' }), a({ warrantyEnd: '2026-10-01' }), a({ warrantyEnd: '2026-01-01' })];
    expect(underWarrantyCount(list, NOW)).toBe(2);
    expect(expiringWarranty(list, NOW, 90)).toBe(1); // 2026-10-01 dans 90 j ; 2027 hors fenêtre
  });
  it('unassignedCount', () => {
    expect(unassignedCount([a({ targetSystem: 'GMAO' }), a({ targetSystem: null }), a({ targetSystem: '' })])).toBe(2);
  });
});
