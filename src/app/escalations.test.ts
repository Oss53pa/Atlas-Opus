import { describe, it, expect } from 'vitest';
import { scanEscalations } from './escalations';
import type { NotificationUpsert } from '../domain/f4/echeances';
import type { ApprovalTask } from '../domain/admin/types';

const NOW = '2026-09-04T12:00:00.000Z';
const ap = (id: string, createdAt: string): ApprovalTask => ({
  id, tenantId: 't', module: 'M13', object: `obj-${id}`, detail: '', amount: 1_000_000,
  status: 'a_valider', requiredRole: 'moa_director', forMe: true, createdAt,
});

describe('scanEscalations — job « escalades »', () => {
  it('émet les escalades franchies et reste idempotent au second passage', async () => {
    const store: NotificationUpsert[] = [];
    const deps = {
      approvals: {
        approvals: async (): Promise<ApprovalTask[]> => [
          ap('old', '2026-08-10T00:00:00.000Z'), // L3
          ap('mid', '2026-08-28T00:00:00.000Z'), // ~7 j → L2
          ap('new', '2026-09-03T09:00:00.000Z'), // < 3 j → aucune
        ],
      },
      admin: {
        upsertNotification: async (input: NotificationUpsert) => {
          if (store.some((n) => n.tenantId === input.tenantId && n.dedupKey === input.dedupKey)) return { created: false };
          store.push(input);
          return { created: true };
        },
      },
    };

    const first = await scanEscalations(deps, { now: NOW });
    expect(first).toEqual({ approvals: 3, escalations: 2, created: 2, existing: 0 });
    expect(store.map((n) => n.dedupKey).sort()).toEqual(['escalation:mid:L2', 'escalation:old:L3']);

    const second = await scanEscalations(deps, { now: NOW });
    expect(second).toEqual({ approvals: 3, escalations: 2, created: 0, existing: 2 });
    expect(store).toHaveLength(2);
  });
});
