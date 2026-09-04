/**
 * F3 — File de mutations hors-ligne & synchro différée déterministe.
 * Pur et injectable (aucune IO) : la couche runtime (IndexedDB/localStorage +
 * transport) fournit persistance et réseau. Déterminisme : ordre de rejeu par
 * (createdAt, id), concurrence optimiste par `baseVersion`, stratégies de conflit
 * explicites. Garde d'invariant §4 : écriture financière hors-ligne = brouillon.
 */
import type { ConflictStrategy, MutationOp, PendingMutation, SyncPlanEntry } from './types';

/** Ordre de rejeu déterministe : par date de saisie puis id (stable). */
export function orderQueue(queue: PendingMutation[]): PendingMutation[] {
  return [...queue].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Recevabilité hors-ligne (invariant §4). Une mutation financière ne peut pas
 * faire sortir l'entité du brouillon hors-ligne : un `status` cible autre que
 * 'draft' est refusé (la validation passe par une Edge Function, en ligne).
 */
export function admitOffline(m: Pick<PendingMutation, 'financial' | 'payload' | 'op'>): { ok: true } | { ok: false; reason: string } {
  if (m.op === 'delete') return { ok: true };
  if (!m.financial) return { ok: true };
  const status = m.payload?.status;
  if (status !== undefined && status !== 'draft') {
    return { ok: false, reason: 'financial_offline_draft_only' };
  }
  return { ok: true };
}

/**
 * Enfile une mutation. Idempotent par `id` (une reprise ne duplique pas) et
 * gardé par `admitOffline`. Renvoie la file mise à jour + le verdict.
 */
export function enqueue(
  queue: PendingMutation[],
  input: Omit<PendingMutation, 'status' | 'attempts' | 'lastError'>,
): { queue: PendingMutation[]; admitted: boolean; reason?: string } {
  if (queue.some((m) => m.id === input.id)) return { queue, admitted: true };
  const verdict = admitOffline(input);
  if (!verdict.ok) {
    const rejected: PendingMutation = { ...input, status: 'rejected', attempts: 0, lastError: verdict.reason };
    return { queue: [...queue, rejected], admitted: false, reason: verdict.reason };
  }
  const queued: PendingMutation = { ...input, status: 'queued', attempts: 0, lastError: null };
  return { queue: [...queue, queued], admitted: true };
}

export interface PlanOptions {
  strategy: ConflictStrategy;
  /** Horodatage serveur par entité (ISO) — requis pour la stratégie 'lww'. */
  serverTimes?: Record<string, string>;
}

const NON_VERSIONED_OPS: MutationOp[] = ['create'];

/**
 * Établit le plan de synchro déterministe. Pour chaque mutation « queued »
 * (dans l'ordre de rejeu) : un create s'applique ; sinon on compare `baseVersion`
 * à la version courante (enchaînée pour les mutations successives d'une même
 * entité). Divergence → conflit résolu par la stratégie.
 */
export function planSync(queue: PendingMutation[], serverVersions: Record<string, number>, opts: PlanOptions): SyncPlanEntry[] {
  const working: Record<string, number> = { ...serverVersions };
  const entries: SyncPlanEntry[] = [];

  for (const mutation of orderQueue(queue)) {
    if (mutation.status !== 'queued') {
      entries.push({ mutation, action: 'skip', reason: `status_${mutation.status}` });
      continue;
    }
    if (NON_VERSIONED_OPS.includes(mutation.op) || mutation.entityId === null) {
      entries.push({ mutation, action: 'apply' });
      continue;
    }
    const key = mutation.entityId;
    const current = working[key] ?? 0;
    if (mutation.baseVersion === current) {
      working[key] = current + 1;
      entries.push({ mutation, action: 'apply' });
      continue;
    }
    // Divergence : la version serveur a bougé depuis la saisie hors-ligne.
    entries.push(resolveConflict(mutation, current, working, opts));
  }
  return entries;
}

function resolveConflict(
  mutation: PendingMutation,
  current: number,
  working: Record<string, number>,
  opts: PlanOptions,
): SyncPlanEntry {
  const key = mutation.entityId as string;
  switch (opts.strategy) {
    case 'client_wins':
      working[key] = current + 1;
      return { mutation, action: 'apply', resolved: 'local', reason: 'client_wins' };
    case 'lww': {
      const serverTime = opts.serverTimes?.[key];
      if (serverTime !== undefined && mutation.createdAt > serverTime) {
        working[key] = current + 1;
        return { mutation, action: 'apply', resolved: 'local', reason: 'lww_local_newer' };
      }
      return { mutation, action: 'conflict', resolved: 'server', reason: 'lww_server_newer' };
    }
    case 'server_wins':
    default:
      return { mutation, action: 'conflict', resolved: 'server', reason: 'server_wins' };
  }
}

/** Résultat de l'exécution d'une mutation par le transport. */
export type SettleResult = { ok: true } | { ok: false; retriable: boolean; error: string };

/**
 * Fait progresser une mutation après tentative de synchro : succès → synced ;
 * échec retriable → re-queued (attempts++) ; échec définitif → rejected. Le plan
 * peut aussi acter un conflit (retriable=false, error='conflict').
 */
export function settle(mutation: PendingMutation, result: SettleResult): PendingMutation {
  const attempts = mutation.attempts + 1;
  if (result.ok) return { ...mutation, status: 'synced', attempts, lastError: null };
  if (result.retriable) return { ...mutation, status: 'queued', attempts, lastError: result.error };
  return { ...mutation, status: result.error === 'conflict' ? 'conflict' : 'rejected', attempts, lastError: result.error };
}

/** Mutations restant à synchroniser (queued) — pour un prochain passage. */
export function pending(queue: PendingMutation[]): PendingMutation[] {
  return orderQueue(queue.filter((m) => m.status === 'queued'));
}

/** Transport de rejeu : exécute une mutation contre le backend (repo/Edge Fn). */
export type OfflineTransport = (mutation: PendingMutation) => Promise<SettleResult>;

export interface DrainResult {
  queue: PendingMutation[];
  synced: number;
  conflicts: number;
  failed: number;
}

/**
 * Vide la file de façon déterministe : établit le plan (planSync), exécute les
 * mutations « apply » via le transport et fait progresser chaque statut (settle).
 * Les conflits détectés par le plan sont actés sans appeler le transport. Par
 * défaut la détection de version est déléguée au transport (client_wins,
 * `serverVersions` vide) ; passez `serverVersions`/`strategy` pour l'activer.
 */
export async function drainQueue(
  queue: PendingMutation[],
  transport: OfflineTransport,
  opts: Partial<PlanOptions> & { serverVersions?: Record<string, number> } = {},
): Promise<DrainResult> {
  const strategy = opts.strategy ?? 'client_wins';
  const plan = planSync(queue, opts.serverVersions ?? {}, { strategy, serverTimes: opts.serverTimes });
  const byId = new Map(queue.map((m) => [m.id, m]));
  let synced = 0;
  let conflicts = 0;
  let failed = 0;

  for (const entry of plan) {
    if (entry.action === 'skip') continue;
    if (entry.action === 'conflict') {
      byId.set(entry.mutation.id, settle(entry.mutation, { ok: false, retriable: false, error: 'conflict' }));
      conflicts++;
      continue;
    }
    const result = await transport(entry.mutation);
    const next = settle(entry.mutation, result);
    byId.set(entry.mutation.id, next);
    if (next.status === 'synced') synced++;
    else if (next.status === 'conflict') conflicts++;
    else if (next.status === 'rejected') failed++;
  }

  return { queue: [...byId.values()], synced, conflicts, failed };
}

// ── Persistance (sérialisation déterministe pour IndexedDB/localStorage) ──────

/** Sérialise la file dans l'ordre de rejeu (JSON stable). */
export function serializeQueue(queue: PendingMutation[]): string {
  return JSON.stringify(orderQueue(queue));
}

/** Recharge une file persistée (tolère une valeur absente/corrompue → vide). */
export function deserializeQueue(raw: string | null | undefined): PendingMutation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingMutation[]) : [];
  } catch {
    return [];
  }
}
