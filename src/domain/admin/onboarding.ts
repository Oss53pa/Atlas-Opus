/**
 * F1 — Attribution des droits (rôles + périmètre opération) · règles pures.
 * Ces helpers cadrent les écritures dans les tables d'enforcement du déployé
 * (ao_tenant_roles, ao_operation_members ; migrations 0034/0035), miroir de
 * `resolveRole`/`resolveOperationScope` côté session.
 *
 * NB §5/§4 : l'attribution de droits est une écriture SENSIBLE, en ligne
 * uniquement — elle n'est jamais capturée hors-ligne (pas de transport F3).
 * Aucune dépendance UI/IO.
 */
import { ROLES, type Role } from '../m1/types';
import type { GrantValidation, MemberGrantInput } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalise un périmètre : déduplique en préservant l'ordre ; `[]`/null ⇒ null
 * (= toutes les opérations du tenant, sémantique ao_operation_members vide).
 */
export function normalizeScope(ids: readonly string[] | null | undefined): string[] | null {
  if (!ids || ids.length === 0) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.length > 0 ? out : null;
}

/**
 * Rôle effectif d'un ensemble de rôles : le plus privilégié selon l'ordre de
 * ROLES (owner … viewer). Ignore les rôles inconnus. `[]` ⇒ null.
 */
export function effectiveRole(roles: readonly Role[]): Role | null {
  let best: Role | null = null;
  let bestRank = ROLES.length;
  for (const role of roles) {
    const rank = (ROLES as readonly string[]).indexOf(role);
    if (rank >= 0 && rank < bestRank) {
      bestRank = rank;
      best = ROLES[rank];
    }
  }
  return best;
}

/** Vrai si toutes les valeurs sont des rôles connus (vocabulaire canonique). */
export function areRolesKnown(roles: readonly string[]): boolean {
  return roles.every((r) => (ROLES as readonly string[]).includes(r));
}

/**
 * Valide une saisie d'attribution : utilisateur cible, au moins un rôle, et
 * rôles tous connus. (Le périmètre est libre : null = toutes.)
 */
export function validateGrantInput(input: MemberGrantInput): GrantValidation {
  const errors: string[] = [];
  if (!input.userId || !input.userId.trim()) errors.push('userId requis');
  if (!input.roles || input.roles.length === 0) errors.push('au moins un rôle requis');
  else if (!areRolesKnown(input.roles)) errors.push('rôle inconnu (hors vocabulaire)');
  return { ok: errors.length === 0, errors };
}

/** Valide un email d'invitation (forme). */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Résumé lisible d'un périmètre pour l'affichage. */
export function scopeSummary(scope: string[] | null): string {
  if (scope === null || scope.length === 0) return 'Toutes les opérations';
  if (scope.length === 1) return '1 opération';
  return `${scope.length} opérations`;
}
