/**
 * F1 — résolution du périmètre opération (operation_scope) côté client à partir
 * des lignes ao_operation_members du déployé. Miroir exact de la sémantique RLS
 * (fonction public.ao_user_operations, migration 0034) :
 *   · aucune ligne pour (user, tenant) ⇒ null = toutes les opérations du tenant ;
 *   · au moins une ligne ⇒ périmètre restreint à ces operation_id.
 * Pur (aucune I/O) pour être testable ; l'appel Supabase est fait par providers.
 */

import { ROLES, type Role } from '../domain/m1/types';

/** Ligne minimale d'appartenance à une opération (table ao_operation_members). */
export interface OperationMemberRow {
  operation_id: string;
}

/** Ligne minimale de rôle (table ao_tenant_roles). */
export interface TenantRoleRow {
  role: string;
}

/**
 * Réduit les rôles ao_tenant_roles d'un utilisateur à un rôle unique pour la
 * session : le plus privilégié (ROLES est ordonné du plus fort `owner` au plus
 * faible `viewer`). Aucun rôle connu ⇒ `fallback` (aujourd'hui `user_tenants.role`),
 * ce qui préserve le comportement courant tant que ao_tenant_roles est vide.
 * Miroir de la source d'autorité de `ao_has_role` (RLS niveau 3, migration 0034).
 */
export function resolveRole(rows: TenantRoleRow[] | null | undefined, fallback: Role): Role {
  if (!rows || rows.length === 0) return fallback;
  let best: Role | null = null;
  let bestRank = ROLES.length; // plus petit index = plus privilégié
  for (const r of rows) {
    const rank = (ROLES as readonly string[]).indexOf(r.role);
    if (rank >= 0 && rank < bestRank) {
      bestRank = rank;
      best = ROLES[rank];
    }
  }
  return best ?? fallback;
}

/**
 * Traduit les lignes d'appartenance en `Session.operationScope`.
 * `null` (aucune ligne) ⇒ périmètre complet du tenant, cohérent avec la RLS.
 */
export function resolveOperationScope(rows: OperationMemberRow[] | null | undefined): string[] | null {
  if (!rows || rows.length === 0) return null;
  // Déduplique en préservant l'ordre (une opération peut apparaître une fois).
  const seen = new Set<string>();
  const scope: string[] = [];
  for (const r of rows) {
    if (r.operation_id && !seen.has(r.operation_id)) {
      seen.add(r.operation_id);
      scope.push(r.operation_id);
    }
  }
  return scope.length > 0 ? scope : null;
}
