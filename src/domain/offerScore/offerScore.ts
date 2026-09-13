/**
 * M23 (dépouillement) — règles pures de notation & classement.
 * La note pondérée d'une offre agrège ses notes pondérées ; le classement
 * ordonne les offres par note pondérée décroissante.
 */
import { weightedScore } from '../evaluationCriterion/evaluationCriterion';
import type { OfferScore } from './types';

/** Note pondérée d'un critère : note brute (0..100) × poids (0..1). */
export function weightedFor(rawScore: number, weight: number): number {
  return weightedScore(rawScore, weight);
}

/** Note pondérée totale d'une offre (somme des notes pondérées de ses critères). */
export function offerTotal(scores: Pick<OfferScore, 'weightedScore'>[]): number {
  return scores.reduce((acc, s) => acc + s.weightedScore, 0);
}

/** Nombre de critères notés pour une offre. */
export function scoredCount(scores: unknown[]): number {
  return scores.length;
}

export interface OfferRankEntry<O> {
  offer: O;
  total: number;
  scored: number;
  rank: number;
}

/**
 * Classement des offres par note pondérée décroissante. `scoresByOffer` mappe
 * l'id d'offre à ses notes. Les offres sans note obtiennent 0. Ex æquo : même
 * ordre d'entrée, rangs successifs (1,2,3…). Ne mute pas.
 */
export function rankOffers<O extends { id: string }>(
  offers: O[],
  scores: OfferScore[],
): OfferRankEntry<O>[] {
  const byOffer = new Map<string, OfferScore[]>();
  for (const s of scores) (byOffer.get(s.offerId) ?? byOffer.set(s.offerId, []).get(s.offerId)!).push(s);
  const rows = offers.map((offer) => {
    const os = byOffer.get(offer.id) ?? [];
    return { offer, total: offerTotal(os), scored: os.length };
  });
  rows.sort((a, b) => b.total - a.total);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** La note d'une offre sur un critère donné, ou undefined si non notée. */
export function scoreOf(scores: OfferScore[], offerId: string, criteriaId: string): OfferScore | undefined {
  return scores.find((s) => s.offerId === offerId && s.criteriaId === criteriaId);
}
