/**
 * Entrée « one-shot » du recalcul du bilan — pour un cron simple ou pg_cron
 * (via un wrapper shell/HTTP). Lit la configuration depuis l'environnement,
 * exécute un passage et sort avec un code non nul en cas d'échec.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run recompute:once
 *
 * Variables : RECOMPUTE_TYPE (hebdo|mensuel|deep_dive, défaut mensuel),
 *             RECOMPUTE_PERIOD (défaut : mois courant AAAA-MM).
 */
import { recomputeAllTenants } from './recomputeAllTenants.ts';
import type { ReportType } from '../src/domain/m21/reporting';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[recompute] variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return v;
}

const cfg = {
  url: requireEnv('SUPABASE_URL'),
  serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  type: (process.env.RECOMPUTE_TYPE ?? 'mensuel') as ReportType,
  period: process.env.RECOMPUTE_PERIOD ?? new Date().toISOString().slice(0, 7),
};

recomputeAllTenants(cfg)
  .then((summary) => {
    console.log('[recompute]', JSON.stringify(summary));
    process.exit(0);
  })
  .catch((e) => {
    console.error('[recompute] échec', e);
    process.exit(1);
  });
