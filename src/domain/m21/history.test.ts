import { describe, expect, it } from 'vitest';
import { reportHistoryRows, type ReportSnapshot } from './reporting';

const snap = (id: string, generatedAt: string, marge: number): ReportSnapshot => ({
  id, tenantId: 't', operationId: 'op', type: 'mensuel', period: generatedAt.slice(0, 7),
  generatedAt,
  data: { coutTotal: 1000.4, recettes: 1200, recettesRealisees: 300, marge, tauxMarge: 0.123456, tri: null, progress: 0.5, alertsDanger: 1, alertsEcheance: 2 },
});

describe('M21 — historique exportable', () => {
  it('ordonne du plus ancien au plus récent pour lire la tendance', () => {
    const rows = reportHistoryRows([snap('b', '2026-09-01T00:00:00Z', 200), snap('a', '2026-08-01T00:00:00Z', 100)]);
    expect(rows.map((r) => r[0])).toEqual(['2026-08-01', '2026-09-01']);
  });

  it('arrondit les montants et garde un TRI absent vide', () => {
    const [row] = reportHistoryRows([snap('a', '2026-08-01T00:00:00Z', 199.6)]);
    expect(row[3]).toBe(1000);
    expect(row[6]).toBe(200);
    expect(row[7]).toBe(0.1235);
    expect(row[8]).toBeNull();
  });
});
