/**
 * M2 (montage juridique) — règles pures sur le capital et la constitution.
 * Les quotes-parts sont des pourcentages (pas de la monnaie) : arithmétique
 * simple, tolérance d'arrondi pour l'équilibre du capital.
 */
import {
  LEGAL_ENTITY_STATUSES, type LegalEntity, type LegalEntityStatus, type Shareholder,
} from './types';

/** Somme des quotes-parts (%). */
export function totalShares(shareholders: Shareholder[]): number {
  return shareholders.reduce((acc, s) => acc + s.sharePct, 0);
}

/** Le capital est-il réparti à 100 % (à 0,01 point près) ? */
export function isCapitalBalanced(shareholders: Shareholder[]): boolean {
  if (shareholders.length === 0) return false;
  return Math.abs(totalShares(shareholders) - 100) < 0.01;
}

/** Associé majoritaire (part la plus élevée), ou null si aucun associé. */
export function majorityHolder(shareholders: Shareholder[]): Shareholder | null {
  if (shareholders.length === 0) return null;
  return shareholders.reduce((best, s) => (s.sharePct > best.sharePct ? s : best));
}

/** Un associé détient-il > 50 % (contrôle capitalistique) ? */
export function hasControllingHolder(shareholders: Shareholder[]): boolean {
  const m = majorityHolder(shareholders);
  return m !== null && m.sharePct > 50;
}

/** Nombre de structures immatriculées (RCCM renseigné). */
export function registeredCount(list: Pick<LegalEntity, 'rccm'>[]): number {
  return list.filter((e) => !!e.rccm && e.rccm.trim() !== '').length;
}

/** Nombre de structures actives. */
export function activeCount(list: Pick<LegalEntity, 'status'>[]): number {
  return list.filter((e) => e.status === 'active').length;
}

/** Transitions autorisées de la structure (machine à états gardée). */
const TRANSITIONS: Record<LegalEntityStatus, LegalEntityStatus[]> = {
  projet: ['constituee', 'dissoute'],
  constituee: ['active', 'dissoute'],
  active: ['dissoute'],
  dissoute: [],
};

export function canTransitionLegalEntity(from: LegalEntityStatus, to: LegalEntityStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuts atteignables depuis l'état courant. */
export function nextStatuses(from: LegalEntityStatus): LegalEntityStatus[] {
  return LEGAL_ENTITY_STATUSES.filter((s) => canTransitionLegalEntity(from, s));
}
