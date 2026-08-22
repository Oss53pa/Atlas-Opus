/**
 * M7 — Validations & cas limites (réf Spec M7 §8).
 * Retourne des clés i18n (jamais de texte en dur).
 *   - type ∈ énum ; fee ≥ 0 ; DO manquante → garde M1 (voir rules.doGate) ;
 *   - 2 « A » RACI refusé ; décision actée non modifiable ; livrable sans échéance refusé.
 */
import { INSURANCE_TYPES, type Insurance, type RaciAssignment } from './types';
import type { Money } from '../money/Money';
import { hasSingleAccountable } from './rules';

export type FieldErrors = Partial<Record<string, string>>;

/** Saisie d'une assurance : type valide, validTo ≥ validFrom si présent. */
export function validateInsurance(input: Partial<Pick<Insurance, 'type' | 'validFrom' | 'validTo'>>): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.type || !INSURANCE_TYPES.includes(input.type)) errors.type = 'insurance.error.type';
  if (!input.validFrom) errors.validFrom = 'insurance.error.validFrom';
  if (input.validFrom && input.validTo && input.validTo < input.validFrom) errors.validTo = 'insurance.error.validTo';
  return errors;
}

/** §8 — Honoraires ≥ 0. */
export function isFeeValid(fee: Money): boolean {
  return !fee.isNegative();
}

/** §8 — Un livrable sans échéance est refusé. */
export function validateDeliverable(input: { label?: string; dueDate?: string | null }): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.label || input.label.trim().length === 0) errors.label = 'deliverable.error.label';
  if (!input.dueDate) errors.dueDate = 'deliverable.error.dueDate';
  return errors;
}

/**
 * RG-M7-07 — Ajouter une assignation « A » à une activité qui en possède déjà
 * un est refusé (deux « A » interdits). `existing` = assignations de CETTE activité.
 */
export function canAssignAccountable(existing: Pick<RaciAssignment, 'raci'>[]): boolean {
  return !existing.some((a) => a.raci === 'A');
}

/** RG-M7-07 — Une activité est prête si elle porte exactement un « A ». */
export function isActivityRaciValid(assignments: Pick<RaciAssignment, 'raci'>[]): boolean {
  return hasSingleAccountable(assignments);
}
