// F5 — logique de livraison pure (miroir Deno de src/domain/f5/contract.ts).
// DOIT rester identique au domaine : mêmes constantes, mêmes transitions. Les
// vecteurs d'or de src/domain/f5/f5.test.ts figent ce contrat.

export type DeliveryStatus = 'pending' | 'inflight' | 'delivered' | 'retrying' | 'dead';
export type CallOutcome = { ok: true } | { ok: false; retriable: boolean; error: string };
export type CircuitState = 'closed' | 'open' | 'half_open';

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  factor: number;
}
export const DEFAULT_RETRY: RetryPolicy = { maxAttempts: 5, baseDelayMs: 1_000, maxDelayMs: 60_000, factor: 2 };

export interface CircuitConfig {
  failureThreshold: number;
  cooldownMs: number;
}
export const DEFAULT_CIRCUIT: CircuitConfig = { failureThreshold: 5, cooldownMs: 30_000 };

export interface CircuitStatus {
  state: CircuitState;
  failures: number;
  openedAt: string | null;
}

/** Délai avant la n-ième tentative (attempt ≥ 1) : base·factor^(n-1), plafonné. */
export function backoffDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY): number {
  const raw = policy.baseDelayMs * Math.pow(policy.factor, Math.max(0, attempt - 1));
  return Math.min(Math.round(raw), policy.maxDelayMs);
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export interface DeliveryDelta {
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
}

/**
 * Applique le résultat d'une tentative (machine de livraison) — miroir de
 * applyOutcome : succès → delivered ; échec retriable sous quota → retrying
 * (+ backoff) ; sinon → dead. `attempts` est toujours incrémenté.
 */
export function deliveryTransition(
  attempts0: number,
  outcome: CallOutcome,
  now: string,
  policy: RetryPolicy = DEFAULT_RETRY,
): DeliveryDelta {
  const attempts = attempts0 + 1;
  if (outcome.ok) return { status: 'delivered', attempts, lastError: null, nextAttemptAt: null };
  if (outcome.retriable && attempts < policy.maxAttempts) {
    return { status: 'retrying', attempts, lastError: outcome.error, nextAttemptAt: addMs(now, backoffDelayMs(attempts, policy)) };
  }
  return { status: 'dead', attempts, lastError: outcome.error, nextAttemptAt: null };
}

/** État effectif : un « open » dont le cooldown est écoulé passe half_open. */
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
  if (eff === 'half_open') return { state: 'open', failures: status.failures + 1, openedAt: now };
  const failures = status.failures + 1;
  if (failures >= cfg.failureThreshold) return { state: 'open', failures, openedAt: now };
  return { state: 'closed', failures, openedAt: null };
}
