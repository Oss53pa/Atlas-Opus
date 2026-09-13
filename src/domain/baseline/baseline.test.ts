import { describe, it, expect } from 'vitest';
import { snapshotOf, activeBaseline, endVariance, taskVariances, slippedCount } from './baseline';
import type { Baseline, BaselineTask } from './types';
import type { Task } from '../m12/types';

const bt = (over: Partial<BaselineTask> = {}): BaselineTask => ({
  id: 't1', name: 'Gros œuvre', startDate: '2026-01-01', endDate: '2026-03-01', isMilestone: false, ...over,
});

const base = (snapshot: BaselineTask[], over: Partial<Baseline> = {}): Baseline => ({
  id: 'b', tenantId: 't', operationId: 'op', label: 'OS', snapshot, isActive: false, createdAt: '2026-01-01', ...over,
});

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1', tenantId: 't', operationId: 'op', name: 'Gros œuvre', startDate: '2026-01-01', endDate: '2026-03-01',
  isMilestone: false, isCritical: false, progress: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01', ...over,
});

describe('baseline — capture & variance', () => {
  it('snapshotOf ne retient que les champs stables', () => {
    const snap = snapshotOf([task({ progress: 42, isCritical: true })]);
    expect(snap).toEqual([{ id: 't1', name: 'Gros œuvre', startDate: '2026-01-01', endDate: '2026-03-01', isMilestone: false }]);
  });

  it('activeBaseline retourne la seule active, sinon null', () => {
    expect(activeBaseline([base([bt()]), base([bt()], { id: 'b2', isActive: true })])?.id).toBe('b2');
    expect(activeBaseline([base([bt()])])).toBeNull();
  });

  it('endVariance : positif = retard, négatif = avance', () => {
    const b = base([bt({ endDate: '2026-03-01' })]);
    expect(endVariance(b, [task({ endDate: '2026-03-11' })])).toBe(10); // 10 j de retard
    expect(endVariance(b, [task({ endDate: '2026-02-24' })])).toBe(-5); // 5 j d'avance
  });

  it('endVariance null si borne indéterminée', () => {
    expect(endVariance(base([bt({ startDate: null, endDate: null })]), [task()])).toBeNull();
    expect(endVariance(base([bt()]), [task({ startDate: null, endDate: null })])).toBeNull();
  });

  it('taskVariances : tâches communes datées, triées par retard décroissant', () => {
    const b = base([bt({ id: 't1', endDate: '2026-03-01' }), bt({ id: 't2', name: 'Second œuvre', endDate: '2026-04-01' })]);
    const cur = [task({ id: 't1', endDate: '2026-03-05' }), task({ id: 't2', name: 'Second œuvre', endDate: '2026-04-15' })];
    const v = taskVariances(b, cur);
    expect(v.map((x) => x.id)).toEqual(['t2', 't1']); // 14 j puis 4 j
    expect(v[0].days).toBe(14);
    expect(slippedCount(b, cur)).toBe(2);
  });

  it('taskVariances ignore les tâches absentes du planning courant ou non datées', () => {
    const b = base([bt({ id: 't1', endDate: '2026-03-01' }), bt({ id: 'gone', endDate: '2026-05-01' }), bt({ id: 't3', endDate: null })]);
    const v = taskVariances(b, [task({ id: 't1', endDate: '2026-03-01' }), task({ id: 't3', endDate: '2026-06-01' })]);
    expect(v.map((x) => x.id)).toEqual(['t1']); // gone absent, t3 non daté en baseline
    expect(v[0].days).toBe(0);
    expect(slippedCount(b, [task({ id: 't1', endDate: '2026-03-01' })])).toBe(0);
  });
});
