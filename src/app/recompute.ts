/**
 * Job « recalcul du bilan » (M4 → M21), orchestration réutilisable.
 * Pilotée par pg_cron / BullMQ (CLAUDE.md §3) OU appelable depuis le cockpit.
 * Le calcul monétaire reste en TypeScript (Money.ts, invariant §5) : le job
 * s'exécute donc dans un runtime TS (back métier NestJS / script Node), jamais
 * en SQL ni côté LLM. Pour chaque opération : recalcul déterministe puis gel des
 * indicateurs financiers dans un cliché M21 (RG-M21-01 — le reporting ne
 * recalcule rien, il fige ce résultat).
 */
import type { BilanRepo, ReportingRepo } from '../data/repo';
import type { Operation } from '../domain/m1/types';
import type { ReportSnapshot, ReportType } from '../domain/m21/reporting';
import { bilanRecomputeToReportData, type BilanRecompute, type RecomputeExtras } from '../domain/finance/recompute';

const NO_EXTRAS: RecomputeExtras = { progress: 0, alertsDanger: 0, alertsEcheance: 0 };

export interface RecomputeDeps {
  ops: Operation[];
  bilan: Pick<BilanRepo, 'recompute'>;
  reporting: Pick<ReportingRepo, 'generate'>;
}

export interface RecomputeOptions {
  type: ReportType;
  period: string;
  /** Indicateurs non financiers (avancement, alertes) par opération. */
  extras?: (operationId: string) => RecomputeExtras;
}

export interface RecomputeResult {
  operationId: string;
  recompute: BilanRecompute;
  snapshot: ReportSnapshot;
}

/**
 * Recalcule le bilan de chaque opération et fige un cliché M21. Les opérations
 * sans bilan (recompute null) sont ignorées. Renvoie les résultats produits.
 */
export async function recomputePortfolio(deps: RecomputeDeps, opts: RecomputeOptions): Promise<RecomputeResult[]> {
  const results: RecomputeResult[] = [];
  for (const op of deps.ops) {
    const recompute = await deps.bilan.recompute(op.id);
    if (!recompute) continue;
    const data = bilanRecomputeToReportData(recompute, opts.extras?.(op.id) ?? NO_EXTRAS);
    const snapshot = await deps.reporting.generate(op.id, { type: opts.type, period: opts.period, data });
    results.push({ operationId: op.id, recompute, snapshot });
  }
  return results;
}
