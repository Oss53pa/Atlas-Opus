/**
 * Corps du job « recalcul du bilan » côté serveur (Node).
 * Client service_role → parcourt TOUTES les opérations (RLS contournée), puis
 * recalcule tenant par tenant via le moteur TS (Money.ts, invariant §5) et fige
 * un cliché M21. Réutilise les adaptateurs Supabase et l'orchestrateur du domaine
 * — aucune logique métier dupliquée ici. La clé service_role vient de
 * l'environnement (jamais committée).
 */
import { createClient } from '@supabase/supabase-js';
import { createSupabaseBilanRepo, createSupabaseReportingRepo } from '../src/data/supabase/adapter';
import { recomputePortfolio, groupByTenant } from '../src/app/recompute';
import type { Session } from '../src/data/repo';
import type { Operation } from '../src/domain/m1/types';
import type { ReportType } from '../src/domain/m21/reporting';

export interface RunnerConfig {
  url: string;
  serviceRoleKey: string;
  type: ReportType;
  period: string;
}

export interface RunnerSummary {
  tenants: number;
  operations: number;
  snapshots: number;
  at: string;
}

export async function recomputeAllTenants(cfg: RunnerConfig): Promise<RunnerSummary> {
  const client = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.from('ao_operations').select('id, tenant_id');
  if (error) throw new Error(`list_operations_failed: ${error.message}`);
  // Seuls id + tenantId sont requis : les repos relisent devise/BAC par opération.
  const ops = (data ?? []).map((r: { id: string; tenant_id: string }) => ({ id: r.id, tenantId: r.tenant_id } as Operation));

  const byTenant = groupByTenant(ops);
  let operations = 0;
  let snapshots = 0;

  for (const [tenantId, tenantOps] of byTenant) {
    const session: Session = { userId: 'system-recompute', tenantId, role: 'moa_director', operationScope: null };
    const bilan = createSupabaseBilanRepo(client, session);
    const reporting = createSupabaseReportingRepo(client, session);
    const results = await recomputePortfolio({ ops: tenantOps, bilan, reporting }, { type: cfg.type, period: cfg.period });
    operations += tenantOps.length;
    snapshots += results.length;
  }

  return { tenants: byTenant.size, operations, snapshots, at: new Date().toISOString() };
}
