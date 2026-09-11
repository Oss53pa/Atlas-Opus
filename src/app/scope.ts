/**
 * F1 — résolution du périmètre opération (operation_scope) côté client à partir
 * des lignes ao_operation_members du déployé. Miroir exact de la sémantique RLS
 * (fonction public.ao_user_operations, migration 0034) :
 *   · aucune ligne pour (user, tenant) ⇒ null = toutes les opérations du tenant ;
 *   · au moins une ligne ⇒ périmètre restreint à ces operation_id.
 * Pur (aucune I/O) pour être testable ; l'appel Supabase est fait par providers.
 */

/** Ligne minimale d'appartenance à une opération (table ao_operation_members). */
export interface OperationMemberRow {
  operation_id: string;
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
