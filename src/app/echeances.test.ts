import { describe, it, expect } from 'vitest';
import { scanEcheances } from './echeances';
import type { NotificationUpsert } from '../domain/f4/echeances';
import type { Insurance } from '../m7/types';
import type { Guarantee } from '../m17/types';
import type { Operation } from '../domain/m1/types';

const TODAY = '2026-09-04';
const op = (id: string): Operation => ({ id } as Operation);

const insurances: Record<string, Insurance[]> = {
  'op-a': [{ id: 'i1', tenantId: 't', operationId: 'op-a', stakeholderId: null, type: 'DO', insurer: 'AXA', validFrom: '2026-01-01', validTo: '2026-08-31', attestationRef: null }],
  'op-b': [],
};
const guarantees: Record<string, Guarantee[]> = {
  'op-a': [],
  'op-b': [{ id: 'g1', tenantId: 't', operationId: 'op-b', type: 'bonne_execution', issuer: 'BOA', amount: 5_000_000, validFrom: '2026-01-01', validUntil: '2026-09-20', status: 'active' }],
};

describe('scanEcheances — job « relances & échéances »', () => {
  it('émet une relance par échéance et est idempotent au second passage', async () => {
    const store: NotificationUpsert[] = [];
    const deps = {
      ops: [op('op-a'), op('op-b')],
      compliance: { insurances: async (id: string) => insurances[id] ?? [] },
      guarantees: { list: async (id: string) => guarantees[id] ?? [] },
      admin: {
        upsertNotification: async (input: NotificationUpsert) => {
          if (store.some((n) => n.tenantId === input.tenantId && n.dedupKey === input.dedupKey)) return { created: false };
          store.push(input);
          return { created: true };
        },
      },
    };

    const first = await scanEcheances(deps, { today: TODAY });
    expect(first).toEqual({ operations: 2, items: 2, created: 2, existing: 0 });
    expect(store.map((n) => n.dedupKey).sort()).toEqual(['echeance:assurance:i1:expired', 'echeance:caution:g1:expiring']);

    // Second passage : rien de neuf (le cron peut repasser sans dupliquer).
    const second = await scanEcheances(deps, { today: TODAY });
    expect(second).toEqual({ operations: 2, items: 2, created: 0, existing: 2 });
    expect(store).toHaveLength(2);
  });
});
