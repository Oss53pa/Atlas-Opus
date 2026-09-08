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

  it('purchaseOrders.create → appelle purchasing.add (brouillon) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      purchasing: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'purchaseOrders', op: 'create', payload: { operationId: 'op-1', reference: 'BC-01', supplier: 'Fournitex', item: 'Ciment', quantity: 200, unit: 't', amount: 12_000_000 } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { reference: 'BC-01', supplier: 'Fournitex', amount: 12_000_000 } });
  });

  it('documents.create → appelle documents.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      documents: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'documents', op: 'create', payload: { operationId: 'op-1', reference: 'ARC-101', title: 'Plan RDC', discipline: 'architecture', indice: 'B' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { reference: 'ARC-101', indice: 'B' } });
  });

  it('units.create → reconstruit Money et appelle addUnit', async () => {
    const calls: { opId: string; input: { price: { toMajorNumber(): number } } }[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      commercialisation: { addUnit: async (opId: string, input: { price: { toMajorNumber(): number } }) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'units', op: 'create', payload: { operationId: 'op-1', typology: 'T3', area: 78, priceMajor: 45_000_000, currency: 'XOF' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0].input.price.toMajorNumber()).toBe(45_000_000); // Money reconstruit
  });

  it('sales.create → reconstruit Money (brouillon) et appelle addSale', async () => {
    const calls: { input: { amount: { toMajorNumber(): number }; counterpart: string } }[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      commercialisation: { addSale: async (_opId: string, input: { amount: { toMajorNumber(): number }; counterpart: string }) => { calls.push({ input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'sales', op: 'create', payload: { operationId: 'op-1', kind: 'reservation', unitId: null, counterpart: 'M. Koné', amountMajor: 30_000_000, currency: 'XOF', schedule: [] } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0].input.amount.toMajorNumber()).toBe(30_000_000);
    expect(calls[0].input.counterpart).toBe('M. Koné');
  });

  it('landParcels.create → appelle addLandParcel (prospection) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      compliance: { addLandParcel: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'landParcels', op: 'create', payload: { operationId: 'op-1', reference: 'TF-12', area: 1200, tenureType: 'titre_foncier', price: 90_000_000, notary: null, suspensiveConditions: [] } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { reference: 'TF-12', tenureType: 'titre_foncier', price: 90_000_000 } });
  });

  it('priceRevisions.create → appelle revisions.add (coefficient figé) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      revisions: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'priceRevisions', op: 'create', payload: { operationId: 'op-1', contractId: 'c1', baseAmount: 100_000_000, a0: 0.15, terms: [{ weight: 0.85, index: 130, index0: 100 }], coefficient: 1.255, revisedAmount: 125_500_000 } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { contractId: 'c1', coefficient: 1.255, revisedAmount: 125_500_000 } });
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
