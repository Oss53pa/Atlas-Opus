import { describe, it, expect } from 'vitest';
import {
  admitOffline, enqueue, orderQueue, planSync, settle, pending, serializeQueue, deserializeQueue, drainQueue,
  reconcileIds,
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

describe('F3 — drainQueue (rejeu via transport)', () => {
  it('applique les mutations dans l’ordre et marque synced', async () => {
    const seen: string[] = [];
    const q = [
      base({ id: 'b', createdAt: '2026-09-04T11:00:00.000Z' }),
      base({ id: 'a', createdAt: '2026-09-04T10:00:00.000Z' }),
    ];
    const res = await drainQueue(q, async (m) => { seen.push(m.id); return { ok: true }; });
    expect(seen).toEqual(['a', 'b']); // ordre de rejeu déterministe
    expect(res.synced).toBe(2);
    expect(res.queue.every((m) => m.status === 'synced')).toBe(true);
  });

  it('échec retriable → reste queued ; définitif → rejected', async () => {
    const q = [base({ id: 'r' }), base({ id: 'x' })];
    const res = await drainQueue(q, async (m) =>
      m.id === 'r' ? { ok: false, retriable: true, error: 'network' } : { ok: false, retriable: false, error: 'bad' });
    const byId = Object.fromEntries(res.queue.map((m) => [m.id, m.status]));
    expect(byId).toMatchObject({ r: 'queued', x: 'rejected' });
    expect(res.failed).toBe(1);
  });

  it('conflit détecté par le plan → acté sans appeler le transport', async () => {
    let called = 0;
    const res = await drainQueue([base({ entityId: 'e1', baseVersion: 0 })], async () => { called++; return { ok: true }; }, {
      strategy: 'server_wins', serverVersions: { e1: 9 },
    });
    expect(called).toBe(0);
    expect(res.conflicts).toBe(1);
    expect(res.queue[0].status).toBe('conflict');
  });
});

describe('F3 — réconciliation d’id post-synchro', () => {
  it('reconcileIds remappe entityId et les références de payload (dont tableaux)', () => {
    const map = { 'local-A': 'srv-A', 'local-B': 'srv-B' };
    const queue = [
      base({ id: 'u', op: 'setStatus', entityId: 'local-A', payload: { status: 'valide' } }),
      base({ id: 'c', op: 'create', entityId: null, payload: { parentId: 'local-A', tags: ['local-B', 'x'] } }),
      base({ id: 'z', op: 'update', entityId: 'e9', payload: { foo: 'bar' } }),
    ];
    const out = reconcileIds(queue, map);
    expect(out[0].entityId).toBe('srv-A'); // update cible désormais l'id serveur
    expect(out[1].payload).toEqual({ parentId: 'srv-A', tags: ['srv-B', 'x'] }); // FK + tableau
    expect(out[2]).toBe(queue[2]); // inchangé → même référence (pas de copie)
  });

  it('reconcileIds : mapping vide → file inchangée (même référence)', () => {
    const queue = [base({ entityId: 'local-A' })];
    expect(reconcileIds(queue, {})).toBe(queue);
  });

  it('drainQueue expose la table de réconciliation pour les create synchronisés', async () => {
    const queue = [
      base({ id: 'p', op: 'create', entityId: null, localId: 'local-P', payload: { name: 'Parent' } }),
      base({ id: 'child', op: 'create', entityId: null, payload: { parentId: 'local-P' } }, ),
    ];
    // Le transport n'arrive à joindre le serveur que pour le parent (l'enfant échoue, reste en file).
    const transport = async (m: PendingMutation) => (m.id === 'p'
      ? { ok: true as const, serverId: 'srv-P' }
      : { ok: false as const, retriable: true, error: 'net' });
    const res = await drainQueue(queue, transport);
    expect(res.reconciliation).toEqual({ 'local-P': 'srv-P' });
    // L'enfant, encore en file, pointe maintenant vers l'id serveur du parent.
    const child = res.queue.find((m) => m.id === 'child')!;
    expect(child.payload.parentId).toBe('srv-P');
    expect(child.status).toBe('queued');
  });

  it('drainQueue : un create sans localId ne produit pas de réconciliation', async () => {
    const res = await drainQueue([base({ id: 'p', op: 'create', entityId: null, payload: {} })], async () => ({ ok: true, serverId: 'srv-P' }));
    expect(res.reconciliation).toEqual({});
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
