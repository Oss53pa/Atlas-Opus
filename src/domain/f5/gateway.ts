/**
 * F5 — Passerelle d'intégration (pattern outbox), déterministe et testable.
 * Réunit le contrat : enfilement idempotent, livraison gardée par disjoncteur,
 * reprise avec backoff, lettre morte. Le transport (appel tiers) et l'horloge
 * sont injectés — aucune dépendance réseau ici : la couche Edge Function
 * fournira le vrai transport en production.
 */
import {
  applyOutcome, circuitAllows, idempotencyKey, isDue, payloadHash, recordCircuit,
} from './contract';
import {
  CLOSED_CIRCUIT, DEFAULT_CIRCUIT, DEFAULT_RETRY, type CallOutcome, type CircuitConfig,
  type CircuitStatus, type IntegrationSystem, type OutboxMessage, type RetryPolicy,
} from './types';

export type Transport = (system: IntegrationSystem, message: OutboxMessage) => CallOutcome | Promise<CallOutcome>;

export interface GatewayDeps {
  now: () => string;
  id?: () => string;
  transport: Transport;
  retry?: RetryPolicy;
  circuit?: CircuitConfig;
}

export interface EnqueueInput {
  tenantId: string;
  system: IntegrationSystem;
  kind: string;
  businessId: string;
  payload: unknown;
}
export interface EnqueueResult {
  message: OutboxMessage;
  /** false si l'intention existait déjà (dédoublonnée) — idempotence. */
  created: boolean;
}
export interface DeliverResult {
  message: OutboxMessage;
  skipped: boolean;
  reason?: 'circuit_open' | 'not_due' | 'terminal';
  outcome?: CallOutcome;
}

export interface IntegrationGateway {
  enqueue(input: EnqueueInput): EnqueueResult;
  deliver(id: string): Promise<DeliverResult>;
  get(id: string): OutboxMessage | undefined;
  list(): OutboxMessage[];
  circuit(system: IntegrationSystem): CircuitStatus;
}

export function createIntegrationGateway(deps: GatewayDeps): IntegrationGateway {
  const retry = deps.retry ?? DEFAULT_RETRY;
  const cfg = deps.circuit ?? DEFAULT_CIRCUIT;
  const uid = deps.id ?? (() => crypto.randomUUID());
  const store = new Map<string, OutboxMessage>();
  const byKey = new Map<string, string>(); // idempotencyKey → message id
  const circuits = new Map<IntegrationSystem, CircuitStatus>();

  const circuitOf = (system: IntegrationSystem) => circuits.get(system) ?? CLOSED_CIRCUIT;

  return {
    enqueue({ tenantId, system, kind, businessId, payload }) {
      const key = idempotencyKey(system, kind, businessId);
      const hash = payloadHash(payload);
      const existingId = byKey.get(`${tenantId}:${key}`);
      if (existingId) {
        const existing = store.get(existingId)!;
        // Rejeu au contenu divergent sous la même intention : violation de contrat.
        if (existing.payloadHash !== hash) throw new Error('idempotency_conflict');
        return { message: { ...existing }, created: false };
      }
      const message: OutboxMessage = {
        id: uid(), tenantId, system, kind, businessId, idempotencyKey: key, payloadHash: hash,
        status: 'pending', attempts: 0, lastError: null, nextAttemptAt: null, createdAt: deps.now(),
      };
      store.set(message.id, message);
      byKey.set(`${tenantId}:${key}`, message.id);
      return { message: { ...message }, created: true };
    },

    async deliver(id) {
      const msg = store.get(id);
      if (!msg) throw new Error('not_found');
      const now = deps.now();
      // Terminal : livré ou en lettre morte → aucune ré-application (idempotence).
      if (msg.status === 'delivered' || msg.status === 'dead') {
        return { message: { ...msg }, skipped: true, reason: 'terminal' };
      }
      if (!isDue(msg, now)) return { message: { ...msg }, skipped: true, reason: 'not_due' };
      // Disjoncteur ouvert : on n'appelle pas le tiers (panne gérée, pas de matraquage).
      if (!circuitAllows(circuitOf(msg.system), now, cfg)) {
        return { message: { ...msg }, skipped: true, reason: 'circuit_open' };
      }
      const outcome = await deps.transport(msg.system, msg);
      const updated = applyOutcome(msg, outcome, now, retry);
      store.set(id, updated);
      circuits.set(msg.system, recordCircuit(circuitOf(msg.system), outcome, now, cfg));
      return { message: { ...updated }, skipped: false, outcome };
    },

    get: (id) => { const m = store.get(id); return m ? { ...m } : undefined; },
    list: () => [...store.values()].map((m) => ({ ...m })),
    circuit: (system) => ({ ...circuitOf(system) }),
  };
}
