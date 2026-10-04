/**
 * M2 (amont) — Opportunités foncières : simulateur de charge foncière et
 * scoring (transposé d'Advancity).
 *
 * Bilan promoteur inversé : la charge foncière admissible est ce qui reste du
 * chiffre d'affaires une fois retranchés les coûts de production et la marge
 * cible — le prix plafond au-delà duquel l'opération détruit de la valeur.
 * Montants via Money.ts ; ratios en `number`.
 */
import { Money } from '../money/Money';
import type { Decision, LandOpportunity, OpportunityStatus } from './types';

export interface ChargeFonciereInput {
  caPrevisionnel: Money;
  /** Travaux + VRD. */
  coutsConstruction: Money;
  /** Honoraires, études, assurances, frais financiers, aléas. */
  autresCouts: Money;
  /** Marge cible en taux du chiffre d'affaires (ex. 0,12). */
  margeCibleRate: number;
}

export interface ChargeFonciereResult {
  chargeAdmissible: Money;
  margeCible: Money;
  coutsTotaux: Money;
}

/** charge_admissible = CA − coûts − CA × marge cible. */
export function chargeFonciereAdmissible(input: ChargeFonciereInput): ChargeFonciereResult {
  const coutsTotaux = input.coutsConstruction.add(input.autresCouts);
  const margeCible = input.caPrevisionnel.mulRate(input.margeCibleRate);
  return {
    chargeAdmissible: input.caPrevisionnel.subtract(coutsTotaux).subtract(margeCible),
    margeCible,
    coutsTotaux,
  };
}

/** Charge foncière ramenée au m² de plancher constructible (null sans surface). */
export function chargeAuM2(charge: Money, buildableSurface: number): Money | null {
  return buildableSurface > 0 ? charge.divide(buildableSurface) : null;
}

/** Positif = marge de négociation ; négatif = l'opportunité est trop chère. */
export function margeDeNegociation(charge: Money, priceAsked: Money): Money {
  return charge.subtract(priceAsked);
}

/** Ratio de constructibilité (COS effectif) = plancher / parcelle. */
export function constructibilityRatio(o: Pick<LandOpportunity, 'totalSurface' | 'buildableSurface'>): number {
  return o.totalSurface > 0 ? o.buildableSurface / o.totalSurface : 0;
}

const STATUS_WEIGHT: Record<OpportunityStatus, number> = {
  prospection: 0.2, etude: 0.5, negociation: 0.8, sous_conditions: 0.95, acquise: 1, abandonnee: 0,
};

/**
 * Score 0..100 : 40 % plus-value estimée (valeur vs prix demandé), 25 %
 * constructibilité (plafonnée à un COS de 3), 25 % probabilité, 10 %
 * avancement du cycle. Indicatif : il éclaire l'arbitrage, il ne le fait pas.
 */
export function scoreOpportunity(o: LandOpportunity): number {
  const plusValue = o.priceAsked > 0 ? Math.min(1, Math.max(0, (o.estimatedValue - o.priceAsked) / o.priceAsked)) : 0;
  const cos = Math.min(1, constructibilityRatio(o) / 3);
  const proba = Math.min(1, Math.max(0, o.probability));
  return Math.round((0.4 * plusValue + 0.25 * cos + 0.25 * proba + 0.1 * STATUS_WEIGHT[o.status]) * 100);
}

/** Décision suggérée à partir du score — jamais appliquée automatiquement. */
export function suggestedDecision(score: number): Decision {
  if (score >= 60) return 'go';
  if (score >= 40) return 'conditional_go';
  if (score >= 25) return 'postponed';
  return 'no_go';
}

/** Conversion en opération : une seule fois, et sur décision favorable. */
export function canConvert(o: Pick<LandOpportunity, 'operationId' | 'decision'>): boolean {
  return o.operationId === null && (o.decision === 'go' || o.decision === 'conditional_go');
}

/** Opportunités encore à l'étude (ni acquises ni abandonnées). */
export function activeOpportunities<T extends Pick<LandOpportunity, 'status'>>(list: T[]): T[] {
  return list.filter((o) => o.status !== 'acquise' && o.status !== 'abandonnee');
}
