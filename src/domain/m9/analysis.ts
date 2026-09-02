/**
 * M9 — Règles d'analyse des offres, pures et testables.
 * Note financière (mieux-disant = 100), note globale pondérée, classement,
 * admissibilité et seuil technique. Aucun flottant monétaire persisté : les
 * scores sont des indicateurs de comparaison, pas des montants.
 */
import type { Offer, OfferStatus } from './types';

/** Pondération par défaut : 60 % technique, 40 % financier. */
export const DEFAULT_WEIGHTS = { technical: 0.6, financial: 0.4 } as const;

/** Seuil d'admissibilité technique (note ≥ 70 / 100). */
export const TECHNICAL_THRESHOLD = 70;

export interface Weights {
  technical: number;
  financial: number;
}

/** Une offre est admissible tant qu'elle n'est pas écartée. */
export function isAdmissible(status: OfferStatus): boolean {
  return status !== 'ecarte';
}

export function meetsTechnicalThreshold(scoreTechnical: number, threshold = TECHNICAL_THRESHOLD): boolean {
  return scoreTechnical >= threshold;
}

/**
 * Note financière 0..100 : le montant le plus bas obtient 100 ; les autres au
 * prorata inverse (minAmount / amount × 100). Montant nul ou min nul → 0.
 */
export function financialScore(amount: number, minAmount: number): number {
  if (amount <= 0 || minAmount <= 0) return 0;
  return (minAmount / amount) * 100;
}

/** Note globale pondérée (0..100). */
export function globalScore(scoreTechnical: number, scoreFinancial: number, w: Weights = DEFAULT_WEIGHTS): number {
  return w.technical * scoreTechnical + w.financial * scoreFinancial;
}

export interface RankedOffer {
  offer: Offer;
  scoreFinancial: number;
  scoreGlobal: number;
  rank: number;
}

/**
 * Classe les offres admissibles d'un même marché par note globale décroissante.
 * Le mieux-disant financier est calculé sur le plus bas montant admissible.
 * Les offres écartées ne sont pas classées.
 */
export function rankOffers(offers: Offer[], w: Weights = DEFAULT_WEIGHTS): RankedOffer[] {
  const admissible = offers.filter((o) => isAdmissible(o.status));
  if (admissible.length === 0) return [];
  const minAmount = Math.min(...admissible.map((o) => o.amount).filter((a) => a > 0));
  return admissible
    .map((offer) => {
      const scoreFinancial = financialScore(offer.amount, minAmount);
      return { offer, scoreFinancial, scoreGlobal: globalScore(offer.scoreTechnical, scoreFinancial, w) };
    })
    .sort((a, b) => b.scoreGlobal - a.scoreGlobal)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Machine d'une offre (M9) : reçue → conforme / écartée ; une conforme peut
 * être retenue ou écartée ; une écartée peut être réintégrée. Retenue = terminal.
 */
const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  recu: ['conforme', 'ecarte'],
  conforme: ['retenu', 'ecarte'],
  ecarte: ['conforme'],
  retenu: [],
};
export function canTransitionOffer(from: OfferStatus, to: OfferStatus): boolean {
  return OFFER_TRANSITIONS[from].includes(to);
}

export { OFFER_STATUSES } from './types';
