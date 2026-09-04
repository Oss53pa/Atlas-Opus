/**
 * Corps du job « escalades » côté serveur (Node, CLAUDE.md §3).
 * Client service_role → lit toutes les approbations en file (RLS contournée),
 * dérive les escalades ayant franchi un palier de SLA et émet des notifications
 * idempotentes. Chaque item porte son `tenant_id` (issu de l'approbation) : pas
 * de regroupement par tenant nécessaire. Réutilise le moteur/orchestrateur du
 * domaine — rien de dupliqué.
 */
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminRepo } from '../src/data/supabase/adapter';
import { scanEscalations, type EscalationSummary } from '../src/app/escalations';

export interface EscalationRunnerConfig {
  url: string;
  serviceRoleKey: string;
  now?: string;
  levels?: number[];
}

export type EscalationRunnerSummary = EscalationSummary & { at: string };

export async function scanEscalationsAllTenants(cfg: EscalationRunnerConfig): Promise<EscalationRunnerSummary> {
  const client = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createSupabaseAdminRepo(client);
  const summary = await scanEscalations(
    { approvals: admin, admin },
    { now: cfg.now ?? new Date().toISOString(), levels: cfg.levels },
  );
  return { ...summary, at: new Date().toISOString() };
}
