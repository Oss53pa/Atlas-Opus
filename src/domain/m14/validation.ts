/**
 * M14 — Validations & cas limites (réf Spec M14 §8).
 * Retourne des clés i18n (jamais de texte en dur).
 *   - arbitrage sans impact refusé (via stateMachine) ;
 *   - rôle insuffisant refusé (via stateMachine/permissions) ;
 *   - conversion d'un CO non approuvé refusée (via stateMachine) ;
 *   - refus sans motif refusé (ici + stateMachine) ;
 *   - saisie de création/impact contrôlée ici.
 */
import { CHANGE_ORIGINS, type CreateChangeOrderInput, type ImpactInput } from './types';

export type FieldErrors = Partial<Record<string, string>>;

const DESC_MIN = 3;
const DESC_MAX = 2000;

/** Création d'une demande de modification (§2). */
export function validateCreateChangeOrder(input: Partial<CreateChangeOrderInput>): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.contractId) errors.contractId = 'change.error.contract';

  if (!input.origin || !CHANGE_ORIGINS.includes(input.origin)) errors.origin = 'change.error.origin';

  const desc = (input.description ?? '').trim();
  if (desc.length < DESC_MIN || desc.length > DESC_MAX) errors.description = 'change.error.description';

  return errors;
}

/**
 * Instruction de l'impact (RG-M14-02). Un impact est « instruit » dès lors
 * que le coût et le délai sont fournis ; un impact nul explicite est admis.
 * `impactDays` doit être un entier fini.
 */
export function validateImpact(input: Partial<ImpactInput>): FieldErrors {
  const errors: FieldErrors = {};

  if (input.impactCost === undefined) errors.impactCost = 'change.error.impactCost';

  if (input.impactDays === undefined || !Number.isInteger(input.impactDays))
    errors.impactDays = 'change.error.impactDays';

  return errors;
}

/** Vrai si l'impact est complet et donc l'analyse « instruite » (alimente impactAnalyzed). */
export function isImpactComplete(input: Partial<ImpactInput>): boolean {
  return Object.keys(validateImpact(input)).length === 0;
}

/** §8 — un rejet exige un motif non vide. */
export function isRejectionReasonValid(reason?: string | null): boolean {
  return !!reason && reason.trim().length > 0;
}
