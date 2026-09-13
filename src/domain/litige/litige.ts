/**
 * M19 (litiges) — règles pures du registre. Aucune dépendance UI/IO ; les
 * agrégations monétaires passent par Money.ts (invariant CLAUDE.md §5).
 */
import { Money } from '../money/Money';
import type { Dispute, DisputeStatus } from './types';

/** Un litige est-il actif (non clos, non transigé) ? */
export function isActive(d: Pick<Dispute, 'status'>): boolean {
  return d.status === 'ouvert' || d.status === 'en_cours';
}

/** Nombre de litiges actifs. */
export function activeCount(list: Pick<Dispute, 'status'>[]): number {
  return list.filter(isActive).length;
}

/** Montant total en jeu sur les litiges actifs (Money, devise donnée). */
export function totalAtStake(list: Pick<Dispute, 'status' | 'amountAtStake'>[], currency: string): Money {
  return list.filter(isActive).reduce((acc, d) => acc.add(Money.of(d.amountAtStake, currency)), Money.zero(currency));
}

/** Transitions autorisées. */
export const DISPUTE_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  ouvert: ['en_cours', 'clos'],
  en_cours: ['transige', 'clos'],
  transige: ['clos'],
  clos: ['en_cours'],
};

export function canTransitionDispute(from: DisputeStatus, to: DisputeStatus): boolean {
  return DISPUTE_TRANSITIONS[from].includes(to);
}
