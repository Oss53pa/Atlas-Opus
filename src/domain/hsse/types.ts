/**
 * M19 (volet HSSE) — Registre des incidents Santé-Sécurité-Environnement · types
 * du domaine, purs. Journal des événements terrain (accidents, presqu'accidents,
 * incidents environnementaux, maladies professionnelles) distinct du registre des
 * risques (M20) : on enregistre ici des faits survenus, pas des risques anticipés.
 * Table : ao_hsse_incidents (opération-scopée). camelCase ; mapping snake_case côté données.
 */

/** Nature de l'incident (réf CDC M19 · HSSE). */
export const HSSE_KINDS = ['accident', 'presqu_accident', 'environnement', 'maladie_pro'] as const;
export type HsseKind = (typeof HSSE_KINDS)[number];

/** Gravité (croissante). */
export const HSSE_SEVERITIES = ['mineure', 'grave', 'critique'] as const;
export type HsseSeverity = (typeof HSSE_SEVERITIES)[number];

/** Machine : déclaré → en analyse → clos (réouverture possible clos → en analyse). */
export const HSSE_STATUSES = ['declare', 'en_analyse', 'clos'] as const;
export type HsseStatus = (typeof HSSE_STATUSES)[number];

export interface HsseIncident {
  id: string;
  tenantId: string;
  operationId: string;
  /** Référence interne (ex. HSSE-2026-004). */
  reference: string;
  kind: HsseKind;
  severity: HsseSeverity;
  /** Date de survenance (ISO date). */
  occurredAt: string;
  /** Localisation sur site (ou null). */
  location: string | null;
  description: string;
  /** Mesure corrective / action immédiate (ou null tant que non instruite). */
  correctiveAction: string | null;
  status: HsseStatus;
  /** Journées d'arrêt de travail (0 = sans arrêt). Numérateur du taux de gravité. */
  daysLost: number;
}

export interface HsseIncidentInput {
  reference: string;
  kind: HsseKind;
  severity: HsseSeverity;
  occurredAt: string;
  location?: string | null;
  description: string;
  correctiveAction?: string | null;
  daysLost?: number;
}

/**
 * Visite / inspection de sécurité (spec M19 §6 « HSSE : incidents, inspections,
 * taux de fréquence » ; transposé d'Advancity). Chaque visite déclare les heures
 * travaillées sur la période écoulée : c'est le dénominateur des taux.
 * Table : ao_hsse_inspections (opération-scopée).
 */
export interface HsseInspection {
  id: string;
  tenantId: string;
  operationId: string;
  /** Date de la visite (ISO date). */
  date: string;
  title: string;
  /** Score de conformité 0..100. */
  score: number;
  /** Heures travaillées déclarées pour la période couverte par la visite. */
  hoursWorked: number;
  observations: string | null;
}

export interface HsseInspectionInput {
  date: string;
  title: string;
  score: number;
  hoursWorked?: number;
  observations?: string | null;
}
