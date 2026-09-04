/**
 * F3 — Offline & synchronisation · types du domaine, purs (CLAUDE.md §4).
 * Offline-first : la saisie terrain hors-ligne est journalisée en mutations en
 * attente, rejouées de façon **déterministe** au retour du réseau. Invariant :
 * une écriture financière hors-ligne n'est admise qu'en **brouillon** — jamais de
 * validation/mandatement/paiement hors-ligne (ce sont des Edge Functions gardées).
 */

/** Nature d'une mutation locale. */
export const MUTATION_OPS = ['create', 'update', 'setStatus', 'delete'] as const;
export type MutationOp = (typeof MUTATION_OPS)[number];

/** Cycle de vie d'une mutation dans la file de synchro. */
export const SYNC_STATUSES = ['queued', 'syncing', 'synced', 'conflict', 'rejected'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export interface PendingMutation {
  /** Identité locale stable (UUID généré hors-ligne) — pivot d'idempotence. */
  id: string;
  /** Entité/repo visé (ex. 'decomptes', 'siteReports'). */
  entity: string;
  op: MutationOp;
  /** Id de l'entité (null pour un create : le serveur l'attribue). */
  entityId: string | null;
  payload: Record<string, unknown>;
  /** Version de base pour la concurrence optimiste (null pour un create). */
  baseVersion: number | null;
  /** Horodatage de saisie (ISO, horloge client) — ordonne le rejeu. */
  createdAt: string;
  /** Touche une écriture financière (M4/M5/M15…) → contrainte brouillon. */
  financial: boolean;
  status: SyncStatus;
  attempts: number;
  lastError: string | null;
}

/** Stratégie de résolution de conflit à la synchro. */
export const CONFLICT_STRATEGIES = ['server_wins', 'client_wins', 'lww'] as const;
export type ConflictStrategy = (typeof CONFLICT_STRATEGIES)[number];

/** Décision de synchro pour une mutation. */
export type SyncAction = 'apply' | 'conflict' | 'skip';

export interface SyncPlanEntry {
  mutation: PendingMutation;
  action: SyncAction;
  /** Sur conflit résolu : côté retenu. */
  resolved?: 'local' | 'server';
  reason?: string;
}
