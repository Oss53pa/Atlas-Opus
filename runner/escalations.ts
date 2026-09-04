/**
 * Entrée « one-shot » des escalades — pour un cron simple ou pg_cron (via wrapper).
 * Émet les relances d'escalade des approbations en souffrance.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run escalations:once
 *
 * Variables : ESCALATION_NOW (défaut : maintenant ISO),
 *             ESCALATION_LEVELS (jours séparés par des virgules, défaut « 3,7,14 »).
 */
import { scanEscalationsAllTenants } from './scanEscalationsAllTenants.ts';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[escalations] variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return v;
}

const levelsRaw = process.env.ESCALATION_LEVELS;
const cfg = {
  url: requireEnv('SUPABASE_URL'),
  serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  now: process.env.ESCALATION_NOW,
  levels: levelsRaw ? levelsRaw.split(',').map((s) => Number(s.trim())) : undefined,
};

scanEscalationsAllTenants(cfg)
  .then((summary) => {
    console.log('[escalations]', JSON.stringify(summary));
    process.exit(0);
  })
  .catch((e) => {
    console.error('[escalations] échec', e);
    process.exit(1);
  });
