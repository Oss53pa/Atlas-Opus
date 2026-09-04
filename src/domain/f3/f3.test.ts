import { describe, it, expect } from 'vitest';
import {
  admitOffline, enqueue, orderQueue, planSync, settle, pending, serializeQueue, deserializeQueue,
} from './sync';
import type { PendingMutation } from './types';

const base = (over: Partial<PendingMutation> = {}): PendingMutation => ({
  id: 'm1', entity: 'siteReports', op: 'update', entityId: 'e1', payload: {}, baseVersion: 0,
  createdAt: '2026-09-04T10:00:00.000Z', financial: false, status: 'queued', attempts: 0, lastError: null, ...over,
});
const input = (over: Partial<PendingMutation> = {}) => {
  const { status, attempts, lastError, ...rest } = base(over);
  void status; void attempts; void lastError;
  return rest;
};

describe('F3 — recevabilité hors-ligne (invariant §4)', () => {
  it('mutation non financière : admise', () => {
    expect(admitOffline({ financial: false, op: 'update', payload: { status: 'validated' } }).ok).toBe(true);
  });
  it('écriture financière en brouillon : admise', () => {
    expect(admitOffline({ financial: true, op: 'update', payload: { status: 'draft' } }).ok).toBe(true);
    expect(admitOffline({ financial: true, op: 'update', payload: { amount: 100 } }).ok).toBe(true);
  });
  it('écriture financière hors brouillon : refusée', () => {
    const v = admitOffline({ financial: true, op: 'setStatus', payload: { status: 'mandated' } });
    expect(v).toEqual({ ok: false, reason: 'financial_offline_draft_only' });
  });
});

describe('F3 — file de mutations', () => {
  it('enqueue idempotent par id', () => {
    const q1 = enqueue([], input({ id: 'a' })).queue;
    const q2 = enqueue(q1, input({ id: 'a' })).queue;
    expect(q2).toHaveLength(1);
  });
  it('enqueue refuse une écriture financière hors brouillon (status rejected)', () => {
    const res = enqueue([], input({ id: 'f', financial: true, op: 'setStatus', payload: { status: 'validated' } }));
    expect(res.admitted).toBe(false);
    expect(res.queue[0].status).toBe('rejected');
    expect(res.queue[0].lastError).toBe('financial_offline_draft_only');
  });
  it('ordre de rejeu déterministe (createdAt puis id)', () => {
    const q = [
      base({ id: 'b', createdAt: '2026-09-04T10:00:00.000Z' }),
      base({ id: 'a', createdAt: '2026-09-04T10:00:00.000Z' }),
      base({ id: 'c', createdAt: '2026-09-03T08:00:00.000Z' }),
    ];
    expect(orderQueue(q).map((m) => m.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('F3 — plan de synchro (concurrence optimiste)', () => {
  it('create → apply ; update en phase → apply', () => {
    const q = [base({ id: 'c1', op: 'create', entityId: null, baseVersion: null }), base({ id: 'u1', entityId: 'e1', baseVersion: 3 })];
    const plan = planSync(q, { e1: 3 }, { strategy: 'server_wins' });
    expect(plan.map((p) => p.action)).toEqual(['apply', 'apply']);
  });

  it('mutations successives sur la même entité s’enchaînent (versions filées)', () => {
    const q = [
      base({ id: 'u1', entityId: 'e1', baseVersion: 0, createdAt: '2026-09-04T10:00:00.000Z' }),
      base({ id: 'u2', entityId: 'e1', baseVersion: 1, createdAt: '2026-09-04T11:00:00.000Z' }),
    ];
    const plan = planSync(q, { e1: 0 }, { strategy: 'server_wins' });
    expect(plan.map((p) => p.action)).toEqual(['apply', 'apply']);
  });

  it('divergence de version → conflit (server_wins)', () => {
    const plan = planSync([base({ entityId: 'e1', baseVersion: 0 })], { e1: 5 }, { strategy: 'server_wins' });
    expect(plan[0]).toMatchObject({ action: 'conflict', resolved: 'server' });
  });

  it('client_wins force l’application malgré la divergence', () => {
    const plan = planSync([base({ entityId: 'e1', baseVersion: 0 })], { e1: 5 }, { strategy: 'client_wins' });
    expect(plan[0]).toMatchObject({ action: 'apply', resolved: 'local' });
  });

  it('lww : local plus récent applique, sinon conflit', () => {
    const local = base({ entityId: 'e1', baseVersion: 0, createdAt: '2026-09-04T12:00:00.000Z' });
    const win = planSync([local], { e1: 5 }, { strategy: 'lww', serverTimes: { e1: '2026-09-04T09:00:00.000Z' } });
    expect(win[0]).toMatchObject({ action: 'apply', resolved: 'local' });
    const lose = planSync([local], { e1: 5 }, { strategy: 'lww', serverTimes: { e1: '2026-09-04T18:00:00.000Z' } });
    expect(lose[0]).toMatchObject({ action: 'conflict', resolved: 'server' });
  });

  it('mutation non « queued » → skip', () => {
    const plan = planSync([base({ status: 'synced' })], { e1: 0 }, { strategy: 'server_wins' });
    expect(plan[0].action).toBe('skip');
  });
});

describe('F3 — settle & reprise', () => {
  it('succès → synced', () => {
    expect(settle(base(), { ok: true }).status).toBe('synced');
  });
  it('échec retriable → re-queued (attempts++)', () => {
    const r = settle(base({ attempts: 1 }), { ok: false, retriable: true, error: 'network' });
    expect(r).toMatchObject({ status: 'queued', attempts: 2, lastError: 'network' });
  });
  it('conflit → status conflict ; échec définitif → rejected', () => {
    expect(settle(base(), { ok: false, retriable: false, error: 'conflict' }).status).toBe('conflict');
    expect(settle(base(), { ok: false, retriable: false, error: 'bad_request' }).status).toBe('rejected');
  });
  it('pending ne renvoie que les queued, ordonnés', () => {
    const q = [base({ id: 'a', status: 'synced' }), base({ id: 'b', status: 'queued', createdAt: '2026-09-04T09:00:00.000Z' })];
    expect(pending(q).map((m) => m.id)).toEqual(['b']);
  });
});

describe('F3 — persistance', () => {
  it('sérialise/désérialise en préservant l’ordre de rejeu', () => {
    const q = [base({ id: 'b', createdAt: '2026-09-04T11:00:00.000Z' }), base({ id: 'a', createdAt: '2026-09-04T10:00:00.000Z' })];
    const round = deserializeQueue(serializeQueue(q));
    expect(round.map((m) => m.id)).toEqual(['a', 'b']);
  });
  it('valeur absente/corrompue → file vide', () => {
    expect(deserializeQueue(null)).toEqual([]);
    expect(deserializeQueue('{pas du json')).toEqual([]);
  });
});
