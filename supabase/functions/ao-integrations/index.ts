// Edge Function ao-integrations (F5) — dépose une intention sortante dans l'outbox.
// Deux propriétés du contrat garanties côté serveur :
//  · idempotence — clé (system, kind, businessId) unique par tenant ; un rejeu au
//    contenu identique renvoie l'existant, un rejeu au contenu divergent → 409 ;
//  · panne gérée — l'outbox porte statut/backoff/lettre morte (livraison par worker).
// service_role, rôle financier revérifié, opération liée pour l'isolation + l'audit.
import { handler, json, HttpError } from '../_shared/http.ts';
import { requireCaller, requireRoleForTenant, requireString } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { sha256Hex, stableStringify } from '../_shared/hash.ts';
import { appendAudit } from '../_shared/audit.ts';

const INTEGRATION_SYSTEMS = ['atlas_finance', 'advist', 'cinetpay', 'atlas_lease', 'keystone', 'duedeck'] as const;
type IntegrationSystem = (typeof INTEGRATION_SYSTEMS)[number];
const ALLOWED_ROLES = ['owner', 'moa_director', 'finance'] as const;

Deno.serve(handler(async (req, body) => {
  const caller = await requireCaller(req);
  const service = serviceClient();
  const b = body as Record<string, unknown>;

  const system = requireString(body, 'system') as IntegrationSystem;
  if (!INTEGRATION_SYSTEMS.includes(system)) throw new HttpError(422, 'unknown_system');
  const kind = requireString(body, 'kind');
  const businessId = requireString(body, 'businessId');
  const operationId = requireString(body, 'operationId');
  const payload = (b.payload ?? {}) as unknown;

  // Tenant dérivé de l'opération (jamais fourni par le client).
  const { data: op, error: opErr } = await service
    .from('ao_operations')
    .select('id, tenant_id')
    .eq('id', operationId)
    .maybeSingle();
  if (opErr) throw new HttpError(500, 'load_failed');
  if (!op) throw new HttpError(404, 'operation_not_found');
  const tenantId = (op as { tenant_id: string }).tenant_id;

  await requireRoleForTenant(service, caller.userId, tenantId, ALLOWED_ROLES);

  const idempotencyKey = `${system}:${kind}:${businessId}`;
  const hash = await sha256Hex(stableStringify(payload));

  // Idempotence : intention déjà déposée ?
  const { data: existing, error: exErr } = await service
    .from('ao_outbox')
    .select('id, payload_hash, status')
    .eq('tenant_id', tenantId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (exErr) throw new HttpError(500, 'lookup_failed');
  if (existing) {
    const ex = existing as { id: string; payload_hash: string; status: string };
    if (ex.payload_hash !== hash) throw new HttpError(409, 'idempotency_conflict');
    return json({ ok: true, id: ex.id, status: ex.status, deduplicated: true });
  }

  const id = crypto.randomUUID();
  const { error: insErr } = await service.from('ao_outbox').insert({
    id,
    tenant_id: tenantId,
    operation_id: operationId,
    system,
    kind,
    business_id: businessId,
    idempotency_key: idempotencyKey,
    payload,
    payload_hash: hash,
    status: 'pending',
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
  });
  if (insErr) {
    // Course : une insertion concurrente a gagné → traiter en idempotent.
    if ((insErr as { code?: string }).code === '23505') {
      return json({ ok: true, status: 'pending', deduplicated: true });
    }
    throw new HttpError(500, 'enqueue_failed');
  }

  await appendAudit(service, {
    tenantId,
    operationId,
    actor: caller.userId,
    action: 'create',
    module: 'F5',
    object: `outbox:${system}:${kind}`,
    summary: businessId,
  });

  return json({ ok: true, id, status: 'pending', deduplicated: false });
}));
