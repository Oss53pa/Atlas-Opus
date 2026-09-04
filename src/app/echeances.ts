/**
 * Job « relances & échéances » (F4), orchestration réutilisable.
 * Piloté par pg_cron / BullMQ (CLAUDE.md §3) via le runner. Pour chaque
 * opération : lit les assurances (M7) et cautions (M17), dérive les échéances
 * imminentes/dépassées (moteur pur `deriveEcheances`) et émet des notifications
 * **idempotentes** (clé de dédoublonnage). Un rejeu n'ajoute rien tant que le
 * palier (imminente/dépassée) ne change pas.
 */
import type { AdminRepo, ComplianceRepo, GuaranteesRepo } from '../data/repo';
import type { Operation } from '../domain/m1/types';
import { deriveEcheances, echeancesToNotifications, type EcheanceItem } from '../domain/f4/echeances';

export interface EcheanceDeps {
  ops: Operation[];
  compliance: Pick<ComplianceRepo, 'insurances'>;
  guarantees: Pick<GuaranteesRepo, 'list'>;
  admin: Pick<AdminRepo, 'upsertNotification'>;
}

export interface EcheanceOptions {
  today: string;
  warningDays?: number;
}

export interface EcheanceSummary {
  operations: number;
  items: number;
  created: number;
  existing: number;
}

/** Scanne le portefeuille et émet les relances d'échéance (idempotentes). */
export async function scanEcheances(deps: EcheanceDeps, opts: EcheanceOptions): Promise<EcheanceSummary> {
  const all: EcheanceItem[] = [];
  for (const op of deps.ops) {
    const [insurances, guarantees] = await Promise.all([deps.compliance.insurances(op.id), deps.guarantees.list(op.id)]);
    all.push(...deriveEcheances({ insurances, guarantees, today: opts.today, warningDays: opts.warningDays }));
  }

  let created = 0;
  for (const notif of echeancesToNotifications(all, opts.today)) {
    const res = await deps.admin.upsertNotification(notif);
    if (res.created) created++;
  }

  return { operations: deps.ops.length, items: all.length, created, existing: all.length - created };
}
