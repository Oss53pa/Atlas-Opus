/**
 * F5 — Intégrations · types du contrat d'intégration, purs.
 * Six systèmes tiers (CLAUDE.md §8). Le contrat garantit deux propriétés du
 * gate : idempotence (une même intention n'est jamais appliquée deux fois) et
 * panne tierce gérée (reprise avec backoff, disjoncteur, lettre morte).
 * Modèle « outbox » : chaque intention sortante est journalisée puis délivrée.
 * Tables : ao_integration_endpoints, ao_outbox.
 */

export const INTEGRATION_SYSTEMS = [
  'atlas_finance', // écritures comptables / bilan
  'advist',        // attestations & assurances
  'cinetpay',      // encaissements (mobile money / carte)
  'atlas_lease',   // baux & location
  'keystone',      // exploitation / facility management
  'duedeck',       // due diligence foncière
] as const;
export type IntegrationSystem = (typeof INTEGRATION_SYSTEMS)[number];

/** Cycle de vie d'un message sortant. */
export const DELIVERY_STATUSES = ['pending', 'inflight', 'delivered', 'retrying', 'dead'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface OutboxMessage {
  id: string;
  tenantId: string;
  system: IntegrationSystem;
  /** Nature métier (ex. 'ecriture_compta', 'encaissement', 'attestation'). */
  kind: string;
  /** Identité métier stable — pivot de l'idempotence (ex. id de décompte). */
  businessId: string;
  /** Clé d'idempotence dérivée de (system, kind, businessId). */
  idempotencyKey: string;
  /** Empreinte de la charge utile (détecte un rejeu au contenu divergent). */
  payloadHash: string;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  /** Horodatage ISO de la prochaine tentative, ou null. */
  nextAttemptAt: string | null;
  createdAt: string;
}

/** Politique de reprise (backoff exponentiel plafonné). */
export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  factor: number;
}
export const DEFAULT_RETRY: RetryPolicy = { maxAttempts: 5, baseDelayMs: 1_000, maxDelayMs: 60_000, factor: 2 };

/** Résultat d'un appel au système tiers. */
export type CallOutcome =
  | { ok: true }
  | { ok: false; retriable: boolean; error: string };

/** Disjoncteur (circuit breaker) par système. */
export const CIRCUIT_STATES = ['closed', 'open', 'half_open'] as const;
export type CircuitState = (typeof CIRCUIT_STATES)[number];
export interface CircuitConfig {
  /** Nombre d'échecs consécutifs avant ouverture. */
  failureThreshold: number;
  /** Délai (ms) avant de tenter une reprise (open → half_open). */
  cooldownMs: number;
}
export const DEFAULT_CIRCUIT: CircuitConfig = { failureThreshold: 5, cooldownMs: 30_000 };
export interface CircuitStatus {
  state: CircuitState;
  failures: number;
  /** Horodatage ISO d'ouverture, ou null. */
  openedAt: string | null;
}
export const CLOSED_CIRCUIT: CircuitStatus = { state: 'closed', failures: 0, openedAt: null };
