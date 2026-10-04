/**
 * M2 (amont) — Opportunités foncières · types du domaine, purs. Transposé du
 * module « Opportunités foncières » d'Advancity : pipeline de terrains repérés,
 * qualifiés puis arbitrés AVANT la création de l'opération. Une opportunité
 * « go » se convertit en opération (phase amont) ; l'acquisition proprement dite
 * se suit ensuite dans M2 (parcelles, titres, due diligence).
 * Table : ao_land_opportunities (niveau espace ; operation_id après conversion).
 */

export const OPPORTUNITY_STATUSES = [
  'prospection', 'etude', 'negociation', 'sous_conditions', 'acquise', 'abandonnee',
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const PROPERTY_TYPES = [
  'terrain_nu', 'terrain_viabilise', 'batiment_existant', 'friche', 'copropriete',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const DECISIONS = ['pending', 'go', 'conditional_go', 'no_go', 'postponed'] as const;
export type Decision = (typeof DECISIONS)[number];

export interface LandOpportunity {
  id: string;
  tenantId: string;
  reference: string;
  name: string;
  propertyType: PropertyType;
  countryCode: string;
  city: string | null;
  /** Surface de la parcelle (m²). */
  totalSurface: number;
  /** Surface de plancher constructible (m²). */
  buildableSurface: number;
  priceAsked: number;
  estimatedValue: number;
  status: OpportunityStatus;
  decision: Decision;
  /** Probabilité de concrétisation 0..1. */
  probability: number;
  discoveryDate: string;
  decisionDeadline: string | null;
  notes: string | null;
  /** Opération créée à partir de l'opportunité (conversion unique). */
  operationId: string | null;
}

export interface LandOpportunityInput {
  reference: string;
  name: string;
  propertyType: PropertyType;
  countryCode: string;
  city?: string | null;
  totalSurface?: number;
  buildableSurface?: number;
  priceAsked?: number;
  estimatedValue?: number;
  probability?: number;
  decisionDeadline?: string | null;
  notes?: string | null;
}

export type LandOpportunityPatch = Partial<
  Pick<LandOpportunity, 'status' | 'decision' | 'probability' | 'priceAsked' | 'estimatedValue' | 'notes' | 'operationId'>
>;
