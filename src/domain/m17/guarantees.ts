/**
 * M17 — Règles cautions & garanties, pures et testables.
 * Statut effectif dérivé de l'échéance, encours couvert, échéances imminentes.
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import type { Guarantee, GuaranteeDisplayStatus, GuaranteeStatus } from './types';

/** Fenêtre d'alerte d'échéance (≤ 30 j → « expiring »), alignée sur les assurances M7. */
export const EXPIRY_WARNING_DAYS = 30;

function daysBetween(aIso: string, bIso: string): number {
  return Math.floor((Date.parse(bIso) - Date.parse(aIso)) / 86_400_000);
}

/**
 * Statut effectif d'une garantie : les statuts terminaux (libérée/appelée) priment ;
 * sinon on dérive de l'échéance (expirée / imminente / active).
 */
export function effectiveStatus(
  g: Pick<Guarantee, 'status' | 'validUntil'>,
  today: string,
  warningDays = EXPIRY_WARNING_DAYS,
): GuaranteeDisplayStatus {
  if (g.status !== 'active') return g.status;
  if (!g.validUntil) return 'active';
  const remaining = daysBetween(today, g.validUntil);
  if (remaining < 0) return 'expiree';
  if (remaining <= warningDays) return 'expiring';
  return 'active';
}

/** Une garantie couvre-t-elle réellement l'opération (active et non expirée) ? */
export function isCovering(g: Pick<Guarantee, 'status' | 'validUntil'>, today: string, warningDays = EXPIRY_WARNING_DAYS): boolean {
  const s = effectiveStatus(g, today, warningDays);
  return s === 'active' || s === 'expiring';
}

/** Nombre de garanties couvrantes. */
export function activeCount(guarantees: Pick<Guarantee, 'status' | 'validUntil'>[], today: string): number {
  return guarantees.filter((g) => isCovering(g, today)).length;
}

/** Nombre de garanties à échéance imminente (≤ fenêtre). */
export function expiringCount(guarantees: Pick<Guarantee, 'status' | 'validUntil'>[], today: string, warningDays = EXPIRY_WARNING_DAYS): number {
  return guarantees.filter((g) => effectiveStatus(g, today, warningDays) === 'expiring').length;
}

/** Encours couvert = somme des montants des garanties couvrantes (via Money.ts). */
export function coveredTotal(guarantees: Pick<Guarantee, 'amount' | 'status' | 'validUntil'>[], currency: Currency, today: string): Money {
  return sumMoney(
    guarantees.filter((g) => isCovering(g, today)).map((g) => Money.of(g.amount, currency)),
    currency,
  );
}

export const GUARANTEE_TRANSITIONS: Record<GuaranteeStatus, GuaranteeStatus[]> = {
  active: ['liberee', 'appelee'],
  liberee: [],
  appelee: [],
};

export function canTransitionGuarantee(from: GuaranteeStatus, to: GuaranteeStatus): boolean {
  return GUARANTEE_TRANSITIONS[from].includes(to);
}
