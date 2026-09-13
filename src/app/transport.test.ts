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

  it('stakeholders.create → appelle stakeholders.add (poste honoraires) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      stakeholders: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'stakeholders', op: 'create', payload: { operationId: 'op-1', type: 'moe', name: 'Atelier Koffi', email: null, phone: null, mission: 'MOE', feeAmount: 180_000_000 } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { type: 'moe', name: 'Atelier Koffi', feeAmount: 180_000_000 } });
  });

  it('drawdowns.create → reconstruit Money et appelle addDrawdown', async () => {
    const calls: { financingId: string; input: { amount: { toMajorNumber(): number }; condition: number } }[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      financing: { addDrawdown: async (financingId: string, input: { amount: { toMajorNumber(): number }; condition: number }) => { calls.push({ financingId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'drawdowns', op: 'create', payload: { financingId: 'f1', amountMajor: 40_000_000, currency: 'XOF', condition: 0.3 } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0].financingId).toBe('f1');
    expect(calls[0].input.amount.toMajorNumber()).toBe(40_000_000);
    expect(calls[0].input.condition).toBe(0.3);
  });

  it('receipts.create → reconstruit Money et appelle addReceipt', async () => {
    const calls: { saleId: string; input: { amount: { toMajorNumber(): number }; method: string } }[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      commercialisation: { addReceipt: async (saleId: string, input: { amount: { toMajorNumber(): number }; method: string }) => { calls.push({ saleId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'receipts', op: 'create', payload: { saleId: 's1', amountMajor: 15_000_000, currency: 'XOF', method: 'virement', reference: null } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0].saleId).toBe('s1');
    expect(calls[0].input.amount.toMajorNumber()).toBe(15_000_000);
    expect(calls[0].input.method).toBe('virement');
  });

  it('handoverAssets.create → appelle handoverAssets.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      handoverAssets: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'handoverAssets', op: 'create', payload: { operationId: 'op-1', label: 'Ascenseur A', assetType: 'equipement', location: 'Hall', warrantyEnd: '2027-06-30', targetSystem: 'GMAO' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { label: 'Ascenseur A', assetType: 'equipement', targetSystem: 'GMAO' } });
  });

  it('doeDocuments.create → appelle doe.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      doe: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'doeDocuments', op: 'create', payload: { operationId: 'op-1', category: 'plans_recolement', fileRef: 'DOE/x.pdf' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { category: 'plans_recolement', fileRef: 'DOE/x.pdf' } });
  });

  it('baselines.create → appelle baselines.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      baselines: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const snapshot = [{ id: 'tk-1', name: 'Gros œuvre', startDate: '2026-01-01', endDate: '2026-03-01', isMilestone: false }];
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'baselines', op: 'create', payload: { operationId: 'op-1', label: 'OS', snapshot } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { label: 'OS', snapshot } });
  });

  it('budgetLines.create → appelle budgetLines.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      budgetLines: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'budgetLines', op: 'create', payload: { operationId: 'op-1', syscohadaAccount: '2313', label: 'Bâtiment', amountBac: 620000000 } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { syscohadaAccount: '2313', label: 'Bâtiment', amountBac: 620000000 } });
  });

  it('shipments.create → appelle shipments.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      shipments: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'shipments', op: 'create', payload: { operationId: 'op-1', reference: 'EXP-1', incoterm: 'CIF', eta: '2026-10-01' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { reference: 'EXP-1', incoterm: 'CIF', eta: '2026-10-01' } });
  });

  it('eiesItems.create → appelle eiesItems.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      eiesItems: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'eiesItems', op: 'create', payload: { operationId: 'op-1', impact: 'Poussières', milieu: 'physique', severity: 'moyenne', mesureAttenuation: 'Arrosage' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { impact: 'Poussières', milieu: 'physique', severity: 'moyenne', mesureAttenuation: 'Arrosage' } });
  });

  it('serviceOrders.create → appelle serviceOrders.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      serviceOrders: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'serviceOrders', op: 'create', payload: { operationId: 'op-1', type: 'demarrage', reference: 'OS-1', content: 'Démarrage' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { type: 'demarrage', reference: 'OS-1', content: 'Démarrage' } });
  });

  it('actionItems.create → appelle actionItems.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      actionItems: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'actionItems', op: 'create', payload: { operationId: 'op-1', description: 'Reprendre étanchéité', owner: 'BET', dueDate: '2026-09-20' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { description: 'Reprendre étanchéité', owner: 'BET', dueDate: '2026-09-20' } });
  });

  it('legalEntities.create → appelle legalEntities.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      legalEntities: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const shareholders = [{ name: 'A', sharePct: 60 }, { name: 'B', sharePct: 40 }];
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'legalEntities', op: 'create', payload: { operationId: 'op-1', structureType: 'sci', name: 'SCI X', rccm: 'CI-ABJ-1', shareholders } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { structureType: 'sci', name: 'SCI X', rccm: 'CI-ABJ-1', shareholders } });
  });

  it('claims.create → appelle claims.add (déclaré) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      claims: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'claims', op: 'create', payload: { operationId: 'op-1', event: 'Dégât des eaux', amount: 6_500_000, insuranceId: null } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { event: 'Dégât des eaux', amount: 6_500_000 } });
  });

  it('disputes.create → appelle disputes.add (ouvert) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      disputes: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'disputes', op: 'create', payload: { operationId: 'op-1', counterpart: 'BTP', object: 'Retard', amountAtStake: 42_000_000, fileRef: 'C-1' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { counterpart: 'BTP', object: 'Retard', amountAtStake: 42_000_000 } });
  });

  it('hsseIncidents.create → appelle hsse.add (déclaré) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      hsse: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'hsseIncidents', op: 'create', payload: { operationId: 'op-1', reference: 'HSSE-9', kind: 'accident', severity: 'grave', occurredAt: '2026-09-13', location: 'R+1', description: 'Chute', correctiveAction: null } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { reference: 'HSSE-9', kind: 'accident', severity: 'grave' } });
  });

  it('studies.create → appelle studies.add (planifiée) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      studies: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'studies', op: 'create', payload: { operationId: 'op-1', kind: 'geotechnique', provider: 'Geolab', cost: 6_000_000, dueDate: '2026-10-01', summary: null } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { kind: 'geotechnique', provider: 'Geolab', cost: 6_000_000 } });
  });

  it('tasks.create → appelle planning.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      planning: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'tasks', op: 'create', payload: { operationId: 'op-1', name: 'Gros œuvre R+2', startDate: '2026-09-10', endDate: '2026-11-30', isMilestone: false, isCritical: true, progress: 0.1 } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { name: 'Gros œuvre R+2', isCritical: true, progress: 0.1 } });
  });

  it('connections.create → appelle connections.add (demande) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      connections: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'connections', op: 'create', payload: { operationId: 'op-1', utility: 'electricite', concessionaire: 'CIE', reference: 'RAC-01', cost: 8_500_000, requestedAt: '2026-09-09' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { utility: 'electricite', concessionaire: 'CIE', reference: 'RAC-01', cost: 8_500_000 } });
  });

  it('risks.create → appelle risks.add (ouvert) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      risks: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'risks', op: 'create', payload: { operationId: 'op-1', code: 'R-01', label: 'Éboulement talus', category: 'hsse', probability: 4, impact: 5, mitigation: null } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { code: 'R-01', category: 'hsse', probability: 4, impact: 5 } });
  });

  it('changeOrders.create → appelle changeOrders.add (requested) et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      changeOrders: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'changeOrders', op: 'create', payload: { operationId: 'op-1', contractId: 'c1', origin: 'aleas', description: 'Sujétion imprévue fondations' } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { contractId: 'c1', origin: 'aleas', description: 'Sujétion imprévue fondations' } });
  });

  it('guarantees.create → appelle guarantees.add et renvoie ok', async () => {
    const calls: unknown[] = [];
    const api = {
      siteReports: { add: async () => { throw new Error('nope'); } },
      guarantees: { add: async (opId: string, input: unknown) => { calls.push({ opId, input }); return {} as never; } },
    };
    const res = await createRepoTransport(api as never)(
      mutation({ entity: 'guarantees', op: 'create', payload: { operationId: 'op-1', type: 'restitution_avance', issuer: 'Ecobank', amount: 25_000_000, validFrom: '2026-09-04', validUntil: null } }),
    );
    expect(res).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ opId: 'op-1', input: { type: 'restitution_avance', issuer: 'Ecobank', amount: 25_000_000, validUntil: null } });
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
