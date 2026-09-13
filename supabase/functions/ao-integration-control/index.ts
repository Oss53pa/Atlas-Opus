// Edge Function ao-integration-control (F5) — actions d'exploitation sur les
// intégrations : rejeu d'une lettre morte (outbox) et réarmement d'un disjoncteur.
// service_role (contourne la RLS pour écrire) APRÈS revérification du rôle
// (owner / moa_director) lié au tenant de la ressource. Actions sensibles, en
// ligne uniquement. Réf CLAUDE.md §5 (garde de rôle) / §8 (F5).
import { handler, json, HttpError } from '../_shared/http.ts';
import { requireCaller, requireRoleForTenant, requireString } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/supabase.ts';

const ALLOWED_ROLES = ['owner', 'moa_director'] as const;
// Rejeu manuel possible seulement depuis un échec (miroir de canManualRetry côté client).
const RETRIABLE = ['dead', 'retrying'];

Deno.serve(handler(async (req, body) => {
  const caller = await requireCaller(req);
  const service = serviceClient();
  const action = requireString(body, 'action');

  if (action === 'retry') {
    const outboxId = requireString(body, 'outboxId');
    const { data: row, error } = await service
      .from('ao_outbox').select('id, tenant_id, status').eq('id', outboxId).maybeSingle();
    if (error) throw new HttpError(500, 'load_failed');
    if (!row) throw new HttpError(404, 'outbox_not_found');
    const r = row as { tenant_id: string; status: string };
    await requireRoleForTenant(service, caller.userId, r.tenant_id, ALLOWED_ROLES);
    if (!RETRIABLE.includes(r.status)) throw new HttpError(409, `not_retriable:${r.status}`);
    // Réenfile : pending, prochaine tentative immédiate, budget de reprise remis à zéro.
    const { data: upd, error: upErr } = await service
      .from('ao_outbox')
      .update({ status: 'pending', attempts: 0, last_error: null, next_attempt_at: null })
      .eq('id', outboxId).select('*').single();
    if (upErr) throw new HttpError(500, 'update_failed');
    return json({ ok: true, outbox: upd });
  }

  if (action === 'reset_circuit') {
    const endpointId = requireString(body, 'endpointId');
    const { data: row, error } = await service
      .from('ao_integration_endpoints').select('id, tenant_id').eq('id', endpointId).maybeSingle();
    if (error) throw new HttpError(500, 'load_failed');
    if (!row) throw new HttpError(404, 'endpoint_not_found');
    const e = row as { tenant_id: string };
    await requireRoleForTenant(service, caller.userId, e.tenant_id, ALLOWED_ROLES);
    const { data: upd, error: upErr } = await service
      .from('ao_integration_endpoints')
      .update({ circuit_state: 'closed', circuit_failures: 0, circuit_opened_at: null })
      .eq('id', endpointId).select('*').single();
    if (upErr) throw new HttpError(500, 'update_failed');
    return json({ ok: true, endpoint: upd });
  }

  throw new HttpError(422, 'unknown_action');
}));
