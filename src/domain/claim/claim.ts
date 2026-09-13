/**
 * M19 (sinistres) — règles pures. Agrégations monétaires via Money.ts (§5).
 */
import { Money } from '../money/Money';
import type { Claim, ClaimStatus } from './types';

/** Un sinistre est-il en cours d'instruction (ni indemnisé ni refusé) ? */
export function isPending(c: Pick<Claim, 'status'>): boolean {
  return c.status === 'declare' || c.status === 'en_instruction';
}

/** Nombre de sinistres en cours d'instruction. */
export function pendingCount(list: Pick<Claim, 'status'>[]): number {
  return list.filter(isPending).length;
}

/** Montant total des sinistres en cours (Money, devise donnée). */
export function totalPending(list: Pick<Claim, 'status' | 'amount'>[], currency: string): Money {
  return list.filter(isPending).reduce((acc, c) => acc.add(Money.of(c.amount, currency)), Money.zero(currency));
}

/** Montant total indemnisé (sinistres réglés). */
export function totalIndemnise(list: Pick<Claim, 'status' | 'amount'>[], currency: string): Money {
  return list.filter((c) => c.status === 'indemnise').reduce((acc, c) => acc.add(Money.of(c.amount, currency)), Money.zero(currency));
}

/** Transitions autorisées : instruction linéaire vers indemnisé | refusé. */
export const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  declare: ['en_instruction', 'refuse'],
  en_instruction: ['indemnise', 'refuse'],
  indemnise: [],
  refuse: ['en_instruction'],
};

export function canTransitionClaim(from: ClaimStatus, to: ClaimStatus): boolean {
  return CLAIM_TRANSITIONS[from].includes(to);
}
