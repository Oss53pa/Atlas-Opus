import { describe, it, expect } from 'vitest';
import { dayDiff, timelineBounds, barGeometry } from './planning';
import type { Task } from './types';

const task = (over: Partial<Task>): Task => ({
  id: 'x', tenantId: 't', operationId: 'o', name: 'T', startDate: null, endDate: null,
  isMilestone: false, isCritical: false, progress: 0, createdAt: '', updatedAt: '', ...over,
});

describe('Planning §M12', () => {
  it('dayDiff en jours', () => {
    expect(dayDiff('2026-01-01', '2026-01-11')).toBe(10);
  });

  it('bornes de frise = min start → max end', () => {
    const b = timelineBounds([
      task({ startDate: '2026-02-01', endDate: '2026-03-01' }),
      task({ startDate: '2026-01-15', endDate: '2026-01-20' }),
    ]);
    expect(b).not.toBeNull();
    expect(b!.start).toBe('2026-01-15');
    expect(b!.end).toBe('2026-03-01');
  });

  it('géométrie de barre (left/width %)', () => {
    const b = { start: '2026-01-01', end: '2026-01-11', days: 10 };
    const g = barGeometry('2026-01-03', '2026-01-05', b);
    expect(Math.round(g.leftPct)).toBe(20);
    expect(Math.round(g.widthPct)).toBe(20);
  });

  it('null si aucune tâche datée', () => {
    expect(timelineBounds([task({}), task({})])).toBeNull();
  });
});
