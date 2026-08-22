import { describe, it, expect } from 'vitest';
import { ddGate, isBlockingItem, type DueDiligenceItem } from './dueDiligence';

const item = (over: Partial<DueDiligenceItem> = {}): DueDiligenceItem => ({
  id: 'dd',
  tenantId: 't',
  operationId: 'op',
  category: 'litige',
  finding: 'x',
  severity: 'critical',
  status: 'open',
  ...over,
});

describe('M2 — garde due diligence (RG-M2-03)', () => {
  it('un item critical/high ouvert bloque', () => {
    expect(isBlockingItem(item({ severity: 'critical', status: 'open' }))).toBe(true);
    expect(isBlockingItem(item({ severity: 'high', status: 'open' }))).toBe(true);
  });

  it('un item cleared ou de faible sévérité ne bloque pas', () => {
    expect(isBlockingItem(item({ severity: 'critical', status: 'cleared' }))).toBe(false);
    expect(isBlockingItem(item({ severity: 'medium', status: 'open' }))).toBe(false);
    expect(isBlockingItem(item({ severity: 'low', status: 'open' }))).toBe(false);
  });

  it('ddGate : liste les items bloquants et positionne ok', () => {
    const g = ddGate([
      item({ id: 'a', severity: 'critical', status: 'open' }),
      item({ id: 'b', severity: 'high', status: 'cleared' }),
      item({ id: 'c', severity: 'medium', status: 'open' }),
    ]);
    expect(g.ok).toBe(false);
    expect(g.blocking.map((i) => i.id)).toEqual(['a']);
  });

  it('ddGate : aucun bloquant → ok', () => {
    expect(ddGate([]).ok).toBe(true);
    expect(ddGate([item({ severity: 'high', status: 'cleared' })]).ok).toBe(true);
  });
});
