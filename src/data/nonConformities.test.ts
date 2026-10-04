import { describe, expect, it } from 'vitest';
import { createMockDb, createNonConformitiesRepo } from './mock';
import { createTelemetry } from '../lib/telemetry';
import type { Session } from './repo';

const session = (tenantId = 'tenant-demo'): Session => ({ userId: 'u', tenantId, role: 'moa_director', operationScope: null });
const repo = (tenantId?: string) => createNonConformitiesRepo(createMockDb(), session(tenantId), { telemetry: createTelemetry() });

describe('M18 qualité — dépôt des non-conformités (mock)', () => {
  it('isole le registre par espace', async () => {
    expect((await repo().list('op-palmiers')).length).toBe(3);
    expect(await repo('tenant-other').list('op-palmiers')).toEqual([]);
  });

  it('crée la non-conformité « ouverte », sans date de clôture', async () => {
    const r = repo();
    const n = await r.add('op-palmiers', {
      reference: 'NC-TEST', label: 'Écart test', source: 'chantier', severity: 'majeure', detectedAt: '2026-06-01',
    });
    expect(n.status).toBe('ouverte');
    expect(n.closedAt).toBeNull();
  });

  it('RG-NC-02 — refuse de solder sans action corrective, l’accepte avec', async () => {
    const r = repo();
    await expect(r.update('nc-2', { status: 'soldee' })).rejects.toThrow('nc_corrective_action_required');
    const solded = await r.update('nc-2', { status: 'soldee', correctiveAction: 'PV d’essai reconstitué et validé.' });
    expect(solded.status).toBe('soldee');
    expect(solded.closedAt).not.toBeNull();
  });

  it('réouvre une non-conformité soldée et efface sa clôture', async () => {
    const r = repo();
    const reopened = await r.update('nc-3', { status: 'en_traitement' });
    expect(reopened.status).toBe('en_traitement');
    expect(reopened.closedAt).toBeNull();
  });
});
