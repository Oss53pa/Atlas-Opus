/**
 * M9 — Analyse & dépouillement des offres · types du domaine (réf Spec M9/M23), pur.
 * Une offre est rattachée à un marché (M8) et à l'opération. Note technique 0..100,
 * montant financier en `number` (unités majeures). Mapping snake_case : ao_offers.
 */

/** Machine d'une offre : reçue → conforme | écartée ; l'offre retenue = attribution. */
export const OFFER_STATUSES = ['recu', 'conforme', 'ecarte', 'retenu'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export interface Offer {
  id: string;
  tenantId: string;
  operationId: string;
  /** Marché (M8) auquel l'offre répond. */
  tenderId: string;
  bidder: string;
  /** Montant de l'offre (unités majeures). */
  amount: number;
  /** Note technique sur 100. */
  scoreTechnical: number;
  status: OfferStatus;
}

export interface OfferInput {
  tenderId: string;
  bidder: string;
  amount: number;
  scoreTechnical: number;
}
