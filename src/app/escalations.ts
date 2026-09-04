/**
 * Job « escalades » (F7 → F4), orchestration réutilisable.
 * Piloté par pg_cron / BullMQ (CLAUDE.md §3) via le runner. Lit les approbations
 * en file, dérive les escalades ayant franchi un palier de SLA et émet des
 * notifications **idempotentes** (clé de dédoublonnage à palier). Un rejeu
 * n'ajoute rien tant qu'aucun nouveau seuil n'est franchi.
 */
import type { AdminRepo } from '../data/repo';
import { deriveEscalations, escalationsToNotifications } from '../domain/f7/escalations';

export interface EscalationDeps {
  approvals: Pick<AdminRepo, 'approvals'>;
  admin: Pick<AdminRepo, 'upsertNotification'>;
}

export interface EscalationOptions {
  now: string;
  levels?: readonly number[];
}

export interface EscalationSummary {
  approvals: number;
  escalations: number;
  created: number;
  existing: number;
}

/** Scanne les approbations et émet les relances d'escalade (idempotentes). */
export async function scanEscalations(deps: EscalationDeps, opts: EscalationOptions): Promise<EscalationSummary> {
  const approvals = await deps.approvals.approvals();
  const items = deriveEscalations({ approvals, now: opts.now, levels: opts.levels });

  let created = 0;
  for (const notif of escalationsToNotifications(items, opts.now)) {
    const res = await deps.admin.upsertNotification(notif);
    if (res.created) created++;
  }

  return { approvals: approvals.length, escalations: items.length, created, existing: items.length - created };
}
