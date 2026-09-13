/**
 * M19 (environnement & social) — Registre d'impacts EIES. Impacts environnementaux
 * et sociaux identifiés (Étude d'Impact E&S) et leurs mesures d'atténuation.
 * Livrable MOA en marchés publics / exigences bailleurs. Domaine pur.
 * Table : ao_eies_items (opération-scopée).
 */

/** Milieu affecté par l'impact. */
export const MILIEUX = ['physique', 'biologique', 'humain', 'socio_economique'] as const;
export type Milieu = (typeof MILIEUX)[number];

/** Gravité de l'impact (avant atténuation). */
export const SEVERITIES = ['faible', 'moyenne', 'forte', 'critique'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Avancement de la mesure d'atténuation. */
export const EIES_STATUSES = ['planifiee', 'en_cours', 'mise_en_oeuvre', 'soldee'] as const;
export type EiesStatus = (typeof EIES_STATUSES)[number];

export interface EiesItem {
  id: string;
  tenantId: string;
  operationId: string;
  impact: string;
  milieu: Milieu;
  severity: Severity;
  /** Mesure d'atténuation prévue, ou null. */
  mesureAttenuation: string | null;
  status: EiesStatus;
}

export interface EiesItemInput {
  impact: string;
  milieu: Milieu;
  severity: Severity;
  mesureAttenuation?: string | null;
}
