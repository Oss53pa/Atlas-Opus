// Edge Function ao-outbox-worker (F5) — vidange de l'outbox.
// Pilotée par cron (pg_cron + pg_net) avec la clé service_role. Draine les
// messages dus de ao_outbox, appelle le tiers via son endpoint, applique la
// machine de livraison (backoff, lettre morte) et le disjoncteur par système.
// Idempotent : chaque message est « réclamé » (pending/retrying → inflight) avant
// appel, donc jamais traité deux fois même en cas d'invocations concurrentes.
import { handler, json, HttpError } from '../_shared/http.ts';
import { requireServiceRole } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { httpDispatch } from '../_shared/transport.ts';
import {
  circuitAllows, deliveryTransition, recordCircuit, type CircuitStatus,
} from '../_shared/f5.ts';

const BATCH = 25;

interface OutboxRow {
  id: string; tenant_id: string; system: string; idempotency_key: string;
  payload: unknown; status: string; attempts: number;
}
interface EndpointRow {
  config: Record<string, unknown> | null; status: string;
  circuit_state: string; circuit_failures: number; circuit_opened_at: string | null;
}

Deno.serve(handler(async (req) => {
  requireServiceRole(req);
  const service = serviceClient();
  const now = new Date().toISOString();

  // Messages dus : pending, ou retrying dont l'échéance est atteinte.
  const { data, error } = await service
    .from('ao_outbox')
    .select('id, tenant_id, system, idempotency_key, payload, status, attempts')
    .or(`status.eq.pending,and(status.eq.retrying,next_attempt_at.lte.${now})`)
    .order('created_at', { ascending: true })
    .limit(BATCH);
  if (error) throw new HttpError(500, 'scan_failed');
  const due = (data ?? []) as OutboxRow[];

  const stats = { scanned: due.length, delivered: 0, retrying: 0, dead: 0, skipped: 0 };

  for (const msg of due) {
    // Endpoint + disjoncteur du couple (tenant, système).
    const { data: epData } = await service
      .from('ao_integration_endpoints')
      .select('config, status, circuit_state, circuit_failures, circuit_opened_at')
      .eq('tenant_id', msg.tenant_id)
      .eq('system', msg.system)
      .maybeSingle();
    const ep = epData as EndpointRow | null;
    const url = ep?.config && typeof ep.config.url === 'string' ? (ep.config.url as string) : null;
    if (!ep || ep.status !== 'active' || !url) {
      stats.skipped++;
      continue; // Pas d'endpoint exploitable : on n'entame pas de tentative.
    }

    const circuit: CircuitStatus = {
      state: (ep.circuit_state as CircuitStatus['state']) ?? 'closed',
      failures: ep.circuit_failures ?? 0,
      openedAt: ep.circuit_opened_at,
    };
    if (!circuitAllows(circuit, now)) {
      stats.skipped++;
      continue; // Disjoncteur ouvert : panne gérée, pas de matraquage.
    }

    // Réclamation optimiste : seul le worker qui bascule inflight traite le message.
    const claim = await service
      .from('ao_outbox')
      .update({ status: 'inflight' })
      .eq('id', msg.id)
      .in('status', ['pending', 'retrying'])
      .select('id');
    if (claim.error || !claim.data || claim.data.length === 0) {
      stats.skipped++;
      continue;
    }

    const outcome = await httpDispatch(url, { idempotency_key: msg.idempotency_key, payload: msg.payload });
    const next = deliveryTransition(msg.attempts, outcome, now);

    await service
      .from('ao_outbox')
      .update({ status: next.status, attempts: next.attempts, last_error: next.lastError, next_attempt_at: next.nextAttemptAt })
      .eq('id', msg.id);

    const nc = recordCircuit(circuit, outcome, now);
    await service
      .from('ao_integration_endpoints')
      .update({ circuit_state: nc.state, circuit_failures: nc.failures, circuit_opened_at: nc.openedAt })
      .eq('tenant_id', msg.tenant_id)
      .eq('system', msg.system);

    if (next.status === 'delivered') stats.delivered++;
    else if (next.status === 'retrying') stats.retrying++;
    else stats.dead++;
  }

  return json({ ok: true, at: now, ...stats });
}));
