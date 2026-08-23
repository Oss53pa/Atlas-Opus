import { describe, it, expect } from 'vitest';
import { nextRfiStatus, openCount, urgentOpenCount, isOverdue, overdueCount } from './rfi';
import type { Rfi } from './types';

const TODAY = '2026-08-22';
const r = (status: Rfi['status'], priority: Rfi['priority'] = 'normale', dueDate: string | null = null): Pick<Rfi, 'status' | 'priority' | 'dueDate'> => ({ status, priority, dueDate });

describe('M12 — RFI', () => {
  it('machine ouverte → répondue → clôturée', () => {
    expect(nextRfiStatus('ouverte')).toBe('repondue');
    expect(nextRfiStatus('repondue')).toBe('cloturee');
    expect(nextRfiStatus('cloturee')).toBeNull();
  });
  it('compteurs ouvertes / urgentes', () => {
    const list = [r('ouverte', 'urgente'), r('ouverte'), r('cloturee', 'urgente')];
    expect(openCount(list)).toBe(2);
    expect(urgentOpenCount(list)).toBe(1);
  });
  it('en retard = ouverte + échéance dépassée', () => {
    expect(isOverdue(r('ouverte', 'normale', '2026-08-01'), TODAY)).toBe(true);
    expect(isOverdue(r('ouverte', 'normale', '2026-09-01'), TODAY)).toBe(false);
    expect(isOverdue(r('cloturee', 'normale', '2026-08-01'), TODAY)).toBe(false);
    expect(overdueCount([r('ouverte', 'normale', '2026-08-01'), r('ouverte', 'normale', '2026-09-01')], TODAY)).toBe(1);
  });
});
