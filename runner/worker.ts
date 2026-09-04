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
import type { ReportType } from '../src/domain/m21/reporting';

const QUEUE = 'ao-bilan-recompute';
const CRON = process.env.RECOMPUTE_CRON ?? '0 2 * * *';

function connection(): IORedis {
  // maxRetriesPerRequest: null requis par BullMQ.
  return new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing_env_${name}`);
  return v;
}

async function runJob(): Promise<RunnerSummary> {
  return recomputeAllTenants({
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    type: (process.env.RECOMPUTE_TYPE ?? 'mensuel') as ReportType,
    period: process.env.RECOMPUTE_PERIOD ?? new Date().toISOString().slice(0, 7),
  });
}

/** Enregistre (ou met à jour) le planificateur de job répétable (BullMQ v6). */
export async function schedule(): Promise<void> {
  const queue = new Queue(QUEUE, { connection: connection() });
  await queue.upsertJobScheduler(
    'nightly',
    { pattern: CRON },
    { name: 'recompute', opts: { removeOnComplete: true, removeOnFail: 100 } },
  );
  await queue.close();
}

/** Démarre le worker qui exécute les jobs de la file. */
export function startWorker(): Worker {
  const worker = new Worker(
    QUEUE,
    async (job: Job) => {
      const summary = await runJob();
      console.log('[recompute:worker]', job.id, JSON.stringify(summary));
      return summary;
    },
    { connection: connection() },
  );
  worker.on('failed', (job, err) => console.error('[recompute:worker] échec', job?.id, err));
  return worker;
}

// Exécution directe : planifie puis écoute.
if (import.meta.url === `file://${process.argv[1]}`) {
  schedule()
    .then(() => {
      startWorker();
      console.log(`[recompute:worker] prêt — cron « ${CRON} »`);
    })
    .catch((e) => {
      console.error('[recompute:worker] démarrage impossible', e);
      process.exit(1);
    });
}
