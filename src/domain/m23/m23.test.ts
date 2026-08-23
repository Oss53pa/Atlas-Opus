import { describe, it, expect } from 'vitest';
import { canModifyAudit, sortByDateDesc, groupByDay, distinctModules } from './audit';
import type { AuditEntry } from './types';

const e = (id: string, at: string, module: string): AuditEntry => ({
  id, tenantId: 't', operationId: 'op', at, actor: 'MOA', action: 'update', module, object: 'x', summary: null,
});

describe('M23 — journal append-only', () => {
  it('une entrée n’est jamais modifiable', () => {
    expect(canModifyAudit()).toBe(false);
  });
  it('tri antéchronologique', () => {
    const s = sortByDateDesc([e('a', '2026-08-01T10:00:00Z', 'M4'), e('b', '2026-08-02T09:00:00Z', 'M4')]);
    expect(s.map((x) => x.id)).toEqual(['b', 'a']);
  });
  it('regroupement par jour, jours décroissants', () => {
    const g = groupByDay([
      e('a', '2026-08-01T10:00:00Z', 'M4'),
      e('b', '2026-08-02T09:00:00Z', 'M8'),
      e('c', '2026-08-02T12:00:00Z', 'M4'),
    ]);
    expect(g.map((x) => x.day)).toEqual(['2026-08-02', '2026-08-01']);
    expect(g[0].entries.map((x) => x.id)).toEqual(['c', 'b']); // 12h avant 9h
  });
  it('modules distincts', () => {
    expect(distinctModules([e('a', '2026-08-01T10:00:00Z', 'M4'), e('b', '2026-08-01T11:00:00Z', 'M4'), e('c', '2026-08-01T12:00:00Z', 'M8')])).toBe(2);
  });
});
