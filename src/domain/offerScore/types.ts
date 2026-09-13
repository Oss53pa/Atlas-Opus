/**
 * M23 (dépouillement) — Notation des offres. Note d'une offre sur un critère
 * de la grille (note brute 0..100 et note pondérée = brute × poids du critère).
 * Domaine pur. Table : ao_offer_scores (opération-scopée).
 */

export interface OfferScore {
  id: string;
  tenantId: string;
  operationId: string;
  offerId: string;
  criteriaId: string;
  /** Note brute attribuée (points 0..100). */
  rawScore: number;
  /** Note pondérée = brute × poids du critère. */
  weightedScore: number;
}

export interface OfferScoreInput {
  offerId: string;
  criteriaId: string;
  rawScore: number;
  weightedScore: number;
}
