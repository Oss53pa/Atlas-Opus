/**
 * M7 — Règles de gestion RG-M7-02 à 09 (réf Spec M7 §5), pures et testables.
 * Statuts d'assurance, assurances obligatoires, garde DO (→ M1), RACI,
 * cumul des honoraires (→ M4). Tout montant via Money.ts.
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import type {
  Insurance,
  InsuranceStatus,
  InsuranceType,
  RaciAssignment,
  StakeholderContract,
  StakeholderType,
} from './types';

/** Fenêtre d'alerte d'échéance par défaut (RG-M7 §4 : ≤ 30 j → « expiring »). */
export const EXPIRY_WARNING_DAYS = 30;

/** Différence en jours pleins entre deux dates ISO (b − a). */
function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  return Math.floor((b - a) / 86_400_000);
}

/**
 * §4 — Statut d'une police présente : valid (> fenêtre), expiring (≤ fenêtre),
 * expired (échéance dépassée). Une police sans `validTo` est considérée valide.
 * L'absence de police relève de `missing` (voir missingMandatoryInsurances).
 */
export function insuranceStatus(
  ins: Pick<Insurance, 'validTo'>,
  today: string,
  warningDays = EXPIRY_WARNING_DAYS,
): Exclude<InsuranceStatus, 'missing'> {
  if (!ins.validTo) return 'valid';
  const remaining = daysBetween(today, ins.validTo);
  if (remaining < 0) return 'expired';
  if (remaining <= warningDays) return 'expiring';
  return 'valid';
}

/** Une police est-elle couvrante (valid ou expiring) à la date donnée ? */
export function isCovering(ins: Pick<Insurance, 'validTo'>, today: string, warningDays = EXPIRY_WARNING_DAYS): boolean {
  const s = insuranceStatus(ins, today, warningDays);
  return s === 'valid' || s === 'expiring';
}

/**
 * RG-M7-02 — Assurances obligatoires par type d'intervenant :
 *   entreprise → décennale + RC ; MOE → RC pro. Autres : aucune obligation propre.
 * (La DO + TRC sont des polices au niveau opération, voir OPERATION_REQUIRED_INSURANCES.)
 */
export function requiredInsurances(type: StakeholderType): InsuranceType[] {
  switch (type) {
    case 'entreprise':
      return ['decennale', 'RC'];
    case 'moe':
      return ['RC_pro'];
    default:
      return [];
  }
}

/** RG-M7-02 — Polices obligatoires au niveau de l'opération : DO + TRC. */
export const OPERATION_REQUIRED_INSURANCES: InsuranceType[] = ['DO', 'TRC'];

/**
 * RG-M7-03 — Assurances obligatoires manquantes ou non couvrantes pour un intervenant.
 * Une police présente mais « expired » compte comme manquante (attestation invalide).
 */
export function missingMandatoryInsurances(
  type: StakeholderType,
  policies: Pick<Insurance, 'type' | 'validTo'>[],
  today: string,
  warningDays = EXPIRY_WARNING_DAYS,
): InsuranceType[] {
  const required = requiredInsurances(type);
  return required.filter((req) => {
    const held = policies.filter((p) => p.type === req);
    return !held.some((p) => isCovering(p, today, warningDays));
  });
}

/**
 * RG-M7-03 — Une entreprise dont une attestation obligatoire manque/expire
 * est bloquée d'intervention.
 */
export function isInterventionBlocked(
  type: StakeholderType,
  policies: Pick<Insurance, 'type' | 'validTo'>[],
  today: string,
  warningDays = EXPIRY_WARNING_DAYS,
): boolean {
  return missingMandatoryInsurances(type, policies, today, warningDays).length > 0;
}

/** Résultat de garde réutilisable (même forme que la garde foncière M2 → M1). */
export interface GateResult {
  ok: boolean;
  blocking: InsuranceType[];
}

/**
 * RG-M7-04 — Garde DO : une police « Décennale d'ouvrage » (DO) couvrante
 * est requise avant l'ouverture de chantier (transition M1 → réalisation).
 * Renvoie la DO comme condition bloquante si absente/expirée.
 */
export function doGate(
  operationPolicies: Pick<Insurance, 'type' | 'validTo'>[],
  today: string,
  warningDays = EXPIRY_WARNING_DAYS,
): GateResult {
  const doPolicies = operationPolicies.filter((p) => p.type === 'DO');
  const covered = doPolicies.some((p) => isCovering(p, today, warningDays));
  return { ok: covered, blocking: covered ? [] : ['DO'] };
}

/**
 * RG-M7-07 — Une activité RACI doit porter exactement un « A ».
 * Renvoie true si l'ensemble d'assignations d'UNE activité est conforme.
 */
export function hasSingleAccountable(assignments: Pick<RaciAssignment, 'raci'>[]): boolean {
  return assignments.filter((a) => a.raci === 'A').length === 1;
}

/**
 * RG-M7-07 — Valide la matrice complète : liste des activités dont le nombre
 * de « A » ≠ 1 (0 = aucun responsable ; ≥ 2 = conflit).
 */
export function raciActivitiesInBreach(assignments: Pick<RaciAssignment, 'activity' | 'raci'>[]): string[] {
  const byActivity = new Map<string, number>();
  for (const a of assignments) {
    byActivity.set(a.activity, (byActivity.get(a.activity) ?? 0) + (a.raci === 'A' ? 1 : 0));
  }
  return [...byActivity.entries()].filter(([, count]) => count !== 1).map(([activity]) => activity);
}

/**
 * RG-M7-09 — Σ des honoraires des contrats ACTIFS → poste « études_honoraires » (M4).
 * Les contrats draft/closed sont exclus.
 */
export function honorairesTotal(contracts: StakeholderContract[], currency: Currency): Money {
  return sumMoney(
    contracts.filter((c) => c.status === 'active').map((c) => c.feeAmount),
    currency,
  );
}

/**
 * Types d'intervenants dont la rémunération relève des honoraires (services
 * intellectuels), par opposition aux marchés de travaux (entreprise → M8/M15).
 */
export const HONORAIRES_STAKEHOLDER_TYPES: StakeholderType[] = ['moe', 'amo', 'bet', 'ct', 'csps'];

export function isHonorairesType(type: StakeholderType): boolean {
  return HONORAIRES_STAKEHOLDER_TYPES.includes(type);
}

/**
 * RG-M7-09 — Honoraires alimentant le poste « honoraires » du bilan (M4),
 * dérivés des intervenants de services intellectuels (MVP : le montant porté
 * par l'intervenant). Le montant de l'entreprise (travaux) est exclu.
 */
export function honorairesFromStakeholders(
  items: { type: StakeholderType; feeAmount: number }[],
  currency: Currency,
): Money {
  return sumMoney(
    items.filter((s) => isHonorairesType(s.type)).map((s) => Money.of(s.feeAmount, currency)),
    currency,
  );
}

/** RG-M7-08 — Le registre est append-only : une décision actée n'est jamais modifiable. */
export function canModifyDecision(): boolean {
  return false;
}
