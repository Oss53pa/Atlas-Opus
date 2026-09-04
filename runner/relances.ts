/**
 * Entrée « one-shot » des relances & échéances — pour un cron simple ou pg_cron
 * (via wrapper). Émet les notifications d'échéance (assurances/cautions) et sort
 * en erreur si le passage échoue.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run relances:once
 *
 * Variables : RELANCES_TODAY (défaut : aujourd'hui AAAA-MM-JJ),
 *             RELANCES_WINDOW_DAYS (fenêtre d'alerte, défaut 30).
 */
import { scanEcheancesAllTenants } from './scanEcheancesAllTenants.ts';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[relances] variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return v;
}

const cfg = {
  url: requireEnv('SUPABASE_URL'),
  serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  today: process.env.RELANCES_TODAY,
  warningDays: process.env.RELANCES_WINDOW_DAYS ? Number(process.env.RELANCES_WINDOW_DAYS) : undefined,
};

scanEcheancesAllTenants(cfg)
  .then((summary) => {
    console.log('[relances]', JSON.stringify(summary));
    process.exit(0);
  })
  .catch((e) => {
    console.error('[relances] échec', e);
    process.exit(1);
  });
