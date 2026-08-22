/**
 * M2 — Autorisations administratives (réf Spec M2 §3/§4/§5), domaine pur.
 * Machine : draft → submitted → granted | refused.
 * Fournit la garde « permis » consommée par la transition M1 → réalisation
 * (RG-M2-07), même forme de résultat que la garde DO (M7).
 */

export const AUTHORIZATION_TYPES = ['permis_construire', 'autorisation_env', 'conformite'] as const;
export type AuthorizationType = (typeof AUTHORIZATION_TYPES)[number];

export const AUTHORIZATION_STATUSES = ['draft', 'submitted', 'granted', 'refused'] as const;
export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];

export interface Authorization {
  id: string;
  tenantId: string;
  operationId: string;
  type: AuthorizationType;
  authority: string;
  status: AuthorizationStatus;
  /** Date de fin de validité (ISO) — optionnelle (RG-M2-09). */
  validity: string | null;
}

/** Saisie de création d'une autorisation (écran conformité). */
export interface AuthorizationInput {
  type: AuthorizationType;
  authority: string;
  validity?: string | null;
}

const TRANSITIONS: Record<AuthorizationStatus, AuthorizationStatus[]> = {
  draft: ['submitted'],
  submitted: ['granted', 'refused'],
  granted: [],
  refused: [],
};

export function canTransitionAuthorization(from: AuthorizationStatus, to: AuthorizationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Une autorisation « granted » et non expirée à la date donnée est effective. */
export function isAuthorizationEffective(auth: Pick<Authorization, 'status' | 'validity'>, today: string): boolean {
  if (auth.status !== 'granted') return false;
  if (!auth.validity) return true;
  return Date.parse(auth.validity) >= Date.parse(today);
}

/** Résultat de garde réutilisable (même forme que doGate M7 et foncier-gate M2). */
export interface GateResult {
  ok: boolean;
  blocking: AuthorizationType[];
}

/**
 * RG-M2-07 — Garde permis : un permis de construire « granted » (et non expiré)
 * est requis avant la phase « réalisation » (transition M1). Renvoie le permis
 * comme condition bloquante s'il est absent, non accordé ou expiré.
 */
export function permitGate(authorizations: Pick<Authorization, 'type' | 'status' | 'validity'>[], today: string): GateResult {
  const permits = authorizations.filter((a) => a.type === 'permis_construire');
  const granted = permits.some((a) => isAuthorizationEffective(a, today));
  return { ok: granted, blocking: granted ? [] : ['permis_construire'] };
}

/** RG-M2-09 — Une autorisation « granted » dont la validité approche (≤ jours) ou est dépassée. */
export function isAuthorizationExpiring(
  auth: Pick<Authorization, 'status' | 'validity'>,
  today: string,
  warningDays = 30,
): boolean {
  if (auth.status !== 'granted' || !auth.validity) return false;
  const remaining = Math.floor((Date.parse(auth.validity) - Date.parse(today)) / 86_400_000);
  return remaining <= warningDays;
}
