// Edge Function ao-passation (M8) — avance sensible d'un marché.
// service_role : contourne la RLS pour écrire, APRÈS revérification du rôle
// (procurement / moa_director / owner) et garde de la machine à états
// planned → published → opened → evaluated → awarded → notified. Trace auditée.
import { handler, json, HttpError } from '../_shared/http.ts';
import { requireCaller, requireRoleForTenant, requireString } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { guardLinear } from '../_shared/transition.ts';
import { appendAudit } from '../_shared/audit.ts';

const TENDER_STATUSES = ['planned', 'published', 'opened', 'evaluated', 'awarded', 'notified'] as const;
type TenderStatus = (typeof TENDER_STATUSES)[number];
const ALLOWED_ROLES = ['owner', 'moa_director', 'procurement'] as const;

Deno.serve(handler(async (req, body) => {
  const caller = await requireCaller(req);
  const service = serviceClient();
  const tenderId = requireString(body, 'tenderId');
  const target = (body as Record<string, unknown>).targetStatus as TenderStatus | undefined;
  const awardedTo = (body as Record<string, unknown>).awardedTo as string | undefined;

  const { data: tender, error } = await service
    .from('ao_tenders')
    .select('id, tenant_id, operation_id, status')
    .eq('id', tenderId)
    .maybeSingle();
  if (error) throw new HttpError(500, 'load_failed');
  if (!tender) throw new HttpError(404, 'tender_not_found');
  const t = tender as { tenant_id: string; operation_id: string; status: TenderStatus };

  await requireRoleForTenant(service, caller.userId, t.tenant_id, ALLOWED_ROLES);

  const to = guardLinear(TENDER_STATUSES, t.status, target);
  // À partir de « awarded », le titulaire est requis (RG-M8).
  if (to === 'awarded' && !awardedTo) throw new HttpError(422, 'awarded_to_required');

  const patch: Record<string, unknown> = { status: to };
  if (to === 'awarded' && awardedTo) patch.awarded_to = awardedTo;

  const { error: upErr } = await service.from('ao_tenders').update(patch).eq('id', tenderId);
  if (upErr) throw new HttpError(500, 'update_failed');

  await appendAudit(service, {
    tenantId: t.tenant_id,
    operationId: t.operation_id,
    actor: caller.userId,
    action: 'transition',
    module: 'M8',
    object: `tender:${tenderId}`,
    summary: `${t.status}→${to}`,
  });

  return json({ ok: true, id: tenderId, status: to });
}));
