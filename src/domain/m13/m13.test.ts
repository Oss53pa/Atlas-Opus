import { describe, it, expect } from 'vitest';
import { sortReports, latestReport, latestProgress, totalBlockers, nextReportNumber } from './pilotage';
import type { SiteReport } from './types';

const cr = (number: number, date: string, progress: number, blockers = 0): SiteReport => ({
  id: `cr${number}`, tenantId: 't', operationId: 'op', number, date, author: 'MOE', progress, summary: '', blockers,
});

describe('M13 — pilotage', () => {
  const list = [cr(1, '2026-05-01', 0.4, 2), cr(3, '2026-06-01', 0.62, 1), cr(2, '2026-05-15', 0.5, 0)];
  it('tri antéchronologique', () => {
    expect(sortReports(list).map((r) => r.number)).toEqual([3, 2, 1]);
  });
  it('dernier compte rendu & avancement courant', () => {
    expect(latestReport(list)?.number).toBe(3);
    expect(latestProgress(list)).toBeCloseTo(0.62, 6);
    expect(latestProgress([])).toBe(0);
  });
  it('cumul des points de blocage', () => {
    expect(totalBlockers(list)).toBe(3);
  });
  it('prochain numéro', () => {
    expect(nextReportNumber(list)).toBe(4);
    expect(nextReportNumber([])).toBe(1);
  });
});
