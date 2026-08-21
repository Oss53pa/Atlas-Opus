/**
 * M1 — Règles de gestion RG-M1-01 à 12 (réf Spec M1 §5), pures et testables.
 */
import type { CreateOperationInput, Operation, Role } from './types';
import type { CountryConfig } from '../country';

/** Clé de comparaison de nom : insensible à la casse et aux espaces de bord. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** RG-M1-02 — Unicité du nom au sein d'un tenant (insensible à la casse). */
export function isNameUnique(name: string, existing: string[]): boolean {
  const key = nameKey(name);
  return !existing.some((n) => nameKey(n) === key);
}

/** RG-M1-01 / 04 — Valeurs héritées du pays à la création. */
export function deriveOperationDefaults(country: CountryConfig): {
  currency: string;
  procurementMode: 'private' | 'public';
  retentionRate: number;
} {
  return {
    currency: country.currency,
    procurementMode: country.defaultProcurementMode,
    retentionRate: country.retentionDefault,
  };
}

/** RG-M1-05 — end_date, si renseignée, ≥ start_date. */
export function endDateValid(startDate?: string | null, endDate?: string | null): boolean {
  if (!endDate || !startDate) return true;
  return endDate >= startDate; // ISO YYYY-MM-DD : comparaison lexicographique sûre.
}

/** RG-M1-06 — Devise modifiable uniquement tant qu'aucun coût ni marché. */
export function canChangeCurrency(flags: { hasBilanLines: boolean; hasContracts: boolean }): boolean {
  return !flags.hasBilanLines && !flags.hasContracts;
}

/** RG-M1-07 — Changement de type autorisé uniquement en phase « amont ». */
export function canChangeType(op: Pick<Operation, 'phase'>): boolean {
  return op.phase === 'amont';
}

/** RG-M1-12 — Archivage réversible par owner/moa_director uniquement. */
export function canRevertArchive(role: Role): boolean {
  return role === 'owner' || role === 'moa_director';
}

/** RG-M1-12 — Une opération close est en lecture seule pour les autres rôles. */
export function isReadOnlyForRole(op: Pick<Operation, 'status'>, role: Role): boolean {
  return op.status === 'closed' && role !== 'owner' && role !== 'moa_director';
}

/**
 * RG-M1-01 / 03 / 04 — Construit une nouvelle opération :
 * phase forcée à « amont », statut « active », valeurs héritées du pays.
 * id/now injectés pour la testabilité (pas d'effet de bord ici).
 */
export function buildNewOperation(
  input: CreateOperationInput,
  country: CountryConfig,
  ids: { id: string; tenantId: string; now: string },
): Operation {
  const defaults = deriveOperationDefaults(country);
  return {
    id: ids.id,
    tenantId: ids.tenantId,
    countryCode: input.countryCode,
    name: input.name.trim(),
    opType: input.opType,
    procurementMode: defaults.procurementMode,
    phase: 'amont', // RG-M1-03
    currency: defaults.currency, // RG-M1-01
    budgetBac: input.budgetBac ?? 0,
    retentionRate: input.retentionRate ?? defaults.retentionRate, // RG-M1-04
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    status: 'active', // RG-M1-03
    createdAt: ids.now,
    updatedAt: ids.now,
  };
}
