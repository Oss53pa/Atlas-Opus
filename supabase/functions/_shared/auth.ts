// Authentification + autorisation des Edge Functions (CLAUDE.md §5).
// La RLS étant contournée par le service_role, le rôle est REvérifié ici, lié
// au tenant de la ressource visée (défense en profondeur : on ne fait jamais
// confiance à un tenant_id fourni par le client).
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { HttpError } from './http.ts';
import { callerClient } from './supabase.ts';

export interface Caller {
  userId: string;
}

/** Valide le JWT du porteur et renvoie son identité. 401 si absent/invalide. */
export async function requireCaller(req: Request): Promise<Caller> {
  const { data, error } = await callerClient(req).auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'unauthenticated');
  return { userId: data.user.id };
}

/**
 * Résout le rôle du porteur DANS le tenant de la ressource et vérifie qu'il
 * fait partie des rôles autorisés. Renvoie le rôle. 403 sinon.
 * `service` doit être le client service_role (lecture de user_tenants fiable).
 */
export async function requireRoleForTenant(
  service: SupabaseClient,
  userId: string,
  tenantId: string,
  allowed: readonly string[],
): Promise<string> {
  const { data, error } = await service
    .from('user_tenants')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new HttpError(500, 'membership_lookup_failed');
  if (!data) throw new HttpError(403, 'not_a_member');
  const role = (data as { role: string | null }).role ?? 'viewer';
  if (!allowed.includes(role)) throw new HttpError(403, 'forbidden_role');
  return role;
}

/** Extrait un champ chaîne obligatoire du corps JSON (422 si manquant). */
export function requireString(body: unknown, key: string): string {
  const v = (body as Record<string, unknown> | null)?.[key];
  if (typeof v !== 'string' || v.length === 0) throw new HttpError(422, `missing_${key}`);
  return v;
}
