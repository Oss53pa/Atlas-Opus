// Edge Function ao-mandatement (M15) — avance sensible d'un décompte.
// Couvre le mandatement et la mise en paiement : machine draft → validated →
// mandated → paid. service_role, mais rôle financier revérifié
// (finance / moa_director / owner) et transition gardée. Trace auditée.
import { handler, json, HttpError } from '../_shared/http.ts';
import { requireCaller, requireRoleForTenant, requireString } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { guardLinear } from '../_shared/transition.ts';
import { appendAudit } from '../_shared/audit.ts';

const DECOMPTE_STATUSES = ['draft', 'validated', 'mandated', 'paid'] as const;
type DecompteStatus = (typeof DECOMPTE_STATUSES)[number];
const ALLOWED_ROLES = ['owner', 'moa_director', 'finance'] as const;

Deno.serve(handler(async (req, body) => {
  const caller = await requireCaller(req);
  const service = serviceClient();
  const decompteId = requireString(body, 'decompteId');
  const target = (body as Record<string, unknown>).targetStatus as DecompteStatus | undefined;

  const { data: decompte, error } = await service
    .from('ao_decomptes')
    .select('id, tenant_id, operation_id, number, status')
    .eq('id', decompteId)
    .maybeSingle();
  if (error) throw new HttpError(500, 'load_failed');
  if (!decompte) throw new HttpError(404, 'decompte_not_found');
  const d = decompte as { tenant_id: string; operation_id: string; number: number; status: DecompteStatus };

  await requireRoleForTenant(service, caller.userId, d.tenant_id, ALLOWED_ROLES);

  const to = guardLinear(DECOMPTE_STATUSES, d.status, target);

  const { error: upErr } = await service.from('ao_decomptes').update({ status: to }).eq('id', decompteId);
  if (upErr) throw new HttpError(500, 'update_failed');

  await appendAudit(service, {
    tenantId: d.tenant_id,
    operationId: d.operation_id,
    actor: caller.userId,
    action: 'transition',
    module: 'M15',
    object: `decompte:${d.number}`,
    summary: `${d.status}→${to}`,
  });

  return json({ ok: true, id: decompteId, status: to });
}));
