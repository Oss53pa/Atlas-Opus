import { describe, it, expect } from 'vitest';
import {
  idempotencyKey, payloadHash, backoffDelayMs, shouldRetry, applyOutcome, isDue,
  circuitAllows, recordCircuit, effectiveCircuitState,
} from './contract';
import { createIntegrationGateway } from './gateway';
import { CLOSED_CIRCUIT, DEFAULT_RETRY, type CallOutcome, type OutboxMessage } from './types';

const ok: CallOutcome = { ok: true };
const boom: CallOutcome = { ok: false, retriable: true, error: 'timeout' };
const fatal: CallOutcome = { ok: false, retriable: false, error: 'bad_request' };
const T0 = '2026-09-01T00:00:00.000Z';
const at = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();

const msg = (over: Partial<OutboxMessage> = {}): OutboxMessage => ({
  id: 'm1', tenantId: 't', system: 'cinetpay', kind: 'encaissement', businessId: 'b1',
  idempotencyKey: 'cinetpay:encaissement:b1', payloadHash: 'h', status: 'pending', attempts: 0,
  lastError: null, nextAttemptAt: null, createdAt: T0, ...over,
});

describe('F5 — contrat pur : idempotence & empreinte', () => {
  it('clé d’idempotence stable', () => {
    expect(idempotencyKey('cinetpay', 'encaissement', 'b1')).toBe('cinetpay:encaissement:b1');
  });
  it('empreinte indépendante de l’ordre des clés, sensible au contenu', () => {
    expect(payloadHash({ a: 1, b: 2 })).toBe(payloadHash({ b: 2, a: 1 }));
    expect(payloadHash({ a: 1 })).not.toBe(payloadHash({ a: 2 }));
  });
});

describe('F5 — reprise (backoff) et machine de livraison', () => {
  it('backoff exponentiel plafonné', () => {
    expect(backoffDelayMs(1)).toBe(1_000);
    expect(backoffDelayMs(2)).toBe(2_000);
    expect(backoffDelayMs(3)).toBe(4_000);
    expect(backoffDelayMs(10)).toBe(DEFAULT_RETRY.maxDelayMs); // plafond
  });
  it('shouldRetry : retriable ET quota non atteint', () => {
    expect(shouldRetry(boom, 1)).toBe(true);
    expect(shouldRetry(boom, DEFAULT_RETRY.maxAttempts)).toBe(false);
    expect(shouldRetry(fatal, 1)).toBe(false);
  });
  it('succès → delivered ; échec retriable → retrying (+ prochaine tentative)', () => {
    expect(applyOutcome(msg(), ok, T0).status).toBe('delivered');
    const r = applyOutcome(msg(), boom, T0);
    expect(r.status).toBe('retrying');
    expect(r.attempts).toBe(1);
    expect(r.nextAttemptAt).toBe(at(1_000));
  });
  it('échec non retriable → dead ; quota épuisé → dead', () => {
    expect(applyOutcome(msg(), fatal, T0).status).toBe('dead');
    expect(applyOutcome(msg({ attempts: DEFAULT_RETRY.maxAttempts - 1 }), boom, T0).status).toBe('dead');
  });
  it('isDue respecte nextAttemptAt', () => {
    const r = applyOutcome(msg(), boom, T0); // due à T0+1000
    expect(isDue(r, at(500))).toBe(false);
    expect(isDue(r, at(1_000))).toBe(true);
    expect(isDue(msg(), T0)).toBe(true); // pending toujours dû
  });
});

describe('F5 — disjoncteur (circuit breaker)', () => {
  it('ouvre après N échecs consécutifs, bloque, puis passe half_open après cooldown', () => {
    let c = CLOSED_CIRCUIT;
    for (let i = 0; i < 5; i++) c = recordCircuit(c, boom, T0);
    expect(c.state).toBe('open');
    expect(circuitAllows(c, T0)).toBe(false);
    // Après cooldown (30 s), l’état effectif est half_open et l’appel est autorisé.
    expect(effectiveCircuitState(c, at(30_000))).toBe('half_open');
    expect(circuitAllows(c, at(30_000))).toBe(true);
  });
  it('un succès referme ; un échec en half_open rouvre', () => {
    let c = CLOSED_CIRCUIT;
    for (let i = 0; i < 5; i++) c = recordCircuit(c, boom, T0);
    const reclosed = recordCircuit(c, ok, at(30_000));
    expect(reclosed).toEqual(CLOSED_CIRCUIT);
    const reopened = recordCircuit(c, boom, at(30_000)); // échec pendant l’essai
    expect(reopened.state).toBe('open');
  });
});

describe('F5 — passerelle outbox : idempotence de bout en bout', () => {
  let seq = 0;
  const gw = () => createIntegrationGateway({ now: () => T0, id: () => `m-${++seq}`, transport: () => ok });

  it('enfiler deux fois la même intention ne crée qu’un message', () => {
    seq = 0;
    const g = gw();
    const a = g.enqueue({ tenantId: 't', system: 'atlas_finance', kind: 'ecriture', businessId: 'dec-7', payload: { x: 1 } });
    const b = g.enqueue({ tenantId: 't', system: 'atlas_finance', kind: 'ecriture', businessId: 'dec-7', payload: { x: 1 } });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.message.id).toBe(a.message.id);
    expect(g.list()).toHaveLength(1);
  });
  it('même intention avec charge divergente → conflit d’idempotence', () => {
    seq = 0;
    const g = gw();
    g.enqueue({ tenantId: 't', system: 'atlas_finance', kind: 'ecriture', businessId: 'dec-7', payload: { montant: 100 } });
    expect(() => g.enqueue({ tenantId: 't', system: 'atlas_finance', kind: 'ecriture', businessId: 'dec-7', payload: { montant: 999 } }))
      .toThrow('idempotency_conflict');
  });
  it('un message livré est terminal : re-livrer ne rappelle pas le tiers', async () => {
    seq = 0;
    let calls = 0;
    const g = createIntegrationGateway({ now: () => T0, id: () => `m-${++seq}`, transport: () => { calls++; return ok; } });
    const { message } = g.enqueue({ tenantId: 't', system: 'cinetpay', kind: 'encaissement', businessId: 'r1', payload: {} });
    const first = await g.deliver(message.id);
    expect(first.message.status).toBe('delivered');
    const again = await g.deliver(message.id);
    expect(again.skipped).toBe(true);
    expect(again.reason).toBe('terminal');
    expect(calls).toBe(1); // un seul appel tiers malgré deux livraisons
  });
});

describe('F5 — passerelle outbox : panne tierce gérée', () => {
  it('échecs répétés → reprises puis lettre morte au bout du quota', async () => {
    let seq = 0;
    let clock = Date.parse(T0);
    const g = createIntegrationGateway({
      now: () => new Date(clock).toISOString(), id: () => `m-${++seq}`,
      transport: () => boom, // le tiers échoue toujours (retriable)
    });
    const { message } = g.enqueue({ tenantId: 't', system: 'advist', kind: 'attestation', businessId: 'a1', payload: {} });
    for (let i = 0; i < DEFAULT_RETRY.maxAttempts; i++) {
      const r = await g.deliver(message.id);
      if (r.message.status === 'dead') break;
      expect(r.message.status).toBe('retrying');
      clock = Date.parse(r.message.nextAttemptAt!); // avance l’horloge jusqu’à la prochaine tentative
    }
    expect(g.get(message.id)!.status).toBe('dead');
    expect(g.get(message.id)!.attempts).toBe(DEFAULT_RETRY.maxAttempts);
  });

  it('disjoncteur ouvert : la livraison est différée sans rappeler le tiers', async () => {
    let seq = 0;
    let calls = 0;
    const g = createIntegrationGateway({
      now: () => T0, id: () => `m-${++seq}`,
      transport: () => { calls++; return boom; },
    });
    // Enfile et échoue 5 messages → ouvre le disjoncteur du système.
    for (let i = 0; i < 5; i++) {
      const { message } = g.enqueue({ tenantId: 't', system: 'keystone', kind: 'transfert', businessId: `k${i}`, payload: {} });
      await g.deliver(message.id);
    }
    expect(g.circuit('keystone').state).toBe('open');
    const callsBefore = calls;
    // Nouveau message : la livraison est sautée (circuit ouvert), le tiers n’est pas appelé.
    const { message } = g.enqueue({ tenantId: 't', system: 'keystone', kind: 'transfert', businessId: 'k99', payload: {} });
    const r = await g.deliver(message.id);
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe('circuit_open');
    expect(calls).toBe(callsBefore); // aucun appel supplémentaire
  });
});
