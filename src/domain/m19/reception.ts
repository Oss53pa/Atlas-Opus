/**
 * M19 — Règles de réception & GPA, pures et testables.
 * Une réception ne peut être prononcée tant qu'une réserve MAJEURE reste ouverte
 * (RG-M19). Les réserves mineures n'empêchent pas la réception mais restent
 * suivies pendant la GPA.
 */
import type { Reserve, ReserveStatus } from './types';

export function isOpen(status: ReserveStatus): boolean {
  return status === 'ouverte';
}

export function openReservesCount(reserves: Pick<Reserve, 'status'>[]): number {
  return reserves.filter((r) => isOpen(r.status)).length;
}

export function majorOpenCount(reserves: Pick<Reserve, 'severity' | 'status'>[]): number {
  return reserves.filter((r) => r.severity === 'majeure' && isOpen(r.status)).length;
}

export function clearedCount(reserves: Pick<Reserve, 'status'>[]): number {
  return reserves.filter((r) => r.status === 'levee').length;
}

/** Résultat de garde réutilisable (même forme que les autres gardes → M1). */
export interface GateResult {
  ok: boolean;
  blocking: number;
}

/**
 * RG-M19 — La réception est prononçable si aucune réserve majeure n'est ouverte.
 * `blocking` = nombre de réserves majeures ouvertes restantes.
 */
export function canPronounceReception(reserves: Pick<Reserve, 'severity' | 'status'>[]): GateResult {
  const blocking = majorOpenCount(reserves);
  return { ok: blocking === 0, blocking };
}

export { RESERVE_STATUSES } from './types';
