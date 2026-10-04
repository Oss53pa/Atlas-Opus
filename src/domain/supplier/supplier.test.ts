import { describe, expect, it } from 'vitest';
import { canTransitionSupplier, nonConformDeliveries, selectableSuppliers, supplierRating } from './supplier';
import type { SupplierStatus } from './types';

const order = (id: string, supplierId: string | null) => ({ id, supplierId });
const delivery = (purchaseOrderId: string, conform: boolean) => ({ purchaseOrderId, conform });

describe('M9 — référentiel fournisseurs', () => {
  it('ne propose plus un fournisseur écarté', () => {
    const list = [{ id: 'a', status: 'actif' as SupplierStatus }, { id: 'b', status: 'ecarte' as SupplierStatus }, { id: 'c', status: 'en_referencement' as SupplierStatus }];
    expect(selectableSuppliers(list).map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('encadre les transitions de référencement', () => {
    expect(canTransitionSupplier('en_referencement', 'actif')).toBe(true);
    expect(canTransitionSupplier('ecarte', 'actif')).toBe(true);
    expect(canTransitionSupplier('actif', 'en_referencement')).toBe(false);
  });

  it('note le fournisseur sur la conformité de ses livraisons', () => {
    const orders = [order('bc-1', 'sup-1'), order('bc-2', 'sup-2')];
    const deliveries = [delivery('bc-1', true), delivery('bc-1', false), delivery('bc-2', true)];
    expect(supplierRating('sup-1', orders, deliveries)).toBe(2.5);
    expect(supplierRating('sup-2', orders, deliveries)).toBe(5);
    expect(nonConformDeliveries('sup-1', orders, deliveries)).toBe(1);
  });

  it('n’invente pas de note sans livraison', () => {
    expect(supplierRating('sup-3', [order('bc-1', 'sup-3')], [])).toBeNull();
    expect(supplierRating('sup-4', [], [delivery('bc-9', true)])).toBeNull();
  });
});
