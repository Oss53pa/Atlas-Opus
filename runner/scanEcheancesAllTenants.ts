/**
 * Corps du job « relances & échéances » côté serveur (Node, CLAUDE.md §3).
 * Client service_role → parcourt toutes les opérations (RLS contournée), regroupe
 * par tenant, puis émet les relances d'échéance (assurances M7 + cautions M17)
 * via `scanEcheances` — notifications idempotentes (clé de dédoublonnage).
 * Réutilise les adaptateurs Supabase et le moteur du domaine ; rien de dupliqué.
 */
import { createClient } from '@supabase/supabase-js';
import {
  createSupabaseComplianceRepo,
  createSupabaseGuaranteesRepo,
  createSupabaseAdminRepo,
} from '../src/data/supabase/adapter';
import { scanEcheances } from '../src/app/echeances';
import { groupByTenant } from '../src/app/recompute';
import type { Session } from '../src/data/repo';
import type { Operation } from '../src/domain/m1/types';

export interface EcheanceRunnerConfig {
  url: string;
  serviceRoleKey: string;
  today?: string;
  warningDays?: number;
}

export interface EcheanceRunnerSummary {
  tenants: number;
  operations: number;
  items: number;
  created: number;
  existing: number;
  at: string;
}

export async function scanEcheancesAllTenants(cfg: EcheanceRunnerConfig): Promise<EcheanceRunnerSummary> {
  const client = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const today = cfg.today ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await client.from('ao_operations').select('id, tenant_id');
  if (error) throw new Error(`list_operations_failed: ${error.message}`);
  const ops = (data ?? []).map((r: { id: string; tenant_id: string }) => ({ id: r.id, tenantId: r.tenant_id } as Operation));

  const byTenant = groupByTenant(ops);
  const total: EcheanceRunnerSummary = { tenants: byTenant.size, operations: 0, items: 0, created: 0, existing: 0, at: new Date().toISOString() };

  for (const [tenantId, tenantOps] of byTenant) {
    const session: Session = { userId: 'system-echeances', tenantId, role: 'moa_director', operationScope: null };
    const summary = await scanEcheances(
      {
        ops: tenantOps,
        compliance: createSupabaseComplianceRepo(client, session),
        guarantees: createSupabaseGuaranteesRepo(client, session),
        admin: createSupabaseAdminRepo(client),
      },
      { today, warningDays: cfg.warningDays },
    );
    total.operations += summary.operations;
    total.items += summary.items;
    total.created += summary.created;
    total.existing += summary.existing;
  }

  return total;
}
