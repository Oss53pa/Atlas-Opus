/**
 * M1 — Validations & messages par champ (réf Spec M1 §8).
 * Retourne des clés i18n (jamais de texte en dur).
 */
import { OP_TYPES, type CreateOperationInput, type OperationPatch } from './types';
import { canChangeCurrency, endDateValid, isNameUnique } from './rules';

export type FieldErrors = Partial<Record<string, string>>;

interface ValidationCtx {
  existingNames: string[];
  /** Pour RG-M1-06 lors d'un changement de devise. */
  costFlags?: { hasBilanLines: boolean; hasContracts: boolean };
}

const NAME_MIN = 3;
const NAME_MAX = 120;

function validateName(name: string | undefined, existingNames: string[]): string | undefined {
  const value = (name ?? '').trim();
  if (value.length < NAME_MIN || value.length > NAME_MAX) return 'operation.error.name';
  if (!isNameUnique(value, existingNames)) return 'operation.error.name';
  return undefined;
}

/** Validation de la création d'opération (étapes de l'assistant 6.2). */
export function validateOperationInput(input: Partial<CreateOperationInput>, ctx: ValidationCtx): FieldErrors {
  const errors: FieldErrors = {};

  const nameErr = validateName(input.name, ctx.existingNames);
  if (nameErr) errors.name = nameErr;

  if (!input.countryCode) errors.countryCode = 'operation.error.country';

  if (!input.opType || !OP_TYPES.includes(input.opType)) errors.opType = 'operation.error.opType';

  if (!endDateValid(input.startDate, input.endDate)) errors.endDate = 'operation.error.endDate';

  return errors;
}

/** Validation d'une modification d'opération (écran édition). */
export function validateOperationPatch(
  patch: OperationPatch,
  ctx: ValidationCtx & { changingCurrency?: boolean },
): FieldErrors {
  const errors: FieldErrors = {};

  if (patch.name !== undefined) {
    const nameErr = validateName(patch.name, ctx.existingNames);
    if (nameErr) errors.name = nameErr;
  }

  if (patch.opType !== undefined && !OP_TYPES.includes(patch.opType)) errors.opType = 'operation.error.opType';

  if (patch.endDate !== undefined && !endDateValid(patch.startDate, patch.endDate))
    errors.endDate = 'operation.error.endDate';

  // RG-M1-06 — devise verrouillée si des montants existent déjà.
  if (ctx.changingCurrency && ctx.costFlags && !canChangeCurrency(ctx.costFlags))
    errors.currency = 'operation.error.currency';

  return errors;
}
