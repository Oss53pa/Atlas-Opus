import { describe, it, expect } from 'vitest';
import { recomputePortfolio, groupByTenant } from './recompute';
import { recomputeBilan, type BilanRecompute } from '../domain/finance/recompute';
import { Money } from '../domain/money/Money';
import type { Operation } from '../domain/m1/types';
import type { ReportInput, ReportSnapshot } from '../domain/m21/reporting';

const XOF = 'XOF';
const op = (id: string): Operation => ({ id } as Operation);

const fakeRecompute = (marge: number): BilanRecompute =>
  recomputeBilan({
    currency: XOF,
    lines: [
      { kind: 'cost', amount: Money.of(100_000_000, XOF) },
      { kind: 'revenue', amount: Money.of(100_000_000 + marge, XOF) },
    ],
    recettesRealisees: Money.zero(XOF),
    cashflow: [],
    bac: Money.of(100_000_000, XOF),
    computedAt: '2026-09-03T00:00:00.000Z',
  });

describe('recomputePortfolio — job « recalcul du bilan »', () => {
  it('recalcule chaque opération et fige un cliché M21', async () => {
    const generated: { opId: string; input: ReportInput }[] = [];
    const bilan = {
      recompute: async (opId: string) => (opId === 'op-empty' ? null : fakeRecompute(opId === 'op-a' ? 20_000_000 : 5_000_000)),
    };
    const reporting = {
      generate: async (operationId: string, input: ReportInput): Promise<ReportSnapshot> => {
        generated.push({ opId: operationId, input });
        return { id: `snap-${operationId}`, tenantId: 't', operationId, ...input, generatedAt: '2026-09-03T00:00:00.000Z' };
      },
    };

    const results = await recomputePortfolio(
      { ops: [op('op-a'), op('op-b'), op('op-empty')], bilan, reporting },
      { type: 'mensuel', period: '2026-09', extras: (id) => ({ progress: id === 'op-a' ? 0.5 : 0.1, alertsDanger: 0, alertsEcheance: 0 }) },
    );

    // op-empty (recompute null) est ignorée.
    expect(results.map((r) => r.operationId)).toEqual(['op-a', 'op-b']);
    expect(generated).toHaveLength(2);
    // Le cliché fige la marge recalculée et l'avancement fourni.
    expect(generated[0].input.data.marge).toBe(20_000_000);
    expect(generated[0].input.data.progress).toBe(0.5);
    expect(generated[0].input.type).toBe('mensuel');
    expect(generated[0].input.period).toBe('2026-09');
    expect(results[0].snapshot.id).toBe('snap-op-a');
  });

  it('extras par défaut (0) si non fournis', async () => {
    const bilan = { recompute: async () => fakeRecompute(1_000_000) };
    let captured: ReportInput | null = null;
    const reporting = {
      generate: async (operationId: string, input: ReportInput): Promise<ReportSnapshot> => {
        captured = input;
        return { id: 's', tenantId: 't', operationId, ...input, generatedAt: 'now' };
      },
    };
    await recomputePortfolio({ ops: [op('op-x')], bilan, reporting }, { type: 'hebdo', period: 'W36' });
    expect(captured!.data.progress).toBe(0);
    expect(captured!.data.alertsDanger).toBe(0);
  });
});

describe('groupByTenant', () => {
  it('regroupe par tenant en préservant l’ordre', () => {
    const g = groupByTenant([
      { id: '1', tenantId: 'A' },
      { id: '2', tenantId: 'B' },
      { id: '3', tenantId: 'A' },
    ]);
    expect([...g.keys()]).toEqual(['A', 'B']);
    expect(g.get('A')!.map((x) => x.id)).toEqual(['1', '3']);
    expect(g.get('B')!.map((x) => x.id)).toEqual(['2']);
  });
  it('liste vide → map vide', () => {
    expect(groupByTenant([]).size).toBe(0);
  });
});
