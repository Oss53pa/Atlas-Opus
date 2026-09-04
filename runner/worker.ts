/**
 * Ordonnanceur BullMQ + Redis (CLAUDE.md §3) pour le recalcul du bilan.
 * Un job répétable (cron) déclenche `recomputeAllTenants`. Alternative « lourde »
 * au one-shot pg_cron : file d'attente, reprises, observabilité.
 *
 *   REDIS_URL=redis://… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run recompute:worker
 *
 * Variable : RECOMPUTE_CRON (défaut « 0 2 * * * » — 02:00 chaque jour).
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { recomputeAllTenants, type RunnerSummary } from './recomputeAllTenants.ts';
import { scanEcheancesAllTenants, type EcheanceRunnerSummary } from './scanEcheancesAllTenants.ts';
import type { ReportType } from '../src/domain/m21/reporting';

const QUEUE = 'ao-scheduled-jobs';
const RECOMPUTE_CRON = process.env.RECOMPUTE_CRON ?? '0 2 * * *';
const RELANCES_CRON = process.env.RELANCES_CRON ?? '0 6 * * *';

function connection(): IORedis {
  // maxRetriesPerRequest: null requis par BullMQ.
  return new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing_env_${name}`);
  return v;
}

function runRecompute(): Promise<RunnerSummary> {
  return recomputeAllTenants({
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    type: (process.env.RECOMPUTE_TYPE ?? 'mensuel') as ReportType,
    period: process.env.RECOMPUTE_PERIOD ?? new Date().toISOString().slice(0, 7),
  });
}

function runRelances(): Promise<EcheanceRunnerSummary> {
  return scanEcheancesAllTenants({
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    today: process.env.RELANCES_TODAY,
    warningDays: process.env.RELANCES_WINDOW_DAYS ? Number(process.env.RELANCES_WINDOW_DAYS) : undefined,
  });
}

/** Enregistre (ou met à jour) les planificateurs de jobs répétables (BullMQ v6). */
export async function schedule(): Promise<void> {
  const queue = new Queue(QUEUE, { connection: connection() });
  const opts = { removeOnComplete: true, removeOnFail: 100 };
  await queue.upsertJobScheduler('nightly-recompute', { pattern: RECOMPUTE_CRON }, { name: 'recompute', opts });
  await queue.upsertJobScheduler('daily-relances', { pattern: RELANCES_CRON }, { name: 'relances', opts });
  await queue.close();
}

/** Démarre le worker qui exécute les jobs planifiés (recalcul + relances). */
export function startWorker(): Worker {
  const worker = new Worker(
    QUEUE,
    async (job: Job) => {
      const summary = job.name === 'relances' ? await runRelances() : await runRecompute();
      console.log(`[worker:${job.name}]`, job.id, JSON.stringify(summary));
      return summary;
    },
    { connection: connection() },
  );
  worker.on('failed', (job, err) => console.error(`[worker:${job?.name}] échec`, job?.id, err));
  return worker;
}

// Exécution directe : planifie puis écoute.
if (import.meta.url === `file://${process.argv[1]}`) {
  schedule()
    .then(() => {
      startWorker();
      console.log(`[worker] prêt — recompute « ${RECOMPUTE_CRON} », relances « ${RELANCES_CRON} »`);
    })
    .catch((e) => {
      console.error('[recompute:worker] démarrage impossible', e);
      process.exit(1);
    });
}
