// Edge Function ao-accept-invitation (F1 onboarding).
// Relie le compte fraîchement authentifié aux invitations en attente adressées à
// SON email : renseigne ao_members.user_id (+ statut actif) et crée l'appartenance
// tenant (user_tenants) qui fonde l'isolation RLS §5. service_role (contourne la
// RLS) mais SANS confiance au client : on ne lie que les invitations dont l'email
// correspond au JWT du porteur — jamais un tenant fourni par le client.
// Les droits fins (rôles ao_tenant_roles + périmètre ao_operation_members) restent
// attribués par un administrateur via l'écran d'attribution ; le rôle user_tenants
// n'est qu'indicatif (repli), repris de l'invitation.
import { handler, json, HttpError } from '../_shared/http.ts';
import { requireCaller } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/supabase.ts';

interface PendingInvite {
  id: string;
  tenant_id: string;
  role: string;
}

Deno.serve(handler(async (req) => {
  const caller = await requireCaller(req);
  if (!caller.email) throw new HttpError(422, 'no_email');
  const email = caller.email.trim().toLowerCase();
  const service = serviceClient();

  // Invitations en attente pour CET email (jamais un tenant fourni par le client).
  const { data, error } = await service
    .from('ao_members')
    .select('id, tenant_id, role')
    .ilike('email', email)
    .is('user_id', null)
    .eq('status', 'en_attente');
  if (error) throw new HttpError(500, 'lookup_failed');
  const pending = (data ?? []) as PendingInvite[];
  if (pending.length === 0) return json({ ok: true, linked: 0, tenants: [] });

  const tenants: string[] = [];
  for (const m of pending) {
    // 1) Lie l'annuaire au compte et l'active.
    const { error: linkErr } = await service
      .from('ao_members')
      .update({ user_id: caller.userId, status: 'actif' })
      .eq('id', m.id)
      .is('user_id', null); // garde anti-course : ne lie que si encore non liée.
    if (linkErr) throw new HttpError(500, 'link_failed');
    // 2) Devient membre du tenant (base de l'isolation RLS). Idempotent.
    const { error: mtErr } = await service
      .from('user_tenants')
      .upsert({ user_id: caller.userId, tenant_id: m.tenant_id, role: m.role }, { onConflict: 'user_id,tenant_id' });
    if (mtErr) throw new HttpError(500, 'membership_failed');
    tenants.push(m.tenant_id);
  }

  return json({ ok: true, linked: pending.length, tenants });
}));
