/**
 * F5 — Contrat d'intégration, logique pure et testable.
 * Idempotence (clé stable), reprise (backoff exponentiel plafonné), machine de
 * livraison gardée, et disjoncteur. Aucune dépendance IO — l'horloge est
 * injectée (paramètre `now` ISO) pour un comportement déterministe.
 */
import { sha256Hex } from '../m23/sha256';
import {
  DEFAULT_CIRCUIT, DEFAULT_RETRY, type CallOutcome, type CircuitConfig, type CircuitState,
  type CircuitStatus, type IntegrationSystem, type OutboxMessage, type RetryPolicy,
} from './types';

/** Clé d'idempotence stable : deux intentions identiques la partagent. */
export function idempotencyKey(system: IntegrationSystem, kind: string, businessId: string): string {
  return `${system}:${kind}:${businessId}`;
}

/** Sérialisation déterministe (clés triées) pour un hash de charge stable. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Empreinte SHA-256 de la charge utile (rejeu au contenu divergent détectable). */
export function payloadHash(payload: unknown): string {
  return sha256Hex(stableStringify(payload));
}

/** Délai avant la n-ième tentative (attempt ≥ 1) : base·factor^(n-1), plafonné. */
export function backoffDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY): number {
  const raw = policy.baseDelayMs * Math.pow(policy.factor, Math.max(0, attempt - 1));
  return Math.min(Math.round(raw), policy.maxDelayMs);
}

/** Faut-il retenter après cet échec ? (erreur retriable ET quota non atteint). */
export function shouldRetry(outcome: CallOutcome, attempt: number, policy: RetryPolicy = DEFAULT_RETRY): boolean {
  return !outcome.ok && outcome.retriable && attempt < policy.maxAttempts;
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

/**
 * Applique le résultat d'une tentative au message (machine de livraison) :
 *  · succès → delivered ; · échec retriable sous quota → retrying (+ backoff) ;
 *  · sinon → dead (lettre morte). `attempts` est toujours incrémenté.
 */
export function applyOutcome(
  msg: OutboxMessage,
  outcome: CallOutcome,
  now: string,
  policy: RetryPolicy = DEFAULT_RETRY,
): OutboxMessage {
  const attempts = msg.attempts + 1;
  if (outcome.ok) {
    return { ...msg, status: 'delivered', attempts, lastError: null, nextAttemptAt: null };
  }
  if (outcome.retriable && attempts < policy.maxAttempts) {
    return { ...msg, status: 'retrying', attempts, lastError: outcome.error, nextAttemptAt: addMs(now, backoffDelayMs(attempts, policy)) };
  }
  return { ...msg, status: 'dead', attempts, lastError: outcome.error, nextAttemptAt: null };
}

/** Un message retrying est-il prêt à être retenté à l'instant `now` ? */
export function isDue(msg: Pick<OutboxMessage, 'status' | 'nextAttemptAt'>, now: string): boolean {
  if (msg.status === 'pending') return true;
  if (msg.status !== 'retrying' || msg.nextAttemptAt == null) return false;
  return Date.parse(now) >= Date.parse(msg.nextAttemptAt);
}

// ── Disjoncteur (circuit breaker) ────────────────────────────────────────────

/** État effectif : un disjoncteur « open » dont le cooldown est écoulé passe half_open. */
export function effectiveCircuitState(status: CircuitStatus, now: string, cfg: CircuitConfig = DEFAULT_CIRCUIT): CircuitState {
  if (status.state === 'open' && status.openedAt != null && Date.parse(now) - Date.parse(status.openedAt) >= cfg.cooldownMs) {
    return 'half_open';
  }
  return status.state;
}

/** Un appel est-il autorisé ? (fermé ou en essai ; bloqué tant qu'ouvert). */
export function circuitAllows(status: CircuitStatus, now: string, cfg: CircuitConfig = DEFAULT_CIRCUIT): boolean {
  return effectiveCircuitState(status, now, cfg) !== 'open';
}

/** Met à jour le disjoncteur après un appel (succès referme, échec compte / ouvre). */
export function recordCircuit(status: CircuitStatus, outcome: CallOutcome, now: string, cfg: CircuitConfig = DEFAULT_CIRCUIT): CircuitStatus {
  const eff = effectiveCircuitState(status, now, cfg);
  if (outcome.ok) return { state: 'closed', failures: 0, openedAt: null };
  // En demi-ouverture, un seul échec rouvre immédiatement.
  if (eff === 'half_open') return { state: 'open', failures: status.failures + 1, openedAt: now };
  const failures = status.failures + 1;
  if (failures >= cfg.failureThreshold) return { state: 'open', failures, openedAt: now };
  return { state: 'closed', failures, openedAt: null };
}
