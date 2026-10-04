import { describe, expect, it } from 'vitest';
import { createMockDb, createPurchasingRepo, createSuppliersRepo } from './mock';
import { createTelemetry } from '../lib/telemetry';
import type { Session } from './repo';
import { receptionRate } from '../domain/m10';

const session = (tenantId = 'tenant-demo'): Session => ({ userId: 'u', tenantId, role: 'moa_director', operationScope: null });
const deps = { telemetry: createTelemetry() };

describe('M9/M10 — fournisseurs & réceptions (mock)', () => {
  it('isole le référentiel par espace', async () => {
    const db = createMockDb();
    expect((await createSuppliersRepo(db, session(), deps).list()).length).toBe(3);
    expect(await createSuppliersRepo(db, session('tenant-other'), deps).list()).toEqual([]);
  });

  it('référence un fournisseur « en référencement » et encadre ses transitions', async () => {
    const repo = createSuppliersRepo(createMockDb(), session(), deps);
    const s = await repo.add({ name: 'Nouveau BTP', category: 'travaux' });
    expect(s.status).toBe('en_referencement');
    expect((await repo.update(s.id, { status: 'actif' })).status).toBe('actif');
    await expect(repo.update(s.id, { status: 'en_referencement' })).rejects.toThrow('supplier_transition_invalid');
  });

  it('refuse de supprimer un fournisseur déjà commandé', async () => {
    const repo = createSuppliersRepo(createMockDb(), session(), deps);
    await expect(repo.remove('sup-1')).rejects.toThrow('supplier_in_use');
    await expect(repo.remove('sup-3')).resolves.toBeUndefined();
  });

  it('cumule les réceptions d’un bon de commande', async () => {
    const db = createMockDb();
    const purchasing = createPurchasingRepo(db, session(), deps);
    expect(receptionRate('po-p1', await purchasing.deliveries('op-palmiers'))).toBeCloseTo(0.75, 6);
    await purchasing.addDelivery('op-palmiers', { purchaseOrderId: 'po-p1', date: '2026-06-20', receivedRate: 0.5 });
    expect(receptionRate('po-p1', await purchasing.deliveries('op-palmiers'))).toBe(1);
  });
});
