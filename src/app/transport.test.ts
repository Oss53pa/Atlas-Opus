import { describe, it, expect } from 'vitest';
import { createRepoTransport } from './transport';
import type { PendingMutation } from '../domain/f3';
import type { SiteReport, SiteReportInput } from '../domain/m13/types';

const mutation = (over: Partial<PendingMutation> = {}): PendingMutation => ({
  id: 'm1', entity: 'siteReports', op: 'create', entityId: null,
  payload: { operationId: 'op-1', date: '2026-09-04', author: 'Koffi', progress: 0.62, summary: 'RAS', blockers: 0 },
  baseVersion: null, createdAt: '2026-09-04T10:00:00.000Z', financial: false, status: 'queued', attempts: 0, lastError: null,
  ...over,
});

describe('createRepoTransport — rejeu concret', () => {
  it('siteReports.create → appelle add avec le payload et renvoie ok', async () => {
    const calls: { opId: string; input: SiteReportInput }[] = [];
    const api = {
      siteReports: {
        add: async (opId: string, input: SiteReportInput): Promise<SiteReport> => {
          calls.push({ opId, input });
          return { id: 's1', tenantId: 't', operationId: opId, number: 1, ...input };
        },
      },
    };
    const res = await createRepoTransport(api)(mutation());
    expect(res).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { author: 'Koffi', progress: 0.62, blockers: 0 } });
  });

  it('decomptes.create → appelle addDecompte (brouillon) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      payments: { addDecompte: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'decomptes', op: 'create', payload: { operationId: 'op-1', contractId: 'c1', number: 3, amountGross: 1_000_000, retentionRate: 0.05 } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { contractId: 'c1', number: 3, amountGross: 1_000_000, retentionRate: 0.05 } });
  });

  it('rfis.create → appelle rfis.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      rfis: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'rfis', op: 'create', payload: { operationId: 'op-1', number: 'RFI-01', subject: 'S', question: 'Q', raisedBy: 'BET', priority: 'urgente', dueDate: null, documentRef: null } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { number: 'RFI-01', priority: 'urgente' } });
  });

  it('reserves.create → appelle reception.addReserve et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      reception: { addReserve: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'reserves', op: 'create', payload: { operationId: 'op-1', label: 'Fissure', location: 'R+2', severity: 'majeure', raisedAt: '2026-09-04' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { label: 'Fissure', severity: 'majeure' } });
  });

  it('entité/op non gérée (transition sensible) → échec définitif (rejected)', async () => {
    const api = { siteReports: { add: async () => { throw new Error('should not be called'); } } };
    const res = await createRepoTransport(api as never)(mutation({ entity: 'decomptes', op: 'setStatus' }));
    expect(res).toEqual({ ok: false, retriable: false, error: 'unsupported:decomptes.setStatus' });
  });

  it('erreur d’exécution → retriable', async () => {
    const api = { siteReports: { add: async () => { throw new Error('network down'); } } };
    const res = await createRepoTransport(api)(mutation());
    expect(res).toEqual({ ok: false, retriable: true, error: 'network down' });
  });
});
