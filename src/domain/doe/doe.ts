/**
 * M20 (DOE) — règles pures de complétude documentaire. Aucune dépendance UI/IO.
 */
import { DOE_CATEGORIES, type DoeCategory, type DoeDocument } from './types';

/** Nombre de documents validés. */
export function validatedCount(list: Pick<DoeDocument, 'validated'>[]): number {
  return list.filter((d) => d.validated).length;
}

/** Catégories couvertes par au moins un document VALIDÉ. */
export function coveredCategories(list: Pick<DoeDocument, 'category' | 'validated'>[]): Set<DoeCategory> {
  return new Set(list.filter((d) => d.validated).map((d) => d.category));
}

/**
 * Complétude du DOE : part des catégories attendues couvertes par un document
 * validé (0..1). Base = DOE_CATEGORIES (les catégories canoniques du dossier).
 */
export function completeness(list: Pick<DoeDocument, 'category' | 'validated'>[]): number {
  return coveredCategories(list).size / DOE_CATEGORIES.length;
}

/** Catégories attendues encore manquantes (aucun document validé). */
export function missingCategories(list: Pick<DoeDocument, 'category' | 'validated'>[]): DoeCategory[] {
  const covered = coveredCategories(list);
  return DOE_CATEGORIES.filter((c) => !covered.has(c));
}

/** Le DOE est-il complet (toutes les catégories couvertes) ? */
export function isComplete(list: Pick<DoeDocument, 'category' | 'validated'>[]): boolean {
  return coveredCategories(list).size === DOE_CATEGORIES.length;
}
