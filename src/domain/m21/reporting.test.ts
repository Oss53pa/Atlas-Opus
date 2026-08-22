import { describe, it, expect } from 'vitest';
import { compareReports, reportToMarkdown, type ReportData, type ReportSnapshot } from './reporting';

const data = (over: Partial<ReportData> = {}): ReportData => ({
  coutTotal: 2_450_000_000,
  recettes: 3_120_000_000,
  recettesRealisees: 1_950_000_000,
  marge: 670_000_000,
  tauxMarge: 0.2735,
  tri: 0.14,
  progress: 0.62,
  alertsDanger: 1,
  alertsEcheance: 2,
  ...over,
});

describe('M21 reporting — comparaison période à période (RG-M21-03)', () => {
  it('calcule les écarts courant − précédent', () => {
    const prev = data({ marge: 500_000_000, progress: 0.5, alertsDanger: 2 });
    const delta = compareReports(prev, data());
    expect(delta.marge).toBe(170_000_000);
    expect(delta.progress).toBeCloseTo(0.12, 5);
    expect(delta.alertsDanger).toBe(-1);
  });

  it('écarts nuls entre clichés identiques', () => {
    const delta = compareReports(data(), data());
    expect(delta.marge).toBe(0);
    expect(delta.recettesRealisees).toBe(0);
  });
});

describe('M21 reporting — export Markdown (RG-M21-04)', () => {
  const snap: ReportSnapshot = {
    id: 's1', tenantId: 't', operationId: 'op',
    type: 'mensuel', period: '2026-08', data: data(), generatedAt: '2026-08-22T10:00:00.000Z',
  };

  it('produit un document Markdown avec les indicateurs', () => {
    const md = reportToMarkdown({ operationName: 'Résidence Les Palmiers', currency: 'XOF' }, snap);
    expect(md).toContain('# Reporting Mensuel — Résidence Les Palmiers');
    expect(md).toContain('Période : 2026-08');
    expect(md).toContain('| TRI | 14.0 % |');
    expect(md).toContain('Danger : 1');
  });

  it('TRI n/a quand null', () => {
    const md = reportToMarkdown({ operationName: 'X', currency: 'XOF' }, { ...snap, data: data({ tri: null }) });
    expect(md).toContain('| TRI | n/a |');
  });
});
