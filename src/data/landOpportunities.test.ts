import { describe, expect, it } from 'vitest';
import { createLandOpportunitiesRepo, createMockDb } from './mock';
import { createTelemetry } from '../lib/telemetry';
import type { Session } from './repo';

const session = (tenantId = 'tenant-demo'): Session => ({ userId: 'u', tenantId, role: 'moa_director', operationScope: null });
const deps = { telemetry: createTelemetry() };

describe('M2 amont — dépôt des opportunités foncières (mock)', () => {
  it('isole le pipeline par espace', async () => {
    const db = createMockDb();
    expect((await createLandOpportunitiesRepo(db, session(), deps).list()).length).toBe(3);
    expect(await createLandOpportunitiesRepo(db, session('tenant-other'), deps).list()).toEqual([]);
  });

  it('crée une opportunité en prospection, à arbitrer', async () => {
    const repo = createLandOpportunitiesRepo(createMockDb(), session(), deps);
    const o = await repo.add({ reference: 'OPP-X', name: 'Terrain test', propertyType: 'terrain_nu', countryCode: 'CI' });
    expect(o.status).toBe('prospection');
    expect(o.decision).toBe('pending');
    expect(o.operationId).toBeNull();
  });

  it('refuse une seconde conversion', async () => {
    const repo = createLandOpportunitiesRepo(createMockDb(), session(), deps);
    await repo.update('lo-1', { operationId: 'op-1', status: 'acquise' });
    await expect(repo.update('lo-1', { operationId: 'op-2' })).rejects.toThrow('already_converted');
  });
});
