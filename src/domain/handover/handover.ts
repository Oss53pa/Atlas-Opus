/**
 * Passation vers exploitation · règles pures (RG-M20-01), testables.
 * Aucune dépendance UI/IO. Les complétudes sont des ratios 0..1.
 */
import type { DoeCategory, HandoverFile } from './types';

/** Total attendu sur l'ensemble des catégories du DOE. */
export function doeExpectedTotal(doe: DoeCategory[]): number {
  return doe.reduce((s, c) => s + c.expected, 0);
}

/** Total reçu sur l'ensemble des catégories du DOE. */
export function doeReceivedTotal(doe: DoeCategory[]): number {
  return doe.reduce((s, c) => s + c.received, 0);
}

/** Complétude globale du DOE (0..1 ; 0 si rien d'attendu). */
export function doeCompletion(doe: DoeCategory[]): number {
  const expected = doeExpectedTotal(doe);
  if (expected === 0) return 0;
  return doeReceivedTotal(doe) / expected;
}

/** Complétude d'une catégorie (0..1). */
export function categoryCompletion(c: DoeCategory): number {
  if (c.expected === 0) return 0;
  return c.received / c.expected;
}

/** Statut d'une catégorie : complet / en cours / incomplet (seuil « en cours » ≥ 60 %). */
export type DoeCategoryStatus = 'complet' | 'en_cours' | 'incomplet';
export function categoryStatus(c: DoeCategory): DoeCategoryStatus {
  const r = categoryCompletion(c);
  if (r >= 1) return 'complet';
  if (r >= 0.6) return 'en_cours';
  return 'incomplet';
}

/**
 * RG-M20-01 — Le transfert est prononçable si le DOE est complet (100 %),
 * la réception est prononcée (fournie par M19) et l'export souverain est prêt.
 */
export function canTransfer(
  file: Pick<HandoverFile, 'doe' | 'exportReady'>,
  receptionPronounced: boolean,
): boolean {
  return doeCompletion(file.doe) >= 1 && receptionPronounced && file.exportReady;
}
